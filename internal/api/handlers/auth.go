package handlers

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/email"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/argon2"
)

const maxLoginAttempts = 5
const sessionTTL = 7 * 24 * time.Hour

type AuthHandler struct {
	tenants            domain.TenantRepository
	tokens             domain.TokenRevoker
	sessions           domain.SessionRepository
	emailVerifications domain.EmailVerificationRepository
	emailClient        *email.ResendClient
	members            domain.MemberRepository
	apiKeys            domain.APIKeyRepository
}

func NewAuthHandler(
	tenants domain.TenantRepository,
	tokens domain.TokenRevoker,
	sessions domain.SessionRepository,
	emailVerifications domain.EmailVerificationRepository,
	emailClient *email.ResendClient,
	members domain.MemberRepository,
	apiKeys domain.APIKeyRepository,
) *AuthHandler {
	return &AuthHandler{
		tenants:            tenants,
		tokens:             tokens,
		sessions:           sessions,
		emailVerifications: emailVerifications,
		emailClient:        emailClient,
		members:            members,
		apiKeys:            apiKeys,
	}
}

// generateSessionID creates a random, opaque session identifier embedded in
// both the access and refresh JWTs at issuance. It is not derived from the
// token itself, so a session can be listed and revoked without ever storing
// raw tokens.
func generateSessionID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// generateVerificationCode generates a cryptographically random 6-digit code.
func generateVerificationCode() (string, error) {
	const digits = "0123456789"
	code := make([]byte, 6)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		if err != nil {
			return "", err
		}
		code[i] = digits[n.Int64()]
	}
	return string(code), nil
}

// HashPassword produces an argon2id hash with a unique random salt.
// Format: argon2id$salt_hex$hash_hex
func HashPassword(password string) string {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		panic("failed to generate random salt: " + err.Error())
	}
	hash := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
	return fmt.Sprintf("argon2id$%s$%s", hex.EncodeToString(salt), hex.EncodeToString(hash))
}

// verifyPassword checks a plaintext password against a stored hash.
func verifyPassword(password, stored string) bool {
	if strings.HasPrefix(stored, "argon2id$") {
		parts := strings.Split(stored, "$")
		if len(parts) != 3 {
			return false
		}
		salt, err := hex.DecodeString(parts[1])
		if err != nil {
			return false
		}
		expected, err := hex.DecodeString(parts[2])
		if err != nil {
			return false
		}
		hash := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
		return subtle.ConstantTimeCompare(hash, expected) == 1
	}

	// Legacy: static salt used in dev seed
	salt := []byte("tori-static-salt")
	hash := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
	legacy := hex.EncodeToString(hash)
	if len(legacy) != len(stored) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(legacy), []byte(stored)) == 1
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if body.Name == "" || body.Email == "" || body.Password == "" {
		respond.BadRequest(w, r, "missing_fields", "name, email, and password are required")
		return
	}
	if len(body.Password) < 8 {
		respond.BadRequest(w, r, "weak_password", "password must be at least 8 characters")
		return
	}

	existing, _ := h.tenants.GetByEmail(r.Context(), body.Email)
	if existing != nil {
		respond.Conflict(w, r, "email_taken", "an account with this email already exists")
		return
	}

	placeholderHash := middleware.HashAPIKey("tori_live_" + uuid.New().String())
	webhookSecret := "whsec_" + uuid.New().String()
	passwordHash := HashPassword(body.Password)

	tenant, err := h.tenants.Create(
		r.Context(),
		body.Name,
		body.Email,
		placeholderHash,
		webhookSecret,
		domain.DefaultDunningConfig(),
	)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	if err := h.tenants.SetPassword(r.Context(), tenant.ID, passwordHash); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	// Generate both a live and a test API key up front.
	for _, mode := range []string{"live", "test"} {
		_, hash, hint, keyErr := generateAPIKey(mode)
		if keyErr != nil {
			log.Error().Err(keyErr).Str("tenant_id", tenant.ID.String()).Msg("auth: failed to generate " + mode + " api key")
			continue
		}
		if _, keyErr := h.apiKeys.Upsert(r.Context(), tenant.ID, mode, hash, hint); keyErr != nil {
			log.Error().Err(keyErr).Str("tenant_id", tenant.ID.String()).Msg("auth: failed to store " + mode + " api key")
		}
	}

	// Generate and send email verification code
	code, err := generateVerificationCode()
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	expiresAt := time.Now().UTC().Add(15 * time.Minute)
	if _, err := h.emailVerifications.Create(r.Context(), tenant.ID, code, expiresAt); err != nil {
		log.Error().Err(err).Str("tenant_id", tenant.ID.String()).Msg("auth: failed to create verification code")
	} else {
		subject, html := email.VerificationEmail(tenant.Name, code)
		if err := h.emailClient.Send(r.Context(), tenant.Email, subject, html); err != nil {
			log.Error().Err(err).Str("tenant_id", tenant.ID.String()).Msg("auth: failed to send verification email")
		}
	}

	sessionID, err := generateSessionID()
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	accessToken, err := middleware.GenerateJWT(tenant.ID, sessionID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	refreshToken, err := middleware.GenerateRefreshToken(tenant.ID, sessionID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	if err := h.sessions.Create(r.Context(), tenant.ID, sessionID, r.RemoteAddr, r.Header.Get("User-Agent"), sessionTTL); err != nil {
		log.Error().Err(err).Str("tenant_id", tenant.ID.String()).Msg("auth: failed to create session record")
	}

	log.Info().
		Str("tenant_id", tenant.ID.String()).
		Str("email", middleware.MaskEmail(tenant.Email)).
		Msg("auth: new tenant registered — verification email sent")

	respond.JSON(w, r, http.StatusCreated, map[string]interface{}{
		"access_token":   accessToken,
		"refresh_token":  refreshToken,
		"token_type":     "Bearer",
		"email_verified": false,
		"message":        "Account created. Check your email for a verification code.",
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if body.Email == "" || body.Password == "" {
		respond.BadRequest(w, r, "missing_fields", "email and password are required")
		return
	}

	if h.tokens.IsLoginLocked(r.Context(), body.Email) {
		respond.Error(w, r, http.StatusTooManyRequests, "account_locked",
			"too many failed login attempts — account locked for 15 minutes")
		return
	}

	tenant, err := h.tenants.GetByEmail(r.Context(), body.Email)
	if err != nil {
		h.loginAsMember(w, r, body.Email, body.Password)
		return
	}

	if !tenant.IsActive {
		respond.Unauthorised(w, r, "account is inactive")
		return
	}

	if !verifyPassword(body.Password, tenant.PasswordHash) {
		count, _ := h.tokens.RecordLoginFailure(r.Context(), body.Email)
		if maxLoginAttempts-count <= 0 {
			respond.Error(w, r, http.StatusTooManyRequests, "account_locked",
				"too many failed login attempts — account locked for 15 minutes")
			return
		}
		respond.Unauthorised(w, r, "invalid credentials")
		return
	}

	h.tokens.ClearLoginFailures(r.Context(), body.Email)

	if ownerMember, err := h.members.GetByEmail(r.Context(), tenant.ID, tenant.Email); err == nil {
		if err := h.members.UpdateLastLogin(r.Context(), ownerMember.ID); err != nil {
			log.Error().Err(err).Str("member_id", ownerMember.ID.String()).Msg("auth: failed to update member last_login_at")
		}
	}

	sessionID, err := generateSessionID()
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	accessToken, err := middleware.GenerateJWT(tenant.ID, sessionID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	refreshToken, err := middleware.GenerateRefreshToken(tenant.ID, sessionID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	if err := h.sessions.Create(r.Context(), tenant.ID, sessionID, r.RemoteAddr, r.Header.Get("User-Agent"), sessionTTL); err != nil {
		log.Error().Err(err).Str("tenant_id", tenant.ID.String()).Msg("auth: failed to create session record")
	}

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"access_token":   accessToken,
		"refresh_token":  refreshToken,
		"token_type":     "Bearer",
		"email_verified": tenant.EmailVerified,
	})
}

// loginAsMember handles sign-in for invited team members — accounts that
// exist in the members table rather than as their own tenant. The issued
// JWT is scoped to the member's tenant_id, giving them the same dashboard
// access as the tenant owner.
func (h *AuthHandler) loginAsMember(w http.ResponseWriter, r *http.Request, emailAddr, password string) {
	member, err := h.members.GetByEmailAcrossTenants(r.Context(), emailAddr)
	if err != nil || member.PasswordHash == "" {
		h.tokens.RecordLoginFailure(r.Context(), emailAddr)
		respond.Unauthorised(w, r, "invalid credentials")
		return
	}

	if member.Status != domain.MemberStatusActive {
		respond.Unauthorised(w, r, "invalid credentials")
		return
	}

	if !verifyPassword(password, member.PasswordHash) {
		count, _ := h.tokens.RecordLoginFailure(r.Context(), emailAddr)
		if maxLoginAttempts-count <= 0 {
			respond.Error(w, r, http.StatusTooManyRequests, "account_locked",
				"too many failed login attempts — account locked for 15 minutes")
			return
		}
		respond.Unauthorised(w, r, "invalid credentials")
		return
	}

	memberTenant, err := h.tenants.GetByID(r.Context(), member.TenantID)
	if err != nil || !memberTenant.IsActive {
		respond.Unauthorised(w, r, "account is inactive")
		return
	}

	h.tokens.ClearLoginFailures(r.Context(), emailAddr)

	if err := h.members.UpdateLastLogin(r.Context(), member.ID); err != nil {
		log.Error().Err(err).Str("member_id", member.ID.String()).Msg("auth: failed to update member last_login_at")
	}

	sessionID, err := generateSessionID()
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	accessToken, err := middleware.GenerateJWT(member.TenantID, sessionID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	refreshToken, err := middleware.GenerateRefreshToken(member.TenantID, sessionID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	if err := h.sessions.Create(r.Context(), member.TenantID, sessionID, r.RemoteAddr, r.Header.Get("User-Agent"), sessionTTL); err != nil {
		log.Error().Err(err).Str("tenant_id", member.TenantID.String()).Msg("auth: failed to create session record")
	}

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"access_token":   accessToken,
		"refresh_token":  refreshToken,
		"token_type":     "Bearer",
		"email_verified": memberTenant.EmailVerified,
	})
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if body.RefreshToken == "" {
		respond.BadRequest(w, r, "missing_field", "refresh_token is required")
		return
	}

	tenantID, sessionID, err := middleware.ValidateRefreshToken(body.RefreshToken)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired refresh token")
		return
	}

	if sessionID != "" && !h.sessions.IsActive(r.Context(), tenantID, sessionID) {
		respond.Unauthorised(w, r, "session has been revoked")
		return
	}

	accessToken, err := middleware.GenerateJWT(tenantID, sessionID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	newRefresh, err := middleware.GenerateRefreshToken(tenantID, sessionID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	if sessionID != "" {
		if err := h.sessions.Touch(r.Context(), tenantID, sessionID); err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID.String()).Msg("auth: failed to touch session")
		}
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{
		"access_token":  accessToken,
		"refresh_token": newRefresh,
		"token_type":    "Bearer",
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	header := r.Header.Get("Authorization")
	token := strings.TrimPrefix(header, "Bearer ")
	if token == "" {
		respond.BadRequest(w, r, "missing_token", "no token to revoke")
		return
	}

	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	if err := h.tokens.Revoke(r.Context(), token, expiresAt); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	tenantID := middleware.GetTenantID(r.Context())
	if sessionID := middleware.GetSessionID(r.Context()); sessionID != "" {
		if err := h.sessions.RevokeSession(r.Context(), tenantID, sessionID); err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID.String()).Msg("auth: failed to revoke session on logout")
		}
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{
		"message": "logged out successfully",
	})
}

// ListSessions handles GET /v1/auth/sessions — active login sessions for the
// authenticated tenant, newest-active first.
func (h *AuthHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	currentSessionID := middleware.GetSessionID(r.Context())

	sessions, err := h.sessions.List(r.Context(), tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	type sessionResponse struct {
		ID         string    `json:"id"`
		IPAddress  string    `json:"ip_address"`
		UserAgent  string    `json:"user_agent"`
		CreatedAt  time.Time `json:"created_at"`
		LastSeenAt time.Time `json:"last_seen_at"`
		IsCurrent  bool      `json:"is_current"`
	}

	out := make([]sessionResponse, len(sessions))
	for i, s := range sessions {
		out[i] = sessionResponse{
			ID:         s.ID,
			IPAddress:  s.IPAddress,
			UserAgent:  s.UserAgent,
			CreatedAt:  s.CreatedAt,
			LastSeenAt: s.LastSeenAt,
			IsCurrent:  s.ID == currentSessionID,
		}
	}

	respond.JSON(w, r, http.StatusOK, out)
}

// RevokeSession handles DELETE /v1/auth/sessions/{id}.
func (h *AuthHandler) RevokeSession(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	sessionID := chi.URLParam(r, "id")
	if sessionID == "" {
		respond.BadRequest(w, r, "invalid_id", "session ID is required")
		return
	}

	if err := h.sessions.RevokeSession(r.Context(), tenantID, sessionID); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{"status": "revoked"})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	if tenant == nil {
		respond.Unauthorised(w, r, "not authenticated")
		return
	}
	respond.JSON(w, r, http.StatusOK, tenant)
}

func (h *AuthHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	if tenant == nil {
		respond.Unauthorised(w, r, "not authenticated")
		return
	}

	var body struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}

	if body.Name == "" {
		body.Name = tenant.Name
	}
	if body.Email == "" {
		body.Email = tenant.Email
	}

	updated, err := h.tenants.Update(r.Context(), tenant.ID, body.Name, body.Email)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, updated)
}

// VerifyEmail handles POST /v1/auth/verify-email
func (h *AuthHandler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == uuid.Nil {
		respond.Unauthorised(w, r, "missing tenant")
		return
	}

	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Code == "" {
		respond.BadRequest(w, r, "missing_field", "code is required")
		return
	}

	v, err := h.emailVerifications.GetByCode(r.Context(), body.Code)
	if err != nil {
		respond.BadRequest(w, r, "invalid_code", "verification code is invalid or expired")
		return
	}

	if v.TenantID != tenantID {
		respond.BadRequest(w, r, "invalid_code", "verification code is invalid or expired")
		return
	}

	if v.UsedAt != nil {
		respond.BadRequest(w, r, "code_already_used", "this verification code has already been used")
		return
	}

	if time.Now().UTC().After(v.ExpiresAt) {
		respond.BadRequest(w, r, "code_expired", "verification code has expired — request a new one")
		return
	}

	if err := h.emailVerifications.MarkUsed(r.Context(), v.ID); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	tenant, err := h.tenants.MarkEmailVerified(r.Context(), tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	// Send welcome email
	subject, html := email.WelcomeEmail(tenant.Name)
	if err := h.emailClient.Send(r.Context(), tenant.Email, subject, html); err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID.String()).Msg("auth: failed to send welcome email")
	}

	log.Info().
		Str("tenant_id", tenantID.String()).
		Msg("auth: email verified successfully")

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"email_verified": true,
		"message":        "Email verified successfully. Welcome to Tori.",
	})
}

// ResendVerification handles POST /v1/auth/resend-verification
func (h *AuthHandler) ResendVerification(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == uuid.Nil {
		respond.Unauthorised(w, r, "missing tenant")
		return
	}

	tenant, err := h.tenants.GetByID(r.Context(), tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	if tenant.EmailVerified {
		respond.UnprocessableEntity(w, r, "already_verified", "email address is already verified")
		return
	}

	code, err := generateVerificationCode()
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	expiresAt := time.Now().UTC().Add(15 * time.Minute)

	if _, err := h.emailVerifications.Create(r.Context(), tenantID, code, expiresAt); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	subject, html := email.VerificationEmail(tenant.Name, code)
	if err := h.emailClient.Send(r.Context(), tenant.Email, subject, html); err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID.String()).Msg("auth: failed to resend verification email")
		respond.InternalError(w, r, fmt.Errorf("failed to send verification email"))
		return
	}

	log.Info().
		Str("tenant_id", tenantID.String()).
		Msg("auth: verification email resent")

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"message": "Verification email sent. Check your inbox.",
	})
}

// UpdateDunningConfig handles PATCH /v1/dunning-config
func (h *AuthHandler) UpdateDunningConfig(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	if tenant == nil {
		respond.Unauthorised(w, r, "not authenticated")
		return
	}

	var body domain.DunningConfig
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}

	// Validate
	if body.MaxAttempts < 1 || body.MaxAttempts > 10 {
		respond.BadRequest(w, r, "invalid_field", "max_attempts must be between 1 and 10")
		return
	}
	if len(body.RetryIntervalsDays) == 0 {
		respond.BadRequest(w, r, "invalid_field", "retry_intervals_days must not be empty")
		return
	}
	if body.SuspensionAction != "suspend" && body.SuspensionAction != "cancel" {
		body.SuspensionAction = "suspend"
	}

	updated, err := h.tenants.UpdateDunningConfig(r.Context(), tenant.ID, body)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, updated)
}

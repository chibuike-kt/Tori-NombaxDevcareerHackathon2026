package handlers

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"golang.org/x/crypto/argon2"
)

type AuthHandler struct {
	tenants domain.TenantRepository
	tokens  domain.TokenRevoker
}

func NewAuthHandler(tenants domain.TenantRepository, tokens domain.TokenRevoker) *AuthHandler {
	return &AuthHandler{tenants: tenants, tokens: tokens}
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
// Supports the new random-salt format and the legacy static-salt format.
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

	accessToken, err := middleware.GenerateJWT(tenant.ID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	refreshToken, err := middleware.GenerateRefreshToken(tenant.ID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusCreated, map[string]interface{}{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"token_type":    "Bearer",
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

	tenant, err := h.tenants.GetByEmail(r.Context(), body.Email)
	if err != nil {
		respond.Unauthorised(w, r, "invalid credentials")
		return
	}

	if !tenant.IsActive {
		respond.Unauthorised(w, r, "account is inactive")
		return
	}

	if !verifyPassword(body.Password, tenant.PasswordHash) {
		respond.Unauthorised(w, r, "invalid credentials")
		return
	}

	accessToken, err := middleware.GenerateJWT(tenant.ID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	refreshToken, err := middleware.GenerateRefreshToken(tenant.ID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"token_type":    "Bearer",
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

	tenantID, err := middleware.ValidateRefreshToken(body.RefreshToken)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired refresh token")
		return
	}

	accessToken, err := middleware.GenerateJWT(tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	newRefresh, err := middleware.GenerateRefreshToken(tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
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

	// Revoke for 7 days to cover the refresh token lifetime
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	if err := h.tokens.Revoke(r.Context(), token, expiresAt); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{
		"message": "logged out successfully",
	})
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

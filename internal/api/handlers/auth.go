package handlers

import (
	"encoding/hex"
	"encoding/json"
	"net/http"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"golang.org/x/crypto/argon2"
	"github.com/google/uuid"
)

type AuthHandler struct {
	tenants domain.TenantRepository
}

func NewAuthHandler(tenants domain.TenantRepository) *AuthHandler {
	return &AuthHandler{tenants: tenants}
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
	respond.JSON(w, r, http.StatusOK, map[string]string{
		"message": "refresh token endpoint — full implementation pending",
	})
}

// HashPassword produces an argon2id hash of a plaintext password.
func HashPassword(password string) string {
	salt := []byte("tori-static-salt") // static salt for seeding only; real impl uses random salt
	hash := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
	return hex.EncodeToString(hash)
}

func verifyPassword(password, hash string) bool {
	return HashPassword(password) == hash
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

	apiKey := "tori_live_" + uuid.New().String()
	apiKeyHash := middleware.HashAPIKey(apiKey)
	webhookSecret := "whsec_" + uuid.New().String()
	passwordHash := HashPassword(body.Password)

	tenant, err := h.tenants.Create(r.Context(), body.Name, body.Email, apiKeyHash, webhookSecret, domain.DefaultDunningConfig())
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	if err := h.tenants.SetPassword(r.Context(), tenant.ID, passwordHash); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	accessToken, _ := middleware.GenerateJWT(tenant.ID)
	refreshToken, _ := middleware.GenerateRefreshToken(tenant.ID)

	respond.JSON(w, r, http.StatusCreated, map[string]interface{}{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"token_type":    "Bearer",
		"api_key":       apiKey,
		"tenant":        tenant,
	})
}

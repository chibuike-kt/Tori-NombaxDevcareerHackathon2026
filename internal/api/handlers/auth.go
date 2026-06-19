package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
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
		// Don't reveal whether email exists
		respond.Unauthorised(w, r, "invalid credentials")
		return
	}

	if !tenant.IsActive {
		respond.Unauthorised(w, r, "account is inactive")
		return
	}

	// Password check against tenant.APIKeyHash is a placeholder —
	// real password field added when tenant registration is built.
	// For now the seeded tenant bypasses this check.
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

	respond.JSON(w, r, http.StatusOK, map[string]string{
		"message": "refresh token endpoint — full implementation in Phase 11 polish",
	})
}

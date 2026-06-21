package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
)

type APIKeyHandler struct {
	tenants domain.TenantRepository
}

func NewAPIKeyHandler(tenants domain.TenantRepository) *APIKeyHandler {
	return &APIKeyHandler{tenants: tenants}
}

type createAPIKeyRequest struct {
	Name string `json:"name"`
}

type apiKeyResponse struct {
	Key  string `json:"key"`
	Name string `json:"name"`
	Hint string `json:"hint"`
}

func generateKey() (raw, hash, hint string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return
	}
	raw = fmt.Sprintf("tori_live_%s", hex.EncodeToString(b))
	hash = middleware.HashAPIKey(raw)
	hint = raw[:16] + "..." + raw[len(raw)-4:]
	return
}

// CreateAPIKey generates a new API key, stores the hash and hint, returns the raw key once.
func (h *APIKeyHandler) CreateAPIKey(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	var req createAPIKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if req.Name == "" {
		req.Name = "Default"
	}

	key, hash, hint, err := generateKey()
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	if _, err := h.tenants.UpdateAPIKeyHashAndHint(r.Context(), tenantID, hash, hint); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusCreated, apiKeyResponse{
		Key:  key,
		Name: req.Name,
		Hint: hint,
	})
}

// RotateAPIKey replaces the current key. Old key stops working immediately.
func (h *APIKeyHandler) RotateAPIKey(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	key, hash, hint, err := generateKey()
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	if _, err := h.tenants.UpdateAPIKeyHashAndHint(r.Context(), tenantID, hash, hint); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, apiKeyResponse{
		Key:  key,
		Name: "Rotated key",
		Hint: hint,
	})
}

// GetAPIKeyHint returns the stored hint for the current tenant's active key.
// Never returns the raw key — only the hint (prefix...suffix).
func (h *APIKeyHandler) GetAPIKeyHint(w http.ResponseWriter, r *http.Request) {
	tenant := middleware.GetTenant(r.Context())
	if tenant == nil {
		respond.Unauthorised(w, r, "not authenticated")
		return
	}

	if tenant.APIKeyHint == "" {
		respond.JSON(w, r, http.StatusOK, map[string]string{
			"hint": "",
			"note": "No API key created yet",
		})
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{
		"hint": tenant.APIKeyHint,
	})
}

package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"

	apicontext "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/context"
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

// CreateAPIKey generates a new API key for the tenant.
// The raw key is returned exactly once. Tori stores only the hash.
func (h *APIKeyHandler) CreateAPIKey(w http.ResponseWriter, r *http.Request) {
	tenantID := apicontext.GetTenantID(r.Context())

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

	if err := h.tenants.UpdateAPIKeyHash(r.Context(), tenantID, hash); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusCreated, apiKeyResponse{
		Key:  key,
		Name: req.Name,
		Hint: hint,
	})
}

// RotateAPIKey replaces the current key with a new one.
// The old key stops working the moment this returns.
func (h *APIKeyHandler) RotateAPIKey(w http.ResponseWriter, r *http.Request) {
	tenantID := apicontext.GetTenantID(r.Context())

	key, hash, hint, err := generateKey()
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	if err := h.tenants.UpdateAPIKeyHash(r.Context(), tenantID, hash); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, apiKeyResponse{
		Key:  key,
		Name: "Rotated key",
		Hint: hint,
	})
}

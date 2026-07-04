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
	apiKeys domain.APIKeyRepository
}

func NewAPIKeyHandler(tenants domain.TenantRepository, apiKeys domain.APIKeyRepository) *APIKeyHandler {
	return &APIKeyHandler{tenants: tenants, apiKeys: apiKeys}
}

type createAPIKeyRequest struct {
	Name string `json:"name"`
}

type apiKeyResponse struct {
	Key  string `json:"key"`
	Name string `json:"name"`
	Hint string `json:"hint"`
	Mode string `json:"mode"`
}

// generateAPIKey creates a raw key with the mode's prefix (tori_test_ or
// tori_live_) plus its SHA-256 hash and display hint.
func generateAPIKey(mode string) (raw, hash, hint string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return
	}
	prefix := "tori_live_"
	if mode == "test" {
		prefix = "tori_test_"
	}
	raw = fmt.Sprintf("%s%s", prefix, hex.EncodeToString(b))
	hash = middleware.HashAPIKey(raw)
	hint = raw[:16] + "..." + raw[len(raw)-4:]
	return
}

func (h *APIKeyHandler) createOrRotate(w http.ResponseWriter, r *http.Request, mode, name string) {
	tenantID := middleware.GetTenantID(r.Context())

	key, hash, hint, err := generateAPIKey(mode)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	if _, err := h.apiKeys.Upsert(r.Context(), tenantID, mode, hash, hint); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusCreated, apiKeyResponse{
		Key:  key,
		Name: name,
		Hint: hint,
		Mode: mode,
	})
}

// CreateAPIKey generates (or replaces) the tenant's live API key.
func (h *APIKeyHandler) CreateAPIKey(w http.ResponseWriter, r *http.Request) {
	var req createAPIKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if req.Name == "" {
		req.Name = "Default"
	}
	h.createOrRotate(w, r, "live", req.Name)
}

// RotateAPIKey replaces the current live key. Old key stops working immediately.
func (h *APIKeyHandler) RotateAPIKey(w http.ResponseWriter, r *http.Request) {
	h.createOrRotate(w, r, "live", "Rotated key")
}

// CreateTestAPIKey generates (or replaces) the tenant's test API key.
func (h *APIKeyHandler) CreateTestAPIKey(w http.ResponseWriter, r *http.Request) {
	h.createOrRotate(w, r, "test", "Test key")
}

// GetAPIKeyHints returns hints for both the tenant's live and test keys.
// Never returns the raw key — only the hint (prefix...suffix).
func (h *APIKeyHandler) GetAPIKeyHints(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	keys, err := h.apiKeys.ListByTenant(r.Context(), tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	result := map[string]interface{}{
		"live": nil,
		"test": nil,
	}
	for _, k := range keys {
		result[k.Mode] = map[string]interface{}{
			"hint":       k.KeyHint,
			"created_at": k.CreatedAt,
		}
	}

	respond.JSON(w, r, http.StatusOK, result)
}

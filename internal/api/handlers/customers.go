package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type CustomerHandler struct {
	customers domain.CustomerRepository
}

func NewCustomerHandler(customers domain.CustomerRepository) *CustomerHandler {
	return &CustomerHandler{customers: customers}
}

func (h *CustomerHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	var body struct {
		ExternalID *string `json:"external_id"`
		Email      string  `json:"email"`
		Name       *string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if body.Email == "" {
		respond.BadRequest(w, r, "missing_field", "email is required")
		return
	}

	mode := middleware.GetMode(r.Context())
	customer, err := h.customers.Create(r.Context(), tenantID, body.ExternalID, body.Email, body.Name, nil, nil, mode)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusCreated, customer)
}

func (h *CustomerHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit == 0 {
		limit = 20
	}

	// External ID lookup
	if extID := r.URL.Query().Get("external_id"); extID != "" {
		customer, err := h.customers.GetByExternalID(r.Context(), tenantID, extID)
		if err != nil {
			respond.NotFound(w, r)
			return
		}
		respond.JSON(w, r, http.StatusOK, customer)
		return
	}

	mode := middleware.GetMode(r.Context())
	customers, err := h.customers.List(r.Context(), tenantID, mode, limit, offset)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.List(w, r, http.StatusOK, customers, &respond.Pagination{Total: int64(len(customers))})
}

func (h *CustomerHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "customer ID is not a valid UUID")
		return
	}

	customer, err := h.customers.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	respond.JSON(w, r, http.StatusOK, customer)
}

func (h *CustomerHandler) Update(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "customer ID is not a valid UUID")
		return
	}

	var body struct {
		Email string  `json:"email"`
		Name  *string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}

	customer, err := h.customers.Update(r.Context(), id, tenantID, body.Name, body.Email, nil)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, customer)
}

func (h *CustomerHandler) Archive(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "customer ID is not a valid UUID")
		return
	}

	if err := h.customers.Archive(r.Context(), id, tenantID); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{"status": "archived"})
}

func (h *CustomerHandler) GeneratePortalToken(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "customer ID is not a valid UUID")
		return
	}

	_, err = h.customers.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	token, err := middleware.GeneratePortalToken(id)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{
		"token":      token,
		"expires_in": "3600",
	})
}

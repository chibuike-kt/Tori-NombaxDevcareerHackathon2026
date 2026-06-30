package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type PlanHandler struct {
	plans domain.PlanRepository
}

func NewPlanHandler(plans domain.PlanRepository) *PlanHandler {
	return &PlanHandler{plans: plans}
}

func (h *PlanHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	var body struct {
		Name            string  `json:"name"`
		Description     *string `json:"description"`
		Amount          int64   `json:"amount"`
		Currency        string  `json:"currency"`
		Interval        string  `json:"interval"`
		IntervalCount   int     `json:"interval_count"`
		TrialPeriodDays int     `json:"trial_period_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if body.Name == "" {
		respond.BadRequest(w, r, "missing_field", "name is required")
		return
	}
	if body.Amount <= 0 {
		respond.BadRequest(w, r, "invalid_amount", "amount must be greater than zero")
		return
	}
	if body.Interval == "" {
		body.Interval = "monthly"
	}
	if body.IntervalCount == 0 {
		body.IntervalCount = 1
	}
	if body.Currency == "" {
		body.Currency = "NGN"
	}

	plan, err := h.plans.Create(r.Context(), tenantID, body.Name, body.Description, body.Amount, body.Currency, domain.PlanInterval(body.Interval), body.IntervalCount, body.TrialPeriodDays, nil)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusCreated, plan)
}

func (h *PlanHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	plans, err := h.plans.ListAll(r.Context(), tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	respond.List(w, r, http.StatusOK, plans, &respond.Pagination{Total: int64(len(plans))})
}

func (h *PlanHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "plan ID is not a valid UUID")
		return
	}

	plan, err := h.plans.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	respond.JSON(w, r, http.StatusOK, plan)
}

func (h *PlanHandler) Update(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "plan ID is not a valid UUID")
		return
	}

	var body struct {
		Name            string  `json:"name"`
		Description     *string `json:"description"`
		Amount          int64   `json:"amount"`
		TrialPeriodDays int     `json:"trial_period_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}

	plan, err := h.plans.Update(r.Context(), id, tenantID, body.Name, body.Description, body.Amount, body.TrialPeriodDays, nil)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, plan)
}

func (h *PlanHandler) Deactivate(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "plan ID is not a valid UUID")
		return
	}

	if err := h.plans.Deactivate(r.Context(), id, tenantID); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{"status": "deactivated"})
}

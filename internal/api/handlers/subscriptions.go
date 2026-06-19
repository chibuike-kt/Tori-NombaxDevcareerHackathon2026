package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/subscription"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type SubscriptionHandler struct {
	subs      domain.SubscriptionRepository
	plans     domain.PlanRepository
	customers domain.CustomerRepository
}

func NewSubscriptionHandler(subs domain.SubscriptionRepository, plans domain.PlanRepository, customers domain.CustomerRepository) *SubscriptionHandler {
	return &SubscriptionHandler{subs: subs, plans: plans, customers: customers}
}

func (h *SubscriptionHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	var body struct {
		CustomerID     string  `json:"customer_id"`
		PlanID         string  `json:"plan_id"`
		IdempotencyKey *string `json:"idempotency_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}

	customerID, err := uuid.Parse(body.CustomerID)
	if err != nil {
		respond.BadRequest(w, r, "invalid_customer_id", "customer_id is not a valid UUID")
		return
	}
	planID, err := uuid.Parse(body.PlanID)
	if err != nil {
		respond.BadRequest(w, r, "invalid_plan_id", "plan_id is not a valid UUID")
		return
	}

	plan, err := h.plans.GetByID(r.Context(), planID, tenantID)
	if err != nil {
		respond.BadRequest(w, r, "invalid_plan", "plan not found or inactive")
		return
	}

	_, err = h.customers.GetByID(r.Context(), customerID, tenantID)
	if err != nil {
		respond.BadRequest(w, r, "invalid_customer", "customer not found")
		return
	}

	// Check idempotency
	if body.IdempotencyKey != nil {
		existing, _ := h.subs.GetByIdempotencyKey(r.Context(), *body.IdempotencyKey, tenantID)
		if existing != nil {
			respond.JSON(w, r, http.StatusOK, existing)
			return
		}
	}

	now := timeNow()
	status := domain.StatusActive
	periodStart := now
	periodEnd, _, err := nextPeriod(plan, now)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	var trialEnd *timeType
	if plan.TrialPeriodDays > 0 {
		status = domain.StatusTrialing
		t := now.AddDate(0, 0, plan.TrialPeriodDays)
		trialEnd = &t
		periodEnd = t
	}

	sub, err := h.subs.Create(r.Context(), tenantID, customerID, planID, status, periodStart, periodEnd, trialEnd, body.IdempotencyKey, nil)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusCreated, sub)
}

func (h *SubscriptionHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit == 0 {
		limit = 20
	}

	status := r.URL.Query().Get("status")
	if status != "" {
		subs, err := h.subs.ListByStatus(r.Context(), tenantID, domain.SubscriptionStatus(status), limit, offset)
		if err != nil {
			respond.InternalError(w, r, err)
			return
		}
		respond.List(w, r, http.StatusOK, subs, &respond.Pagination{Total: int64(len(subs))})
		return
	}

	subs, err := h.subs.List(r.Context(), tenantID, limit, offset)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	respond.List(w, r, http.StatusOK, subs, &respond.Pagination{Total: int64(len(subs))})
}

func (h *SubscriptionHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	sub, err := h.subs.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	respond.JSON(w, r, http.StatusOK, sub)
}

func (h *SubscriptionHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	sub, err := h.subs.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	_, err = subscription.Transition(sub.Status, subscription.EventCustomerCancelled)
	if err != nil {
		respond.UnprocessableEntity(w, r, "invalid_transition", err.Error())
		return
	}

	updated, err := h.subs.Cancel(r.Context(), id, tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, updated)
}

func (h *SubscriptionHandler) Pause(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	sub, err := h.subs.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	_, err = subscription.Transition(sub.Status, subscription.EventCustomerPaused)
	if err != nil {
		respond.UnprocessableEntity(w, r, "invalid_transition", err.Error())
		return
	}

	updated, err := h.subs.Pause(r.Context(), id, tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, updated)
}

func (h *SubscriptionHandler) Resume(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	sub, err := h.subs.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	_, err = subscription.Transition(sub.Status, subscription.EventCustomerResumed)
	if err != nil {
		respond.UnprocessableEntity(w, r, "invalid_transition", err.Error())
		return
	}

	updated, err := h.subs.Resume(r.Context(), id, tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, updated)
}

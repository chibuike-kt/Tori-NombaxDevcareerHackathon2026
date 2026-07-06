package handlers

import (
	"net/http"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/finops"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
)

type FinOpsHandler struct {
	svc       *finops.Service
	subs      domain.SubscriptionRepository
	customers domain.CustomerRepository
	plans     domain.PlanRepository
}

func NewFinOpsHandler(svc *finops.Service, subs domain.SubscriptionRepository, customers domain.CustomerRepository, plans domain.PlanRepository) *FinOpsHandler {
	return &FinOpsHandler{svc: svc, subs: subs, customers: customers, plans: plans}
}

func (h *FinOpsHandler) MRR(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	period := parsePeriod(r)
	mode := middleware.GetMode(r.Context())

	result, err := h.svc.GetMRR(r.Context(), tenantID, period, mode)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, result)
}

func (h *FinOpsHandler) RecoveryCenter(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	from, to := parseDateRange(r)
	mode := middleware.GetMode(r.Context())
	result, err := h.svc.GetRecoveryCenter(r.Context(), tenantID, h.subs, h.customers, h.plans, from, to, mode)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	respond.JSON(w, r, http.StatusOK, result)
}

func (h *FinOpsHandler) ARR(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	period := parsePeriod(r)
	mode := middleware.GetMode(r.Context())

	result, err := h.svc.GetARR(r.Context(), tenantID, period, mode)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, result)
}

func (h *FinOpsHandler) Churn(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	from, to := parseDateRange(r)
	mode := middleware.GetMode(r.Context())

	result, err := h.svc.GetChurn(r.Context(), tenantID, from, to, mode)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, result)
}

func (h *FinOpsHandler) DunningRecovery(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	from, to := parseDateRange(r)
	mode := middleware.GetMode(r.Context())

	result, err := h.svc.GetDunningRecovery(r.Context(), tenantID, from, to, mode)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, result)
}

func (h *FinOpsHandler) RevenueReport(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	from, to := parseDateRange(r)
	mode := middleware.GetMode(r.Context())

	result, err := h.svc.GetRevenueReport(r.Context(), tenantID, from, to, mode)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, result)
}

func parsePeriod(r *http.Request) time.Time {
	if p := r.URL.Query().Get("period"); p != "" {
		if t, err := time.Parse("2006-01", p); err == nil {
			return t
		}
	}
	return time.Now()
}

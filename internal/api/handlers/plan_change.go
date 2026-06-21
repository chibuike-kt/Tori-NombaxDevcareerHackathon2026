package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/billing"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/ledger"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type PlanChangeHandler struct {
	subs      domain.SubscriptionRepository
	plans     domain.PlanRepository
	ledgerSvc *ledger.Service
}

func NewPlanChangeHandler(
	subs domain.SubscriptionRepository,
	plans domain.PlanRepository,
	ledgerSvc *ledger.Service,
) *PlanChangeHandler {
	return &PlanChangeHandler{subs: subs, plans: plans, ledgerSvc: ledgerSvc}
}

type planChangeRequest struct {
	PlanID string `json:"plan_id"`
}

type planChangeResponse struct {
	Subscription *domain.Subscription   `json:"subscription"`
	Proration    billing.ProrationResult `json:"proration"`
	NetAdjustmentKobo int64             `json:"net_adjustment_kobo"`
	Description  string                 `json:"description"`
}

// ChangePlan handles mid-cycle plan changes with proration.
// Computes the exact credit for unused days on the old plan
// and the charge for remaining days on the new plan.
// Both are recorded in the immutable ledger.
func (h *PlanChangeHandler) ChangePlan(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	subID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	var body planChangeRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if body.PlanID == "" {
		respond.BadRequest(w, r, "missing_field", "plan_id is required")
		return
	}

	newPlanID, err := uuid.Parse(body.PlanID)
	if err != nil {
		respond.BadRequest(w, r, "invalid_field", "plan_id is not a valid UUID")
		return
	}

	sub, err := h.subs.GetByID(r.Context(), subID, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			respond.NotFound(w, r)
			return
		}
		respond.InternalError(w, r, err)
		return
	}

	if sub.Status != domain.StatusActive {
		respond.UnprocessableEntity(w, r, "invalid_status",
			"plan changes are only allowed on active subscriptions")
		return
	}

	oldPlan, err := h.plans.GetByID(r.Context(), sub.PlanID, tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	newPlan, err := h.plans.GetByID(r.Context(), newPlanID, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			respond.NotFound(w, r)
			return
		}
		respond.InternalError(w, r, err)
		return
	}

	if !newPlan.IsActive {
		respond.UnprocessableEntity(w, r, "plan_inactive",
			"the target plan is no longer accepting new subscriptions")
		return
	}

	if oldPlan.ID == newPlan.ID {
		respond.BadRequest(w, r, "same_plan",
			"subscription is already on this plan")
		return
	}

	// Compute proration
	now := time.Now().UTC()
	proration := billing.Calculate(
		now,
		sub.CurrentPeriodStart,
		sub.CurrentPeriodEnd,
		oldPlan,
		newPlan,
	)

	// Write proration to ledger
	ik := "proration-" + subID.String() + "-" + newPlanID.String()

	if proration.NetAdjustment > 0 {
		// Upgrade: charge the difference
		_, err = h.ledgerSvc.RecordProration(
			r.Context(),
			tenantID,
			subID,
			sub.CustomerID,
			proration.NetAdjustment,
			oldPlan.Currency,
			ik,
		)
	} else if proration.NetAdjustment < 0 {
		// Downgrade: apply credit
		credit := -proration.NetAdjustment
		_, err = h.ledgerSvc.RecordCredit(
			r.Context(),
			tenantID,
			subID,
			sub.CustomerID,
			credit,
			oldPlan.Currency,
			ik+"-credit",
		)
	}
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	// Update subscription plan
	updated, err := h.subs.UpdatePlan(r.Context(), subID, tenantID, newPlanID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	description := "Plan changed"
	if proration.NetAdjustment > 0 {
		description = "Upgraded plan — proration charge applied"
	} else if proration.NetAdjustment < 0 {
		description = "Downgraded plan — credit applied"
	}

	respond.JSON(w, r, http.StatusOK, planChangeResponse{
		Subscription:      updated,
		Proration:         proration,
		NetAdjustmentKobo: proration.NetAdjustment,
		Description:       description,
	})
}

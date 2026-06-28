package handlers

import (
	"net/http"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/finops"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/ledger"
	"github.com/google/uuid"
)

type MetricsHandler struct {
	subs      domain.SubscriptionRepository
	jobs      domain.JobRepository
	ledgerSvc *ledger.Service
	finopsSvc *finops.Service
}

func NewMetricsHandler(
	subs domain.SubscriptionRepository,
	jobs domain.JobRepository,
	ledgerSvc *ledger.Service,
	finopsSvc *finops.Service,
) *MetricsHandler {
	return &MetricsHandler{
		subs:      subs,
		jobs:      jobs,
		ledgerSvc: ledgerSvc,
		finopsSvc: finopsSvc,
	}
}

// GetMetrics returns operational metrics for the authenticated tenant.
// GET /v1/metrics
func (h *MetricsHandler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == uuid.Nil {
		respond.Unauthorised(w, r, "missing tenant")
		return
	}

	now := time.Now().UTC()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	monthEnd := monthStart.AddDate(0, 1, 0)

	// Subscription counts by status
	statusCounts := map[string]int{}
	allSubs, _ := h.subs.List(r.Context(), tenantID, 1000, 0)
	for _, s := range allSubs {
		statusCounts[string(s.Status)]++
	}

	// MRR
	var mrrKobo int64
	mrrResult, err := h.finopsSvc.GetMRR(r.Context(), tenantID, now)
	if err == nil {
		mrrKobo = mrrResult.MRRKobo
	}

	// Revenue this month
	summary, _ := h.ledgerSvc.GetSummary(r.Context(), tenantID, monthStart, monthEnd)

	// Job queue depth
	var queueDepth int64
	if depth, err := h.jobs.GetQueueDepth(r.Context()); err == nil {
		queueDepth = depth
	}

	// Failed jobs
	failedJobs, _ := h.jobs.ListFailed(r.Context(), 10, 0)

	// Charge success rate — approximated from ledger entries this month
	chargeSuccessRate := 0.0
	if summary != nil && summary.TotalCharged > 0 {
		// TotalCharged = successful charges, TotalRefunded = refunds
		// Success rate approximated from charged vs at-risk
		dunningCount := statusCounts["DUNNING"] + statusCounts["PAST_DUE"] + statusCounts["GRACE_PERIOD"]
		totalAttempted := len(allSubs)
		if totalAttempted > 0 {
			chargeSuccessRate = float64(totalAttempted-dunningCount) / float64(totalAttempted) * 100
		}
	}

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"period": map[string]string{
			"from": monthStart.Format("2006-01-02"),
			"to":   monthEnd.Format("2006-01-02"),
		},
		"subscriptions": map[string]interface{}{
			"total":          len(allSubs),
			"by_status":      statusCounts,
			"active":         statusCounts["ACTIVE"],
			"trialing":       statusCounts["TRIALING"],
			"pending_payment": statusCounts["PENDING_PAYMENT"],
			"dunning":        statusCounts["DUNNING"] + statusCounts["PAST_DUE"] + statusCounts["GRACE_PERIOD"],
			"suspended":      statusCounts["SUSPENDED"],
			"cancelled":      statusCounts["CANCELLED"],
		},
		"revenue": map[string]interface{}{
			"mrr_kobo":          mrrKobo,
			"mrr_naira":         float64(mrrKobo) / 100,
			"gross_this_month":  summary.TotalCharged,
			"refunds_this_month": summary.TotalRefunded,
			"net_this_month":    summary.TotalCharged - summary.TotalRefunded,
		},
		"billing": map[string]interface{}{
			"charge_success_rate_pct": chargeSuccessRate,
			"at_risk_count":          statusCounts["DUNNING"] + statusCounts["PAST_DUE"] + statusCounts["GRACE_PERIOD"],
		},
		"worker": map[string]interface{}{
			"queue_depth":       queueDepth,
			"failed_jobs_count": len(failedJobs),
		},
		"generated_at": now.Format(time.RFC3339),
	})
}

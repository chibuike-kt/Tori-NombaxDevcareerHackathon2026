package handlers

import (
	"net/http"
	"strconv"

	apicontext "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/context"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/billing"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
)

type HealthHandler struct {
	subs domain.SubscriptionRepository
}

func NewHealthHandler(subs domain.SubscriptionRepository) *HealthHandler {
	return &HealthHandler{subs: subs}
}

type subscriptionWithHealth struct {
	*domain.Subscription
	Health billing.HealthScore `json:"health"`
}

type portfolioHealth struct {
	AverageScore    int                      `json:"average_score"`
	HealthyCount    int                      `json:"healthy_count"`
	AtRiskCount     int                      `json:"at_risk_count"`
	CriticalCount   int                      `json:"critical_count"`
	Subscriptions   []subscriptionWithHealth `json:"subscriptions"`
}

// GetPortfolioHealth returns health scores for all subscriptions
// plus a portfolio-level summary.
func (h *HealthHandler) GetPortfolioHealth(w http.ResponseWriter, r *http.Request) {
	tenantID := apicontext.GetTenantID(r.Context())
	if tenantID == uuid.Nil {
		respond.Unauthorised(w, r, "missing tenant")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 100
	}

	subs, err := h.subs.List(r.Context(), tenantID, limit, 0)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	result := make([]subscriptionWithHealth, 0, len(subs))
	totalScore := 0
	healthyCount := 0
	atRiskCount := 0
	criticalCount := 0

	for _, sub := range subs {
		if sub.Status == domain.StatusCancelled {
			continue
		}
		hs := billing.ComputeHealth(sub)
		result = append(result, subscriptionWithHealth{
			Subscription: sub,
			Health:       hs,
		})
		totalScore += hs.Score
		switch {
		case hs.Score >= 70:
			healthyCount++
		case hs.Score >= 30:
			atRiskCount++
		default:
			criticalCount++
		}
	}

	avgScore := 0
	if len(result) > 0 {
		avgScore = totalScore / len(result)
	}

	respond.JSON(w, r, http.StatusOK, portfolioHealth{
		AverageScore:  avgScore,
		HealthyCount:  healthyCount,
		AtRiskCount:   atRiskCount,
		CriticalCount: criticalCount,
		Subscriptions: result,
	})
}

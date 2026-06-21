package billing

import (
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
)

type ChurnSignal string

const (
	SignalNone     ChurnSignal = "none"
	SignalLow      ChurnSignal = "low"
	SignalMedium   ChurnSignal = "medium"
	SignalHigh     ChurnSignal = "high"
	SignalCritical ChurnSignal = "critical"
)

type ChurnPrediction struct {
	Signal          ChurnSignal `json:"signal"`
	Score           int         `json:"score"`
	Reasons         []string    `json:"reasons"`
	RecommendedAction string    `json:"recommended_action"`
}

// PredictChurn analyses a subscription's history and current state
// to produce a churn risk signal before the customer actually cancels.
func PredictChurn(sub *domain.Subscription) ChurnPrediction {
	score := 0
	reasons := []string{}

	// Current state signals
	switch sub.Status {
	case domain.StatusSuspended:
		score += 70
		reasons = append(reasons, "Subscription is suspended after exhausted retries")
	case domain.StatusDunning:
		score += 50
		reasons = append(reasons, "Payment failing and retries are in progress")
	case domain.StatusPastDue:
		score += 30
		reasons = append(reasons, "Payment overdue")
	case domain.StatusPaused:
		score += 20
		reasons = append(reasons, "Customer paused the subscription")
	case domain.StatusCancelled:
		score = 100
		return ChurnPrediction{
			Signal:            SignalCritical,
			Score:             100,
			Reasons:           []string{"Subscription already cancelled"},
			RecommendedAction: "Offer a win-back campaign or discounted restart",
		}
	}

	// Dunning depth — deeper = higher churn risk
	if sub.DunningAttempt >= 3 {
		score += 25
		reasons = append(reasons, "Three or more failed payment attempts")
	} else if sub.DunningAttempt == 2 {
		score += 15
		reasons = append(reasons, "Two failed payment attempts")
	} else if sub.DunningAttempt == 1 {
		score += 8
		reasons = append(reasons, "One failed payment attempt")
	}

	// Previously recovered from dunning but now active — pattern of instability
	if sub.Status == domain.StatusActive && sub.DunningAttempt > 0 {
		score += 15
		reasons = append(reasons, "Recovered from dunning but has history of payment failures")
	}

	// Subscription approaching period end with unresolved payment
	if sub.NextRetryAt != nil {
		daysUntilRetry := time.Until(*sub.NextRetryAt).Hours() / 24
		if daysUntilRetry < 3 {
			score += 10
			reasons = append(reasons, "Next payment retry is imminent")
		}
	}

	// Short subscription lifetime — customer never fully committed
	ageDays := time.Since(sub.CreatedAt).Hours() / 24
	if ageDays < 14 && sub.Status != domain.StatusTrialing {
		score += 10
		reasons = append(reasons, "Subscription is less than 14 days old with payment issues")
	}

	// Period end approaching with dunning active
	daysUntilEnd := time.Until(sub.CurrentPeriodEnd).Hours() / 24
	if daysUntilEnd < 7 && sub.DunningAttempt > 0 {
		score += 15
		reasons = append(reasons, "Billing period ends soon with unresolved payment failure")
	}

	// Cap at 100
	if score > 100 {
		score = 100
	}

	signal, action := churnSignalFromScore(score)

	if len(reasons) == 0 {
		reasons = []string{"No churn signals detected"}
	}

	return ChurnPrediction{
		Signal:            signal,
		Score:             score,
		Reasons:           reasons,
		RecommendedAction: action,
	}
}

func churnSignalFromScore(score int) (ChurnSignal, string) {
	switch {
	case score >= 70:
		return SignalCritical, "Contact the customer immediately. Offer a payment method update link or a temporary discount to prevent cancellation."
	case score >= 50:
		return SignalHigh, "Send a proactive email offering help with payment. Consider a short pause rather than losing the customer entirely."
	case score >= 30:
		return SignalMedium, "Monitor closely. Send a payment reminder and check if the card needs updating."
	case score >= 10:
		return SignalLow, "Minor signal. No immediate action required but keep an eye on the next billing cycle."
	default:
		return SignalNone, "No action needed. Subscription is healthy."
	}
}

package billing

import (
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
)

type HealthScore struct {
	Score  int    `json:"score"`
	Label  string `json:"label"`
	Color  string `json:"color"`
	Reason string `json:"reason"`
}

// ComputeHealth calculates a 0-100 billing health score for a subscription.
// Higher is healthier. The score is computed from the current state,
// dunning history, and subscription age.
func ComputeHealth(sub *domain.Subscription) HealthScore {
	score := 100
	reason := "Subscription is current and healthy"

	switch sub.Status {
	case domain.StatusSuspended:
		score -= 60
		reason = "All payment retries exhausted. Access suspended."
	case domain.StatusDunning:
		score -= 40
		reason = "Payment failed. Retries in progress."
	case domain.StatusPastDue:
		score -= 20
		reason = "Payment overdue. Grace period active."
	case domain.StatusPaused:
		score -= 10
		reason = "Subscription paused by customer or merchant."
	case domain.StatusCancelled:
		score = 0
		reason = "Subscription cancelled."
		return bounded(score, sub, reason)
	case domain.StatusTrialing:
		reason = "Customer is in free trial. No payment attempted yet."
	}

	// Additional deduction for dunning attempt depth
	switch sub.DunningAttempt {
	case 1:
		score -= 10
	case 2:
		score -= 20
	case 3:
		score -= 30
	default:
		if sub.DunningAttempt >= 4 {
			score -= 40
		}
	}

	// New subscription penalty — unproven payment relationship
// New subscription penalty — only for non-active states or no payment confirmed
		age := time.Since(sub.CreatedAt).Hours() / 24
		if age < 30 && sub.Status != domain.StatusActive {
				score -= 5
				if reason == "Subscription is current and healthy" {
						reason = "New subscription. First payment not yet proven."
				}
		} else if age < 30 && sub.Status == domain.StatusActive {
				// Active and paid — no penalty, just note it's new
				if reason == "Subscription is current and healthy" {
						reason = "New subscription. Payment confirmed."
				}
		}

	// Previously recovered from dunning but now active — history of failure
	if sub.Status == domain.StatusActive && sub.DunningAttempt > 0 {
		score -= 10
		reason = "Active but has a history of payment failures."
	}

	return bounded(score, sub, reason)
}

func bounded(score int, sub *domain.Subscription, reason string) HealthScore {
	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}

	label, color := scoreLabel(score)
	if sub.Status == domain.StatusActive && sub.DunningAttempt == 0 {
		label = "Healthy"
		color = "#00B37E"
	}

	return HealthScore{
		Score:  score,
		Label:  label,
		Color:  color,
		Reason: reason,
	}
}

func scoreLabel(score int) (string, string) {
	switch {
	case score >= 90:
		return "Healthy", "#00B37E"
	case score >= 70:
		return "Good", "#16A34A"
	case score >= 50:
		return "Fair", "#D97706"
	case score >= 30:
		return "At risk", "#EA580C"
	default:
		return "Critical", "#DC2626"
	}
}

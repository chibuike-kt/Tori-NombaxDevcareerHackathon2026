package handlers

import (
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/billing"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
)

type timeType = time.Time

func timeNow() time.Time {
	return time.Now().UTC()
}

func nextPeriod(plan *domain.Plan, from time.Time) (time.Time, time.Time, error) {
	return billing.NextPeriod(from, plan)
}

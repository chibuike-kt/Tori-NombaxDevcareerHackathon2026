package events

import (
	"context"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// Recorder is a thin, fire-and-forget wrapper around EventRepository — both
// API handlers and the worker call Record() alongside their normal
// success path; a failure to record an activity-feed entry never fails the
// underlying request or job. A nil *Recorder is safe to call Record on.
type Recorder struct {
	repo domain.EventRepository
}

func NewRecorder(repo domain.EventRepository) *Recorder {
	return &Recorder{repo: repo}
}

func (r *Recorder) Record(ctx context.Context, tenantID uuid.UUID, mode string, eventType domain.WebhookEventType, resourceType string, resourceID uuid.UUID, description string) {
	if r == nil || r.repo == nil {
		return
	}
	rid := resourceID
	if _, err := r.repo.Create(ctx, tenantID, mode, string(eventType), resourceType, &rid, description, nil); err != nil {
		log.Error().Err(err).Str("event_type", string(eventType)).Msg("events: failed to record")
	}
}

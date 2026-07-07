package postgres

import (
	"context"
	"fmt"

	db "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type EventRepo struct {
	q *db.Queries
}

func NewEventRepo(pool *pgxpool.Pool) *EventRepo {
	return &EventRepo{q: db.New(pool)}
}

func eventFromRow(row db.Event) *domain.Event {
	e := &domain.Event{
		ID:           row.ID,
		TenantID:     row.TenantID,
		Mode:         row.Mode,
		EventType:    row.EventType,
		ResourceType: row.ResourceType,
		Description:  row.Description,
		Metadata:     row.Metadata,
		CreatedAt:    row.CreatedAt,
	}
	if row.ResourceID.Valid {
		id := row.ResourceID.Bytes
		u := uuid.UUID(id)
		e.ResourceID = &u
	}
	return e
}

func (r *EventRepo) Create(ctx context.Context, tenantID uuid.UUID, mode, eventType, resourceType string, resourceID *uuid.UUID, description string, metadata []byte) (*domain.Event, error) {
	row, err := r.q.CreateEvent(ctx, db.CreateEventParams{
		TenantID:     tenantID,
		Mode:         mode,
		EventType:    eventType,
		ResourceType: resourceType,
		ResourceID:   toPgUUID(resourceID),
		Description:  description,
		Metadata:     metadata,
	})
	if err != nil {
		return nil, fmt.Errorf("create event: %w", err)
	}
	return eventFromRow(row), nil
}

func (r *EventRepo) List(ctx context.Context, tenantID uuid.UUID, mode string, limit, offset int) ([]*domain.Event, error) {
	rows, err := r.q.ListEvents(ctx, db.ListEventsParams{
		TenantID: tenantID,
		Mode:     mode,
		Limit:    int32(limit),
		Offset:   int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("list events: %w", err)
	}
	events := make([]*domain.Event, len(rows))
	for i, row := range rows {
		events[i] = eventFromRow(row)
	}
	return events, nil
}

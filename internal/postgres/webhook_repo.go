package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type WebhookRepo struct {
	q *db.Queries
}

func NewWebhookRepo(pool *pgxpool.Pool) *WebhookRepo {
	return &WebhookRepo{q: db.New(pool)}
}

func (r *WebhookRepo) CreateEndpoint(ctx context.Context, tenantID uuid.UUID, url string, events []string, secret, apiVersion string) (*domain.WebhookEndpoint, error) {
	row, err := r.q.CreateWebhookEndpoint(ctx, db.CreateWebhookEndpointParams{
		TenantID:   tenantID,
		Url:        url,
		Events:     events,
		Secret:     secret,
		ApiVersion: apiVersion,
	})
	if err != nil {
		return nil, err
	}
	return endpointFromRow(row), nil
}

func (r *WebhookRepo) GetEndpointByID(ctx context.Context, id, tenantID uuid.UUID) (*domain.WebhookEndpoint, error) {
	row, err := r.q.GetWebhookEndpointByID(ctx, db.GetWebhookEndpointByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return endpointFromRow(row), nil
}

func (r *WebhookRepo) ListEndpoints(ctx context.Context, tenantID uuid.UUID) ([]*domain.WebhookEndpoint, error) {
	rows, err := r.q.ListWebhookEndpoints(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	endpoints := make([]*domain.WebhookEndpoint, len(rows))
	for i, row := range rows {
		endpoints[i] = endpointFromRow(row)
	}
	return endpoints, nil
}

func (r *WebhookRepo) UpdateEndpoint(ctx context.Context, id, tenantID uuid.UUID, url string, events []string, isActive bool) (*domain.WebhookEndpoint, error) {
	row, err := r.q.UpdateWebhookEndpoint(ctx, db.UpdateWebhookEndpointParams{
		ID:       id,
		TenantID: tenantID,
		Url:      url,
		Events:   events,
		IsActive: isActive,
	})
	if err != nil {
		return nil, err
	}
	return endpointFromRow(row), nil
}

func (r *WebhookRepo) DeleteEndpoint(ctx context.Context, id, tenantID uuid.UUID) error {
	return r.q.DeleteWebhookEndpoint(ctx, db.DeleteWebhookEndpointParams{ID: id, TenantID: tenantID})
}

func (r *WebhookRepo) CreateDelivery(ctx context.Context, endpointID, tenantID uuid.UUID, eventType, apiVersion string, payload []byte, status string) (*domain.WebhookDelivery, error) {
	row, err := r.q.CreateWebhookDelivery(ctx, db.CreateWebhookDeliveryParams{
		EndpointID: endpointID,
		TenantID:   tenantID,
		EventType:  eventType,
		ApiVersion: apiVersion,
		Payload:    payload,
		Status:     status,
	})
	if err != nil {
		return nil, err
	}
	return deliveryFromRow(row), nil
}

func (r *WebhookRepo) GetDeliveryByID(ctx context.Context, id, tenantID uuid.UUID) (*domain.WebhookDelivery, error) {
	row, err := r.q.GetWebhookDeliveryByID(ctx, db.GetWebhookDeliveryByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return deliveryFromRow(row), nil
}

func (r *WebhookRepo) ListDeliveries(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*domain.WebhookDelivery, error) {
	rows, err := r.q.ListWebhookDeliveries(ctx, db.ListWebhookDeliveriesParams{
		TenantID: tenantID,
		Limit:    int32(limit),
		Offset:   int32(offset),
	})
	if err != nil {
		return nil, err
	}
	deliveries := make([]*domain.WebhookDelivery, len(rows))
	for i, row := range rows {
		deliveries[i] = deliveryFromRow(row)
	}
	return deliveries, nil
}

func (r *WebhookRepo) MarkDeliverySuccess(ctx context.Context, id uuid.UUID, responseStatus int, responseBody string) error {
	return r.q.MarkDeliverySuccess(ctx, db.MarkDeliverySuccessParams{
		ID:             id,
		ResponseStatus: pgtype.Int4{Int32: int32(responseStatus), Valid: true},
		ResponseBody:   toPgText(&responseBody),
	})
}

func (r *WebhookRepo) MarkDeliveryFailed(ctx context.Context, id uuid.UUID, responseStatus int, responseBody string, nextRetryAt time.Time) error {
	return r.q.MarkDeliveryFailed(ctx, db.MarkDeliveryFailedParams{
		ID:             id,
		ResponseStatus: pgtype.Int4{Int32: int32(responseStatus), Valid: true},
		ResponseBody:   toPgText(&responseBody),
		NextRetryAt:    toPgTimestamptz(&nextRetryAt),
	})
}

func (r *WebhookRepo) ListFailedDeliveriesDue(ctx context.Context, limit int) ([]*domain.WebhookDelivery, error) {
	rows, err := r.q.ListFailedDeliveriesDue(ctx, int32(limit))
	if err != nil {
		return nil, err
	}
	deliveries := make([]*domain.WebhookDelivery, len(rows))
	for i, row := range rows {
		deliveries[i] = deliveryFromRow(row)
	}
	return deliveries, nil
}

func (r *WebhookRepo) ListDeliveriesByEventTypeAndDateRange(ctx context.Context, tenantID uuid.UUID, eventTypes []string, from, to time.Time) ([]*domain.WebhookDelivery, error) {
	rows, err := r.q.ListDeliveriesByEventTypeAndDateRange(ctx, db.ListDeliveriesByEventTypeAndDateRangeParams{
		TenantID:    tenantID,
		Column2:     eventTypes,
		CreatedAt:   from,
		CreatedAt_2: to,
	})
	if err != nil {
		return nil, err
	}
	deliveries := make([]*domain.WebhookDelivery, len(rows))
	for i, row := range rows {
		deliveries[i] = deliveryFromRow(row)
	}
	return deliveries, nil
}

func endpointFromRow(row db.WebhookEndpoint) *domain.WebhookEndpoint {
	return &domain.WebhookEndpoint{
		ID:         row.ID,
		TenantID:   row.TenantID,
		URL:        row.Url,
		Events:     row.Events,
		Secret:     row.Secret,
		APIVersion: row.ApiVersion,
		IsActive:   row.IsActive,
		CreatedAt:  row.CreatedAt,
	}
}

func deliveryFromRow(row db.WebhookDelivery) *domain.WebhookDelivery {
	var responseStatus *int
	if row.ResponseStatus.Valid {
		v := int(row.ResponseStatus.Int32)
		responseStatus = &v
	}
	return &domain.WebhookDelivery{
		ID:             row.ID,
		EndpointID:     row.EndpointID,
		TenantID:       row.TenantID,
		EventType:      row.EventType,
		APIVersion:     row.ApiVersion,
		Payload:        row.Payload,
		Status:         row.Status,
		ResponseStatus: responseStatus,
		ResponseBody:   fromPgText(row.ResponseBody),
		AttemptCount:   int(row.AttemptCount),
		NextRetryAt:    fromPgTimestamptz(row.NextRetryAt),
		CreatedAt:      row.CreatedAt,
	}
}

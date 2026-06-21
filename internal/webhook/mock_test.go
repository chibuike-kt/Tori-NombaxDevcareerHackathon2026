package webhook_test

import (
	"context"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
)

type mockWebhookRepo struct {
	endpointURL string
	deliveries  []*domain.WebhookDelivery
}

func (m *mockWebhookRepo) ListEndpoints(_ context.Context, _ uuid.UUID) ([]*domain.WebhookEndpoint, error) {
	return []*domain.WebhookEndpoint{
		{
			ID:       uuid.New(),
			TenantID: testTenantID,
			URL:      m.endpointURL,
			Events:   []string{"*"},
			Secret:   "test-secret",
			IsActive: true,
		},
	}, nil
}

func (m *mockWebhookRepo) CreateDelivery(_ context.Context, endpointID, tenantID uuid.UUID, eventType, apiVersion string, payload []byte, status string) (*domain.WebhookDelivery, error) {
	d := &domain.WebhookDelivery{
		ID:         uuid.New(),
		EndpointID: endpointID,
		TenantID:   tenantID,
		EventType:  eventType,
		APIVersion: apiVersion,
		Payload:    payload,
		Status:     status,
		CreatedAt:  time.Now(),
	}
	m.deliveries = append(m.deliveries, d)
	return d, nil
}

func (m *mockWebhookRepo) MarkDeliverySuccess(_ context.Context, _ uuid.UUID, _ int, _ string) error {
	return nil
}
func (m *mockWebhookRepo) MarkDeliveryFailed(_ context.Context, _ uuid.UUID, _ int, _ string, _ time.Time) error {
	return nil
}
func (m *mockWebhookRepo) CreateEndpoint(_ context.Context, _ uuid.UUID, _ string, _ []string, _, _ string) (*domain.WebhookEndpoint, error) {
	return nil, nil
}
func (m *mockWebhookRepo) GetEndpointByID(_ context.Context, _, _ uuid.UUID) (*domain.WebhookEndpoint, error) {
	return nil, nil
}
func (m *mockWebhookRepo) UpdateEndpoint(_ context.Context, _, _ uuid.UUID, _ string, _ []string, _ bool) (*domain.WebhookEndpoint, error) {
	return nil, nil
}
func (m *mockWebhookRepo) DeleteEndpoint(_ context.Context, _, _ uuid.UUID) error { return nil }
func (m *mockWebhookRepo) GetDeliveryByID(_ context.Context, _, _ uuid.UUID) (*domain.WebhookDelivery, error) {
	return nil, nil
}
func (m *mockWebhookRepo) ListDeliveries(_ context.Context, _ uuid.UUID, _, _ int) ([]*domain.WebhookDelivery, error) {
	return nil, nil
}
func (m *mockWebhookRepo) ListFailedDeliveriesDue(_ context.Context, _ int) ([]*domain.WebhookDelivery, error) {
	return nil, nil
}
func (m *mockWebhookRepo) ListDeliveriesByEventTypeAndDateRange(_ context.Context, _ uuid.UUID, _ []string, _, _ time.Time) ([]*domain.WebhookDelivery, error) {
	return nil, nil
}

func (m *mockWebhookRepo) DisableWebhookEndpoint(_ context.Context, _ uuid.UUID) error {
	return nil
}

func (m *mockWebhookRepo) CountRecentFailedDeliveries(_ context.Context, _ uuid.UUID) (int64, error) {
	return 0, nil
}

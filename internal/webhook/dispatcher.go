package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

const apiVersion = "2026-06-19"

type Event struct {
	ID        string               `json:"id"`
	APIVersion string              `json:"api_version"`
	EventType string               `json:"event_type"`
	TenantID  string               `json:"tenant_id"`
	CreatedAt time.Time            `json:"created_at"`
	Data      interface{}          `json:"data"`
}

type Dispatcher struct {
	repo   domain.WebhookRepository
	client *http.Client
}

func NewDispatcher(repo domain.WebhookRepository) *Dispatcher {
	return &Dispatcher{
		repo: repo,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

// Dispatch sends an event to all active endpoints subscribed to the event type.
func (d *Dispatcher) Dispatch(ctx context.Context, tenantID uuid.UUID, eventType domain.WebhookEventType, data interface{}) error {
	endpoints, err := d.repo.ListEndpoints(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("listing endpoints: %w", err)
	}

	event := Event{
		ID:         "evt_" + uuid.New().String(),
		APIVersion: apiVersion,
		EventType:  string(eventType),
		TenantID:   tenantID.String(),
		CreatedAt:  time.Now().UTC(),
		Data:       data,
	}

	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshaling event: %w", err)
	}

	for _, endpoint := range endpoints {
		if !isSubscribed(endpoint, string(eventType)) {
			continue
		}
		if err := d.deliver(ctx, endpoint, tenantID, string(eventType), payload); err != nil {
			log.Error().Err(err).
				Str("endpoint_id", endpoint.ID.String()).
				Str("event_type", string(eventType)).
				Msg("webhook delivery failed")
		}
	}
	return nil
}

func (d *Dispatcher) deliver(ctx context.Context, endpoint *domain.WebhookEndpoint, tenantID uuid.UUID, eventType string, payload []byte) error {
	delivery, err := d.repo.CreateDelivery(ctx, endpoint.ID, tenantID, eventType, apiVersion, payload, "pending")
	if err != nil {
		return fmt.Errorf("creating delivery record: %w", err)
	}

	sig := sign(endpoint.Secret, payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.URL, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tori-Signature", "sha256="+sig)
	req.Header.Set("X-Tori-Event", eventType)
	req.Header.Set("X-Tori-API-Version", apiVersion)

	resp, err := d.client.Do(req)
	if err != nil {
		nextRetry := time.Now().Add(5 * time.Minute)
		_ = d.repo.MarkDeliveryFailed(ctx, delivery.ID, 0, err.Error(), nextRetry)
		d.checkCircuitBreaker(ctx, endpoint.ID)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		_ = d.repo.MarkDeliverySuccess(ctx, delivery.ID, resp.StatusCode, "")
		return nil
	}

	nextRetry := nextRetryAt(delivery.AttemptCount + 1)
	_ = d.repo.MarkDeliveryFailed(ctx, delivery.ID, resp.StatusCode, fmt.Sprintf("non-2xx status: %d", resp.StatusCode), nextRetry)
	d.checkCircuitBreaker(ctx, endpoint.ID)
	return fmt.Errorf("endpoint returned %d", resp.StatusCode)
}

// checkCircuitBreaker disables an endpoint if it has failed 10+ times in 24 hours.
func (d *Dispatcher) checkCircuitBreaker(ctx context.Context, endpointID uuid.UUID) {
	count, err := d.repo.CountRecentFailedDeliveries(ctx, endpointID)
	if err != nil {
		return
	}
	if count >= 10 {
		_ = d.repo.DisableWebhookEndpoint(ctx, endpointID)
		log.Warn().
			Str("endpoint_id", endpointID.String()).
			Int64("failure_count", count).
			Msg("webhook endpoint disabled after 10 consecutive failures in 24 hours")
	}
}

// sign produces HMAC-SHA256 signature of the payload using the endpoint secret.
func sign(secret string, payload []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

// Verify checks an inbound signature against the payload.
func Verify(secret, signature string, payload []byte) bool {
	expected := "sha256=" + sign(secret, payload)
	return hmac.Equal([]byte(expected), []byte(signature))
}

func isSubscribed(endpoint *domain.WebhookEndpoint, eventType string) bool {
	for _, e := range endpoint.Events {
		if e == eventType || e == "*" {
			return true
		}
	}
	return false
}

// nextRetryAt returns the delay for each retry attempt per the spec schedule.
func nextRetryAt(attempt int) time.Time {
	delays := []time.Duration{
		5 * time.Minute,
		30 * time.Minute,
		2 * time.Hour,
		6 * time.Hour,
	}
	if attempt <= 0 {
		return time.Now()
	}
	if attempt > len(delays) {
		return time.Now().Add(delays[len(delays)-1])
	}
	return time.Now().Add(delays[attempt-1])
}

// SignPayload is exported for use in tests and signature verification handlers.
func SignPayload(secret string, payload []byte) string {
	return sign(secret, payload)
}

package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/email"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// newWebhookHTTPClient builds the client used exclusively for delivering
// outbound webhooks to developer-controlled endpoints. It refuses to follow
// redirects — an endpoint that 3xx's to an internal address (SSRF) would
// otherwise have Tori's own server make a request on the attacker's behalf —
// and bounds both the TCP+TLS handshake and the total request time so one
// slow or hanging endpoint can't tie up a delivery goroutine indefinitely.
func newWebhookHTTPClient() *http.Client {
	return &http.Client{
		Timeout: 30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return fmt.Errorf("webhook delivery: redirects not allowed (potential SSRF)")
		},
		Transport: &http.Transport{
			DialContext: (&net.Dialer{
				Timeout: 10 * time.Second,
			}).DialContext,
			TLSHandshakeTimeout: 10 * time.Second,
		},
	}
}

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
	jobs   domain.JobRepository
	client *http.Client

	// Merchant email dependencies. All may be nil (e.g. in tests), in which
	// case merchant emails are silently skipped.
	customers      domain.CustomerRepository
	subs           domain.SubscriptionRepository
	plans          domain.PlanRepository
	tenants        domain.TenantRepository
	emailTemplates domain.EmailTemplateRepository
	emailClient    *email.ResendClient
}

func NewDispatcher(repo domain.WebhookRepository, jobs domain.JobRepository) *Dispatcher {
	return &Dispatcher{
		repo:   repo,
		jobs:   jobs,
		client: newWebhookHTTPClient(),
	}
}

// WithMerchantEmail wires the dependencies needed to send a merchant-configured
// email to the tenant's customer after a webhook event fires. Returns the same
// Dispatcher for chaining.
func (d *Dispatcher) WithMerchantEmail(
	customers domain.CustomerRepository,
	subs domain.SubscriptionRepository,
	plans domain.PlanRepository,
	tenants domain.TenantRepository,
	emailTemplates domain.EmailTemplateRepository,
	emailClient *email.ResendClient,
) *Dispatcher {
	d.customers = customers
	d.subs = subs
	d.plans = plans
	d.tenants = tenants
	d.emailTemplates = emailTemplates
	d.emailClient = emailClient
	return d
}

// Dispatch sends an event to all active endpoints subscribed to the event
// type, in the given mode — a test-mode event never reaches a live-mode
// endpoint and vice versa.
func (d *Dispatcher) Dispatch(ctx context.Context, tenantID uuid.UUID, eventType domain.WebhookEventType, data interface{}, mode string) error {
	endpoints, err := d.repo.ListEndpoints(ctx, tenantID, mode)
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

	d.maybeSendMerchantEmail(ctx, tenantID, eventType, data)

	return nil
}

// merchantEmailEvents are the event types that fire through Dispatch and can
// carry a merchant email. trial.ending_soon is scheduled by its own job and
// sent directly by that job's handler, not through Dispatch.
var merchantEmailEvents = map[domain.WebhookEventType]bool{
	domain.EventSubscriptionActivated: true,
	domain.EventPaymentSucceeded:      true,
	domain.EventPaymentFailed:         true,
	domain.EventDunningStarted:        true,
	domain.EventPaymentActionRequired: true,
	domain.EventSubscriptionCancelled: true,
}

// maybeSendMerchantEmail sends the tenant's configured (or default) email
// template to the affected customer, if the tenant has enabled one for this
// event type. Failures are logged, never propagated — a merchant email is
// never allowed to block or fail webhook delivery.
func (d *Dispatcher) maybeSendMerchantEmail(ctx context.Context, tenantID uuid.UUID, eventType domain.WebhookEventType, data interface{}) {
	if d.emailClient == nil || d.emailTemplates == nil || d.customers == nil || d.tenants == nil {
		return
	}
	if !merchantEmailEvents[eventType] {
		return
	}

	raw, err := json.Marshal(data)
	if err != nil {
		return
	}
	var probe map[string]interface{}
	if err := json.Unmarshal(raw, &probe); err != nil {
		return
	}

	customerIDStr, _ := probe["customer_id"].(string)
	if customerIDStr == "" {
		return
	}
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		return
	}

	isEnabled := true
	useDefault := true
	var customSubject, customHTML string
	if tmpl, err := d.emailTemplates.Get(ctx, tenantID, string(eventType)); err == nil {
		isEnabled = tmpl.IsEnabled
		useDefault = tmpl.UseDefault
		customSubject = tmpl.Subject
		customHTML = tmpl.HTMLBody
	}
	if !isEnabled {
		return
	}

	customer, err := d.customers.GetByIDNoTenant(ctx, customerID)
	if err != nil {
		return
	}
	tenant, err := d.tenants.GetByID(ctx, tenantID)
	if err != nil {
		return
	}

	vars := email.MerchantEmailVars{
		CustomerEmail: customer.Email,
		ProductName:   tenant.Name,
	}
	if payLink, ok := probe["pay_link"].(string); ok {
		vars.PayLink = payLink
	}

	// Enrich with plan/period context when a subscription is identifiable.
	subIDStr, _ := probe["id"].(string)
	if subIDStr == "" {
		subIDStr, _ = probe["subscription_id"].(string)
	}
	if d.subs != nil && d.plans != nil && subIDStr != "" {
		if subID, err := uuid.Parse(subIDStr); err == nil {
			if sub, err := d.subs.GetByIDNoTenant(ctx, subID); err == nil {
				vars.NextBillingDate = sub.CurrentPeriodEnd.Format("Jan 2, 2006")
				if plan, err := d.plans.GetByID(ctx, sub.PlanID, tenantID); err == nil {
					vars.PlanName = plan.Name
					vars.AmountKobo = plan.Amount
				}
			}
		}
	}

	var subject, html string
	if useDefault {
		var ok bool
		subject, html, ok = email.DefaultMerchantTemplate(string(eventType), vars)
		if !ok {
			return
		}
	} else {
		subject = email.RenderMerchantTemplate(customSubject, vars)
		html = email.RenderMerchantTemplate(customHTML, vars)
	}

	if err := d.emailClient.Send(ctx, customer.Email, subject, html); err != nil {
		log.Error().Err(err).Str("event_type", string(eventType)).Str("tenant_id", tenantID.String()).
			Msg("webhook: failed to send merchant-configured email")
	}
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

// DispatchAsync enqueues a webhook delivery job instead of delivering inline.
// The worker picks it up and calls Deliver, keeping the request path fast.
func (d *Dispatcher) DispatchAsync(ctx context.Context, tenantID uuid.UUID, eventType domain.WebhookEventType, data interface{}, mode string) error {
	payload, err := json.Marshal(map[string]interface{}{
		"tenant_id":  tenantID.String(),
		"event_type": string(eventType),
		"data":       data,
		"mode":       mode,
	})
	if err != nil {
		return fmt.Errorf("marshal webhook job payload: %w", err)
	}

	_, err = d.jobs.Enqueue(ctx, &tenantID, domain.JobWebhookDeliver, payload, time.Now(), 5, mode)
	if err != nil {
		// Fall back to synchronous delivery rather than losing the event
		log.Warn().Err(err).Msg("webhook: failed to enqueue async delivery — falling back to sync")
		return d.Dispatch(ctx, tenantID, eventType, data, mode)
	}
	return nil
}

// HandleWebhookDeliver is the job handler called by the worker to deliver a queued webhook.
func (d *Dispatcher) HandleWebhookDeliver(ctx context.Context, payload json.RawMessage) error {
	var p struct {
		TenantID  string      `json:"tenant_id"`
		EventType string      `json:"event_type"`
		Data      interface{} `json:"data"`
		Mode      string      `json:"mode"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal webhook deliver payload: %w", err)
	}

	tenantID, err := uuid.Parse(p.TenantID)
	if err != nil {
		return fmt.Errorf("invalid tenant_id: %w", err)
	}

	mode := p.Mode
	if mode != "test" && mode != "live" {
		mode = "live"
	}

	return d.Dispatch(ctx, tenantID, domain.WebhookEventType(p.EventType), p.Data, mode)
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

// RetryDelivery re-enqueues a failed webhook delivery by its original payload.
func (d *Dispatcher) RetryDelivery(ctx context.Context, tenantID uuid.UUID, eventType string, payload json.RawMessage, mode string) error {
	jobPayload, err := json.Marshal(map[string]interface{}{
		"tenant_id":  tenantID.String(),
		"event_type": eventType,
		"data":       payload,
		"mode":       mode,
	})
	if err != nil {
		return fmt.Errorf("marshal retry payload: %w", err)
	}

	_, err = d.jobs.Enqueue(ctx, &tenantID, domain.JobWebhookDeliver, jobPayload, time.Now(), 5, mode)
	return err
}

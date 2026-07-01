package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/webhook"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type WebhookHandler struct {
	webhooks   domain.WebhookRepository
	dispatcher *webhook.Dispatcher
}

func NewWebhookHandler(webhooks domain.WebhookRepository, dispatcher *webhook.Dispatcher) *WebhookHandler {
	return &WebhookHandler{webhooks: webhooks, dispatcher: dispatcher}
}

func (h *WebhookHandler) CreateEndpoint(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	var body struct {
		URL        string   `json:"url"`
		Events     []string `json:"events"`
		APIVersion string   `json:"api_version"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if body.URL == "" {
		respond.BadRequest(w, r, "missing_field", "url is required")
		return
	}
	if len(body.Events) == 0 {
		body.Events = []string{"*"}
	}
	if body.APIVersion == "" {
		body.APIVersion = "2026-06-17"
	}

	// Enforce max 5 webhook endpoints per tenant
	existing, err := h.webhooks.ListEndpoints(r.Context(), tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	if len(existing) >= 5 {
		respond.UnprocessableEntity(w, r, "endpoint_limit_reached",
			"maximum of 5 webhook endpoints allowed per account — delete an existing endpoint to add a new one")
		return
	}

	secret := uuid.New().String()
	endpoint, err := h.webhooks.CreateEndpoint(r.Context(), tenantID, body.URL, body.Events, secret, body.APIVersion)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	// Return secret once — never again after this response
	respond.JSON(w, r, http.StatusCreated, map[string]interface{}{
		"endpoint": endpoint,
		"secret":   secret,
	})
}

func (h *WebhookHandler) ListEndpoints(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	endpoints, err := h.webhooks.ListEndpoints(r.Context(), tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.List(w, r, http.StatusOK, endpoints, &respond.Pagination{Total: int64(len(endpoints))})
}

func (h *WebhookHandler) UpdateEndpoint(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "endpoint ID is not a valid UUID")
		return
	}

	var body struct {
		URL      string   `json:"url"`
		Events   []string `json:"events"`
		IsActive bool     `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}

	endpoint, err := h.webhooks.UpdateEndpoint(r.Context(), id, tenantID, body.URL, body.Events, body.IsActive)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, endpoint)
}

func (h *WebhookHandler) DeleteEndpoint(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "endpoint ID is not a valid UUID")
		return
	}

	if err := h.webhooks.DeleteEndpoint(r.Context(), id, tenantID); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *WebhookHandler) ListDeliveries(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	deliveries, err := h.webhooks.ListDeliveries(r.Context(), tenantID, 50, 0)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.List(w, r, http.StatusOK, deliveries, &respond.Pagination{Total: int64(len(deliveries))})
}

func (h *WebhookHandler) RetryDelivery(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "delivery ID is not a valid UUID")
		return
	}

	delivery, err := h.webhooks.GetDeliveryByID(r.Context(), id, tenantID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	if err := h.dispatcher.RetryDelivery(r.Context(), tenantID, delivery.EventType, delivery.Payload); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"message":  "retry queued",
		"delivery": delivery,
	})
}

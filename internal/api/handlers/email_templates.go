package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/email"
	"github.com/go-chi/chi/v5"
)

type EmailTemplateHandler struct {
	templates   domain.EmailTemplateRepository
	tenants     domain.TenantRepository
	emailClient *email.ResendClient
}

func NewEmailTemplateHandler(templates domain.EmailTemplateRepository, tenants domain.TenantRepository, emailClient *email.ResendClient) *EmailTemplateHandler {
	return &EmailTemplateHandler{templates: templates, tenants: tenants, emailClient: emailClient}
}

type emailEventMeta struct {
	Label       string
	Description string
}

var emailEventMetadata = map[string]emailEventMeta{
	"subscription.activated":  {"Welcome email", "Sent when a subscription activates: welcome, you're subscribed"},
	"payment.succeeded":       {"Payment receipt", "Receipt with the amount charged and the next billing date"},
	"payment.failed":          {"Payment failed", "Payment failed, here's what happens next"},
	"dunning.started":         {"Retry notice", "We're retrying your payment"},
	"payment.action_required": {"Action required", "Action needed, pay via this link"},
	"subscription.cancelled":  {"Cancellation confirmed", "Cancellation confirmed, access until a given date"},
	"trial.ending_soon":       {"Trial ending soon", "Fired 3 days before the trial ends"},
}

type emailTemplateResponse struct {
	EventType   string `json:"event_type"`
	Label       string `json:"label"`
	Description string `json:"description"`
	IsEnabled   bool   `json:"is_enabled"`
	UseDefault  bool   `json:"use_default"`
	Subject     string `json:"subject"`
	HTMLBody    string `json:"html_body"`
}

// previewVars returns representative sample data for rendering default
// template previews and test sends, since there is no real billing event to
// draw values from at preview time.
func previewVars(tenantName, tenantEmail string) email.MerchantEmailVars {
	return email.MerchantEmailVars{
		CustomerEmail:   tenantEmail,
		PlanName:        "Pro",
		AmountKobo:      1500000,
		NextBillingDate: time.Now().AddDate(0, 1, 0).Format("Jan 2, 2006"),
		PayLink:         "https://pay.nomba.com/checkout/example",
		ProductName:     tenantName,
	}
}

func isSupportedEmailEvent(eventType string) bool {
	for _, e := range email.SupportedMerchantEmailEvents {
		if e == eventType {
			return true
		}
	}
	return false
}

// List handles GET /v1/email-templates — all 7 templates with current config.
func (h *EmailTemplateHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	tenant, err := h.tenants.GetByID(r.Context(), tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	existing, err := h.templates.List(r.Context(), tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	byEvent := make(map[string]*domain.EmailTemplate, len(existing))
	for _, t := range existing {
		byEvent[t.EventType] = t
	}

	vars := previewVars(tenant.Name, tenant.Email)

	out := make([]emailTemplateResponse, 0, len(email.SupportedMerchantEmailEvents))
	for _, evt := range email.SupportedMerchantEmailEvents {
		meta := emailEventMetadata[evt]
		defaultSubject, defaultHTML, _ := email.DefaultMerchantTemplate(evt, vars)

		resp := emailTemplateResponse{
			EventType:   evt,
			Label:       meta.Label,
			Description: meta.Description,
			IsEnabled:   true,
			UseDefault:  true,
			Subject:     defaultSubject,
			HTMLBody:    defaultHTML,
		}
		if t, ok := byEvent[evt]; ok {
			resp.IsEnabled = t.IsEnabled
			resp.UseDefault = t.UseDefault
			if !t.UseDefault {
				resp.Subject = t.Subject
				resp.HTMLBody = t.HTMLBody
			}
		}
		out = append(out, resp)
	}

	respond.JSON(w, r, http.StatusOK, out)
}

// Update handles PUT /v1/email-templates/{event_type}.
func (h *EmailTemplateHandler) Update(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	eventType := chi.URLParam(r, "event_type")
	if !isSupportedEmailEvent(eventType) {
		respond.BadRequest(w, r, "invalid_event_type", "unknown email template event type")
		return
	}

	var body struct {
		Subject    string `json:"subject"`
		HTMLBody   string `json:"html_body"`
		IsEnabled  bool   `json:"is_enabled"`
		UseDefault bool   `json:"use_default"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if !body.UseDefault && (body.Subject == "" || body.HTMLBody == "") {
		respond.BadRequest(w, r, "missing_field", "subject and html_body are required when use_default is false")
		return
	}

	updated, err := h.templates.Upsert(r.Context(), tenantID, eventType, body.Subject, body.HTMLBody, body.IsEnabled, body.UseDefault)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, updated)
}

// SendTest handles POST /v1/email-templates/{event_type}/test — sends a
// preview of the configured (or default) template to the tenant's own email.
func (h *EmailTemplateHandler) SendTest(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	eventType := chi.URLParam(r, "event_type")
	if !isSupportedEmailEvent(eventType) {
		respond.BadRequest(w, r, "invalid_event_type", "unknown email template event type")
		return
	}

	tenant, err := h.tenants.GetByID(r.Context(), tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	vars := previewVars(tenant.Name, tenant.Email)

	subject, html, _ := email.DefaultMerchantTemplate(eventType, vars)
	if tmpl, err := h.templates.Get(r.Context(), tenantID, eventType); err == nil && !tmpl.UseDefault {
		subject = email.RenderMerchantTemplate(tmpl.Subject, vars)
		html = email.RenderMerchantTemplate(tmpl.HTMLBody, vars)
	}

	if err := h.emailClient.Send(r.Context(), tenant.Email, "[Test] "+subject, html); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{"status": "sent", "sent_to": tenant.Email})
}

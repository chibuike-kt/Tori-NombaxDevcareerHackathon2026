package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/email"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// PlatformEmailHandler lets an integrator trigger a one-off transactional
// email to a specific customer — either one of the tenant's configured
// merchant billing templates, or fully custom subject/HTML.
type PlatformEmailHandler struct {
	customers   domain.CustomerRepository
	templates   domain.EmailTemplateRepository
	tenants     domain.TenantRepository
	emailClient *email.ResendClient
}

func NewPlatformEmailHandler(customers domain.CustomerRepository, templates domain.EmailTemplateRepository, tenants domain.TenantRepository, emailClient *email.ResendClient) *PlatformEmailHandler {
	return &PlatformEmailHandler{customers: customers, templates: templates, tenants: tenants, emailClient: emailClient}
}

type sendCustomerEmailRequest struct {
	Template      string                 `json:"template"`
	CustomSubject string                 `json:"custom_subject"`
	CustomHTML    string                 `json:"custom_html"`
	Variables     map[string]interface{} `json:"variables"`
}

// renderCustomVariables substitutes {{key}} placeholders with the supplied
// values — used for the custom_subject/custom_html path, where the
// placeholder names are arbitrary and not known ahead of time.
func renderCustomVariables(text string, variables map[string]interface{}) string {
	for k, v := range variables {
		text = strings.ReplaceAll(text, "{{"+k+"}}", fmt.Sprintf("%v", v))
	}
	return text
}

// mergeMerchantVars maps the well-known variable names onto
// email.MerchantEmailVars for the template-based send path — this reuses
// the exact same rendering the dashboard's own configured/default merchant
// templates use, rather than a separate ad hoc engine.
func mergeMerchantVars(customer *domain.Customer, tenant *domain.Tenant, variables map[string]interface{}) email.MerchantEmailVars {
	v := email.MerchantEmailVars{CustomerEmail: customer.Email, ProductName: tenant.Name}
	if s, ok := variables["plan_name"].(string); ok {
		v.PlanName = s
	}
	if s, ok := variables["next_billing_date"].(string); ok {
		v.NextBillingDate = s
	}
	if s, ok := variables["pay_link"].(string); ok {
		v.PayLink = s
	}
	if amt, ok := variables["amount_kobo"].(float64); ok {
		v.AmountKobo = int64(amt)
	}
	return v
}

// Send handles POST /v1/platform/customers/{id}/email.
func (h *PlatformEmailHandler) Send(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "customer ID is not a valid UUID")
		return
	}

	var req sendCustomerEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}

	hasCustom := req.CustomSubject != "" || req.CustomHTML != ""
	if hasCustom && (req.CustomSubject == "" || req.CustomHTML == "") {
		respond.BadRequest(w, r, "missing_field", "custom_subject and custom_html must both be provided together")
		return
	}
	if req.Template == "" && !hasCustom {
		respond.BadRequest(w, r, "missing_field", "either template, or custom_subject and custom_html, is required")
		return
	}

	customer, err := h.customers.GetByID(r.Context(), id, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			respond.NotFound(w, r)
			return
		}
		respond.InternalError(w, r, err)
		return
	}

	var subject, html, templateUsed string

	if hasCustom {
		templateUsed = "custom"
		subject = renderCustomVariables(req.CustomSubject, req.Variables)
		html = renderCustomVariables(req.CustomHTML, req.Variables)
	} else {
		templateUsed = req.Template
		tenant, err := h.tenants.GetByID(r.Context(), tenantID)
		if err != nil {
			respond.InternalError(w, r, err)
			return
		}
		vars := mergeMerchantVars(customer, tenant, req.Variables)

		useDefault := true
		var customTmplSubject, customTmplHTML string
		if tmpl, err := h.templates.Get(r.Context(), tenantID, req.Template); err == nil {
			useDefault = tmpl.UseDefault
			customTmplSubject = tmpl.Subject
			customTmplHTML = tmpl.HTMLBody
		}

		if useDefault {
			var ok bool
			subject, html, ok = email.DefaultMerchantTemplate(req.Template, vars)
			if !ok {
				respond.BadRequest(w, r, "unknown_template", "template is not a recognised event type")
				return
			}
		} else {
			subject = email.RenderMerchantTemplate(customTmplSubject, vars)
			html = email.RenderMerchantTemplate(customTmplHTML, vars)
		}
	}

	if h.emailClient == nil {
		respond.InternalError(w, r, fmt.Errorf("email client not configured"))
		return
	}
	if err := h.emailClient.Send(r.Context(), customer.Email, subject, html); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"delivered": true,
		"recipient": customer.Email,
		"template":  templateUsed,
	})
}

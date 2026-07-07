package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type PaymentLinkHandler struct {
	links   domain.PaymentLinkRepository
	tenants domain.TenantRepository
	payment payment.NombaClient
	events  *EventRecorder
}

func NewPaymentLinkHandler(links domain.PaymentLinkRepository, tenants domain.TenantRepository, paymentClient payment.NombaClient, events *EventRecorder) *PaymentLinkHandler {
	return &PaymentLinkHandler{links: links, tenants: tenants, payment: paymentClient, events: events}
}

type createPaymentLinkRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	AmountKobo  int64  `json:"amount_kobo"`
	MaxUses     *int   `json:"max_uses"`
}

func (h *PaymentLinkHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	mode := middleware.GetMode(r.Context())

	var req createPaymentLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if req.Title == "" {
		respond.BadRequest(w, r, "missing_field", "title is required")
		return
	}
	if req.AmountKobo <= 0 {
		respond.BadRequest(w, r, "invalid_amount", "amount_kobo must be greater than zero")
		return
	}

	link, err := h.links.Create(r.Context(), tenantID, mode, req.Title, req.Description, req.AmountKobo, "NGN", req.MaxUses)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	h.events.Record(r.Context(), tenantID, mode, domain.EventPaymentLinkCreated, "payment_link", link.ID,
		fmt.Sprintf("Payment link \"%s\" created — %s", link.Title, formatNaira(link.AmountKobo)))

	respond.JSON(w, r, http.StatusCreated, link)
}

func (h *PaymentLinkHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	mode := middleware.GetMode(r.Context())

	links, err := h.links.List(r.Context(), tenantID, mode)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	respond.JSON(w, r, http.StatusOK, links)
}

func (h *PaymentLinkHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "payment link ID is not a valid UUID")
		return
	}

	link, err := h.links.GetByID(r.Context(), id, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			respond.NotFound(w, r)
			return
		}
		respond.InternalError(w, r, err)
		return
	}
	respond.JSON(w, r, http.StatusOK, link)
}

func (h *PaymentLinkHandler) Deactivate(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	mode := middleware.GetMode(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "payment link ID is not a valid UUID")
		return
	}

	link, err := h.links.Deactivate(r.Context(), id, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			respond.NotFound(w, r)
			return
		}
		respond.InternalError(w, r, err)
		return
	}

	h.events.Record(r.Context(), tenantID, mode, domain.EventPaymentLinkDeactivated, "payment_link", link.ID,
		fmt.Sprintf("Payment link \"%s\" deactivated", link.Title))

	respond.JSON(w, r, http.StatusOK, link)
}

// paymentLinkReferencePrefix marks a Nomba orderReference as belonging to a
// payment link checkout rather than a subscription — the webhook handler
// checks for this prefix to route completion correctly.
const paymentLinkReferencePrefix = "paylink_"

// Checkout initiates a one-off Nomba checkout for a payment link — no
// subscription or plan involved. Reachable via the Platform API (API key or
// OAuth token), matching every other /v1/platform/* checkout entry point.
func (h *PaymentLinkHandler) Checkout(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	mode := middleware.GetMode(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "payment link ID is not a valid UUID")
		return
	}

	link, err := h.links.GetByID(r.Context(), id, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			respond.NotFound(w, r)
			return
		}
		respond.InternalError(w, r, err)
		return
	}
	if !link.IsActive {
		respond.UnprocessableEntity(w, r, "link_inactive", "this payment link is no longer active")
		return
	}
	if link.MaxUses != nil && link.UseCount >= *link.MaxUses {
		respond.UnprocessableEntity(w, r, "link_exhausted", "this payment link has reached its usage limit")
		return
	}
	if link.Mode != mode {
		respond.UnprocessableEntity(w, r, "link_mode_mismatch",
			fmt.Sprintf("this payment link belongs to %s mode — request is running in %s mode", link.Mode, mode))
		return
	}

	var body struct {
		Email string `json:"email"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	suffix, err := randomHexToken(8)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	reference := paymentLinkReferencePrefix + link.ID.String() + "_" + suffix

	tenant, _ := h.tenants.GetByID(r.Context(), tenantID)
	merchantName := "Merchant"
	if tenant != nil {
		merchantName = tenant.Name
	}

	nombaResp, err := h.payment.InitiateCheckout(r.Context(), payment.CheckoutRequest{
		CustomerEmail: body.Email,
		Amount:        link.AmountKobo,
		Currency:      link.Currency,
		Reference:     reference,
		Metadata: map[string]string{
			"payment_link_id": link.ID.String(),
			"tenant_id":       tenantID.String(),
			"purpose":         "payment_link",
		},
	})
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	toriURL := buildToriCheckoutURL(nombaResp.CheckoutURL, merchantName, link.Title, link.AmountKobo)

	respond.JSON(w, r, http.StatusCreated, map[string]interface{}{
		"checkout_url":      nombaResp.CheckoutURL,
		"tori_checkout_url": toriURL,
		"reference":         reference,
	})
}

var _ = time.Now

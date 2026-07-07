package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/events"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type PaymentLinkHandler struct {
	links     domain.PaymentLinkRepository
	tenants   domain.TenantRepository
	payment   payment.NombaClient
	eventsRec *events.Recorder
}

func NewPaymentLinkHandler(links domain.PaymentLinkRepository, tenants domain.TenantRepository, paymentClient payment.NombaClient, eventsRecorder *events.Recorder) *PaymentLinkHandler {
	return &PaymentLinkHandler{links: links, tenants: tenants, payment: paymentClient, eventsRec: eventsRecorder}
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

	h.eventsRec.Record(r.Context(), tenantID, mode, domain.EventPaymentLinkCreated, "payment_link", link.ID,
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

	h.eventsRec.Record(r.Context(), tenantID, mode, domain.EventPaymentLinkDeactivated, "payment_link", link.ID,
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
	if link.Mode != mode {
		respond.UnprocessableEntity(w, r, "link_mode_mismatch",
			fmt.Sprintf("this payment link belongs to %s mode — request is running in %s mode", link.Mode, mode))
		return
	}

	var body struct {
		Email string `json:"email"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	h.initiateCheckout(w, r, link, body.Email)
}

// PublicInitiate lets an end customer start a payment-link checkout directly
// — no API key or dashboard session required. The link's own UUID acts as
// its capability token, matching how a Payment-Link product is meant to be
// used: shared as a bare URL with no merchant-side integration.
func (h *PaymentLinkHandler) PublicInitiate(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "payment link ID is not a valid UUID")
		return
	}

	link, err := h.links.GetByIDNoTenant(r.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			respond.NotFound(w, r)
			return
		}
		respond.InternalError(w, r, err)
		return
	}

	var body struct {
		Email string `json:"email"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	// The payment client is mode-aware and normally picks live/test off the
	// authenticating API key; a public request has none, so stamp the link's
	// own mode onto the context before dispatching the checkout call.
	ctx := middleware.WithAPIKeyMode(r.Context(), link.Mode)
	r = r.WithContext(ctx)

	h.initiateCheckout(w, r, link, body.Email)
}

// initiateCheckout validates a link is usable and creates the Nomba
// checkout session shared by both the Platform API and public entry points.
func (h *PaymentLinkHandler) initiateCheckout(w http.ResponseWriter, r *http.Request, link *domain.PaymentLink, email string) {
	if !link.IsActive {
		respond.UnprocessableEntity(w, r, "link_inactive", "this payment link is no longer active")
		return
	}
	if link.MaxUses != nil && link.UseCount >= *link.MaxUses {
		respond.UnprocessableEntity(w, r, "link_exhausted", "this payment link has reached its usage limit")
		return
	}

	suffix, err := randomHexToken(8)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	reference := paymentLinkReferencePrefix + link.ID.String() + "_" + suffix

	tenant, _ := h.tenants.GetByID(r.Context(), link.TenantID)
	merchantName := "Merchant"
	if tenant != nil {
		merchantName = tenant.Name
	}

	nombaResp, err := h.payment.InitiateCheckout(r.Context(), payment.CheckoutRequest{
		CustomerEmail: email,
		Amount:        link.AmountKobo,
		Currency:      link.Currency,
		Reference:     reference,
		Metadata: map[string]string{
			"payment_link_id": link.ID.String(),
			"tenant_id":       link.TenantID.String(),
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
		"title":             link.Title,
		"amount_kobo":       link.AmountKobo,
		"merchant_name":     merchantName,
	})
}

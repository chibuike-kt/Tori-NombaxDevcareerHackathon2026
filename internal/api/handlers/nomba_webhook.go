package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/events"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/ledger"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/webhook"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type NombaWebhookHandler struct {
	subs         domain.SubscriptionRepository
	tokens       domain.TokenRevoker
	plans        domain.PlanRepository
	invoices     domain.InvoiceRepository
	ledgerSvc    *ledger.Service
	payment      payment.NombaClient
	dispatcher   *webhook.Dispatcher
	jobs         domain.JobRepository
	customers    domain.CustomerRepository
	paymentLinks domain.PaymentLinkRepository
	eventsRec    *events.Recorder
}

func NewNombaWebhookHandler(
	subs domain.SubscriptionRepository,
	tokens domain.TokenRevoker,
	plans domain.PlanRepository,
	invoices domain.InvoiceRepository,
	ledgerSvc *ledger.Service,
	paymentClient payment.NombaClient,
	dispatcher *webhook.Dispatcher,
	jobs domain.JobRepository,
	customers domain.CustomerRepository,
	paymentLinks domain.PaymentLinkRepository,
	eventsRecorder *events.Recorder,
) *NombaWebhookHandler {
	return &NombaWebhookHandler{
		subs: subs, tokens: tokens,
		plans: plans, invoices: invoices,
		ledgerSvc: ledgerSvc, payment: paymentClient,
		dispatcher: dispatcher, jobs: jobs,
		customers:    customers,
		paymentLinks: paymentLinks,
		eventsRec:    eventsRecorder,
	}
}

type nombaWebhookPayload struct {
	EventType string          `json:"event_type"`
	RequestID string          `json:"requestId"`
	Data      json.RawMessage `json:"data"`
}

type nombaPaymentData struct {
	Merchant struct {
		WalletID      string  `json:"walletId"`
		WalletBalance float64 `json:"walletBalance"`
		UserID        string  `json:"userId"`
	} `json:"merchant"`
	Transaction struct {
		TransactionID     string  `json:"transactionId"`
		Type              string  `json:"type"`
		Time              string  `json:"time"`
		ResponseCode      string  `json:"responseCode"`
		TransactionAmount float64 `json:"transactionAmount"`
		MerchantTxRef     string  `json:"merchantTxRef"`
		Fee               float64 `json:"fee"`
	} `json:"transaction"`
	Order struct {
		Amount         float64 `json:"amount"`
		OrderID        string  `json:"orderId"`
		OrderReference string  `json:"orderReference"`
		CustomerEmail  string  `json:"customerEmail"`
		CustomerID     string  `json:"customerId"`
		Currency       string  `json:"currency"`
	} `json:"order"`
	TokenizedCardData struct {
		TokenKey         string `json:"tokenKey"`
		CardType         string `json:"cardType"`
		TokenExpiryYear  string `json:"tokenExpiryYear"`
		TokenExpiryMonth string `json:"tokenExpiryMonth"`
		CardPan          string `json:"cardPan"`
	} `json:"tokenizedCardData"`
}

func (h *NombaWebhookHandler) Handle(w http.ResponseWriter, r *http.Request) {
	rawBody, err := io.ReadAll(r.Body)
	if err != nil {
		respond.BadRequest(w, r, "invalid_body", "could not read request body")
		return
	}

signature := r.Header.Get("nomba-signature")
	timestamp := r.Header.Get("nomba-timestamp")
	secret := os.Getenv("NOMBA_WEBHOOK_SECRET")

	// If a webhook secret is configured, every inbound webhook MUST carry a valid
	// signature. A missing signature is treated as a failed verification — otherwise
	// an attacker could forge a payment_success by simply omitting the header.
	if secret != "" {
		if signature == "" {
			log.Warn().Msg("nomba webhook: rejected — signature header missing but secret is configured")
			respond.JSON(w, r, http.StatusUnauthorized, map[string]string{"error": "missing signature"})
			return
		}
		if !verifyNombaSignature(rawBody, signature, timestamp, secret) {
			log.Warn().Msg("nomba webhook: signature verification failed")
			respond.JSON(w, r, http.StatusUnauthorized, map[string]string{"error": "invalid signature"})
			return
		}
	} else if os.Getenv("APP_ENV") == "production" {
		// No secret configured in production — refuse every webhook rather
		// than accept unverified payment_success events. Fail-open is only
		// tolerable in development, where nothing real is at stake.
		log.Error().Msg("nomba webhook: NOMBA_WEBHOOK_SECRET not set in production — rejecting all webhooks")
		respond.Error(w, r, http.StatusUnauthorized, "misconfigured", "webhook secret not configured")
		return
	} else {
		log.Warn().Msg("nomba webhook: no secret configured — skipping verification (development only)")
	}

	var payload nombaWebhookPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		respond.BadRequest(w, r, "invalid_json", "could not parse webhook payload")
		return
	}

	// Idempotency — reject duplicate requestIds within 24 hours
	if payload.RequestID != "" {
		dedupKey := "nomba_webhook:" + payload.RequestID
		if h.tokens.IsRevoked(r.Context(), dedupKey) {
			log.Info().Str("request_id", payload.RequestID).Msg("nomba webhook: duplicate requestId — skipping")
			respond.JSON(w, r, http.StatusOK, map[string]string{"status": "duplicate"})
			return
		}
		_ = h.tokens.Revoke(r.Context(), dedupKey, time.Now().Add(24*time.Hour))
	}

	log.Info().
		Str("event_type", payload.EventType).
		Str("request_id", payload.RequestID).
		Msg("nomba webhook received")

	switch payload.EventType {
	case "payment_success":
		h.handlePaymentSuccess(w, r, payload)
	case "payment_failed":
		h.handlePaymentFailed(w, r, payload)
	default:
		log.Info().Str("event_type", payload.EventType).Msg("nomba webhook event ignored")
		respond.JSON(w, r, http.StatusOK, map[string]string{"status": "ignored"})
	}
}

func (h *NombaWebhookHandler) handlePaymentSuccess(w http.ResponseWriter, r *http.Request, payload nombaWebhookPayload) {
	var data nombaPaymentData
	if err := json.Unmarshal(payload.Data, &data); err != nil {
		log.Error().Err(err).Msg("nomba webhook: failed to parse payment_success data")
		respond.JSON(w, r, http.StatusOK, map[string]string{"status": "parse_error"})
		return
	}

	tokenKey := data.TokenizedCardData.TokenKey
	orderRef := data.Order.OrderReference

	hasToken := tokenKey != "" && tokenKey != "N/A"

	log.Info().
		Str("order_reference", orderRef).
		Str("customer_email", middleware.MaskEmail(data.Order.CustomerEmail)).
		Str("token_key", tokenKey).
		Bool("has_token", hasToken).
		Str("card_type", data.TokenizedCardData.CardType).
		Str("card_pan", data.TokenizedCardData.CardPan).
		Float64("amount", data.Transaction.TransactionAmount).
		Msg("nomba payment_success received")

	// Only order_reference is strictly required to match the payment to a subscription.
	// A missing tokenKey means the customer paid by bank transfer, not card —
	// we still activate the subscription because the payment succeeded.
	if orderRef == "" {
		respond.JSON(w, r, http.StatusOK, map[string]string{"status": "processed"})
		return
	}

	// Payment link checkouts carry a "paylink_{id}_{nonce}" reference instead
	// of a subscription UUID — no subscription/plan is involved.
	if strings.HasPrefix(orderRef, paymentLinkReferencePrefix) {
		h.handlePaymentLinkSuccess(r, orderRef, data)
		respond.JSON(w, r, http.StatusOK, map[string]string{"status": "processed"})
		return
	}

	subID, err := uuid.Parse(orderRef)
	if err != nil {
		log.Warn().Str("order_reference", orderRef).Msg("nomba webhook: order_reference is not a UUID")
		respond.JSON(w, r, http.StatusOK, map[string]string{"status": "processed"})
		return
	}

	// Look up subscription
	sub, err := h.subs.GetByIDNoTenant(r.Context(), subID)
	if err != nil {
		log.Error().Err(err).Str("sub_id", subID.String()).Msg("nomba webhook: subscription not found")
		respond.JSON(w, r, http.StatusOK, map[string]string{"status": "processed"})
		return
	}

	// Capture the customer's Nomba wallet ID — the recovery waterfall checks
	// this balance before falling back to card/mandate on a dunning retry.
	if data.Merchant.WalletID != "" {
		if _, err := h.customers.UpdateNombaAccountID(r.Context(), sub.CustomerID, sub.TenantID, data.Merchant.WalletID); err != nil {
			log.Error().Err(err).Str("sub_id", subID.String()).Msg("nomba webhook: failed to store customer wallet ID")
		}
	}

	// Store tokenKey only if the payment was a tokenised card.
	// Bank transfer payments have no token — recurring billing will require
	// a card on the next cycle (handled at renewal via checkout regeneration).
	if hasToken {
		_, err = h.subs.UpdateTokenKey(r.Context(), subID, sub.TenantID, tokenKey)
		if err != nil {
			log.Error().Err(err).Str("sub_id", subID.String()).Msg("nomba webhook: failed to store token key")
		} else {
			log.Info().
				Str("sub_id", subID.String()).
				Str("token_key", tokenKey).
				Msg("nomba webhook: token key stored on subscription")
		}
	} else {
		log.Warn().
			Str("sub_id", subID.String()).
			Msg("nomba webhook: payment succeeded via bank transfer — no card token, recurring billing not set up for next cycle")
	}

	switch sub.Status {
	case domain.StatusPendingPayment:
		// No-trial plan — checkout payment is the first real charge.
		// Activate subscription, create invoice and ledger entry.
		// Applies to both card and transfer payments — the customer paid.
		h.activateAndRecord(r, sub, data)

	case domain.StatusTrialing:
		// Trial plan — a ₦1 verification charge tokenises the card.
		// The charge is intentionally kept to ₦1 (a negligible, non-refundable
		// verification cost) because Nomba's refund API does not currently support
		// card transaction refunds. The tokenKey is what matters — it lets the full
		// plan amount be charged automatically when the trial ends via ExpireTrial.
		if hasToken {
			log.Info().
				Str("sub_id", subID.String()).
				Str("token_key", tokenKey).
				Msg("nomba webhook: trial card verified and tokenised — full amount will be charged when trial ends")
		} else {
					log.Warn().
						Str("sub_id", subID.String()).
						Msg("nomba webhook: trial payment via transfer — no card token, cannot auto-charge when trial ends")
				}

			default:
				log.Info().
					Str("sub_id", subID.String()).
					Str("status", string(sub.Status)).
					Msg("nomba webhook: payment recorded, no status change for current state")
			}

	respond.JSON(w, r, http.StatusOK, map[string]string{"status": "processed"})
}

// handlePaymentLinkSuccess completes a payment link checkout: increments the
// link's use count and records a ledger CHARGE with no subscription or
// customer attached — payment links are one-off collections, not billing.
func (h *NombaWebhookHandler) handlePaymentLinkSuccess(r *http.Request, orderRef string, data nombaPaymentData) {
	ctx := r.Context()

	rest := strings.TrimPrefix(orderRef, paymentLinkReferencePrefix)
	parts := strings.SplitN(rest, "_", 2)
	linkID, err := uuid.Parse(parts[0])
	if err != nil {
		log.Warn().Str("order_reference", orderRef).Msg("nomba webhook: payment link reference is not a valid ID")
		return
	}

	link, err := h.paymentLinks.GetByIDNoTenant(ctx, linkID)
	if err != nil {
		log.Error().Err(err).Str("payment_link_id", linkID.String()).Msg("nomba webhook: payment link not found")
		return
	}

	if err := h.paymentLinks.IncrementUseCount(ctx, linkID); err != nil {
		log.Error().Err(err).Str("payment_link_id", linkID.String()).Msg("nomba webhook: failed to increment use count")
	}

	amountKobo := int64(math.Round(data.Transaction.TransactionAmount * 100))
	if amountKobo <= 0 {
		amountKobo = link.AmountKobo
	}

	chargeIK := fmt.Sprintf("paylink-charge-%s", orderRef)
	if _, err := h.ledgerSvc.RecordPaymentLinkCharge(ctx, link.TenantID, amountKobo, link.Currency, chargeIK, link.Title, link.Mode); err != nil {
		log.Error().Err(err).Str("payment_link_id", linkID.String()).Msg("nomba webhook: failed to record payment link charge")
	}

	h.eventsRec.Record(ctx, link.TenantID, link.Mode, domain.EventPaymentLinkPaid, "payment_link", link.ID,
		fmt.Sprintf("Payment link \"%s\" paid — %s", link.Title, formatNaira(amountKobo)))

	if h.dispatcher != nil {
		payload := map[string]interface{}{
			"payment_link_id": link.ID,
			"title":           link.Title,
			"amount_kobo":     amountKobo,
			"currency":        link.Currency,
			"reference":       orderRef,
			"paid_at":         time.Now().UTC(),
		}
		if err := h.dispatcher.DispatchAsync(ctx, link.TenantID, domain.EventPaymentLinkPaid, payload, link.Mode); err != nil {
			log.Error().Err(err).Str("payment_link_id", linkID.String()).Msg("nomba webhook: failed to dispatch payment_link.paid webhook")
		}
	}

	log.Info().
		Str("payment_link_id", linkID.String()).
		Int64("amount_kobo", amountKobo).
		Msg("nomba webhook: payment link paid")
}

// activateAndRecord moves a PENDING_PAYMENT subscription to ACTIVE,
// creates an invoice, records a ledger CHARGE entry, and marks the invoice paid.
func (h *NombaWebhookHandler) activateAndRecord(r *http.Request, sub *domain.Subscription, data nombaPaymentData) {
	ctx := r.Context()

	// Move subscription to ACTIVE
	now := time.Now().UTC()
	_, err := h.subs.UpdateAfterRenewal(ctx, sub.ID, sub.TenantID, domain.StatusActive, now, now.AddDate(0, 1, 0))
	if err != nil {
			log.Error().Err(err).Str("sub_id", sub.ID.String()).Msg("nomba webhook: failed to activate subscription")
			return
	}
	log.Info().Str("sub_id", sub.ID.String()).Msg("nomba webhook: subscription activated, period start set to payment confirmation time")

	// Fetch plan for name/currency/interval — the amount recorded below comes
	// from what Nomba actually charged, not the plan's sticker price, since a
	// promo code may have discounted the checkout.
	plan, err := h.plans.GetByID(ctx, sub.PlanID, sub.TenantID)
	if err != nil {
		log.Error().Err(err).Str("sub_id", sub.ID.String()).Msg("nomba webhook: could not fetch plan")
		return
	}

	amountKobo := int64(math.Round(data.Transaction.TransactionAmount * 100))
	if amountKobo <= 0 {
		// Defensive fallback — the webhook should always carry the real charged
		// amount, but never silently record a zero-amount invoice if it doesn't.
		amountKobo = plan.Amount
	}

	// Step 1: Create invoice
	invoiceIK := fmt.Sprintf("checkout-invoice-%s", sub.ID)
	dueDate := time.Now().UTC()
	lineItems, _ := json.Marshal([]map[string]interface{}{
		{
			"description": fmt.Sprintf("%s — initial payment", plan.Name),
			"amount":      amountKobo,
			"currency":    plan.Currency,
		},
	})
	invoice, invoiceErr := h.invoices.Create(ctx,
		sub.TenantID, sub.ID, sub.CustomerID,
		amountKobo, plan.Currency,
		domain.InvoiceOpen, dueDate, lineItems, &invoiceIK, sub.Mode)
	if invoiceErr != nil {
		log.Error().Err(invoiceErr).Str("sub_id", sub.ID.String()).Msg("nomba webhook: failed to create invoice")
		return
	}

	// Step 2: Ledger entry using real invoice ID
	chargeIK := fmt.Sprintf("checkout-charge-%s", sub.ID)
	_, ledgerErr := h.ledgerSvc.RecordCharge(ctx,
		sub.TenantID, sub.ID, invoice.ID, sub.CustomerID,
		amountKobo, plan.Currency, chargeIK, sub.Mode)
	if ledgerErr != nil {
		log.Error().Err(ledgerErr).Str("sub_id", sub.ID.String()).Msg("nomba webhook: failed to record ledger charge")
	}

	// Step 3: Mark invoice paid with Nomba transaction ID
	_, _ = h.invoices.MarkPaid(ctx, invoice.ID, sub.TenantID, data.Transaction.TransactionID)

	// Fire webhooks to developer
if h.dispatcher != nil {
    webhookData := map[string]interface{}{
        "id":          sub.ID,
        "customer_id": sub.CustomerID,
        "plan_id":     sub.PlanID,
        "status":      domain.StatusActive,
        "amount_kobo": amountKobo,
        "currency":    plan.Currency,
    }
    // subscription.activated
    if err := h.dispatcher.DispatchAsync(r.Context(), sub.TenantID,
        domain.EventSubscriptionActivated, webhookData, sub.Mode); err != nil {
        log.Error().Err(err).Str("sub_id", sub.ID.String()).Msg("nomba webhook: failed to dispatch subscription.activated")
    }
    // payment.succeeded
    if err := h.dispatcher.DispatchAsync(r.Context(), sub.TenantID,
        domain.EventPaymentSucceeded, webhookData, sub.Mode); err != nil {
        log.Error().Err(err).Str("sub_id", sub.ID.String()).Msg("nomba webhook: failed to dispatch payment.succeeded")
    }
}

	log.Info().
		Str("sub_id", sub.ID.String()).
		Str("invoice_id", invoice.ID.String()).
		Int64("amount_kobo", amountKobo).
		Str("plan", plan.Name).
		Msg("nomba webhook: PENDING_PAYMENT → ACTIVE, invoice created and marked paid")
}

func (h *NombaWebhookHandler) handlePaymentFailed(w http.ResponseWriter, r *http.Request, payload nombaWebhookPayload) {
	var data nombaPaymentData
	if err := json.Unmarshal(payload.Data, &data); err != nil {
		log.Error().Err(err).Msg("nomba webhook: failed to parse payment_failed data")
		respond.JSON(w, r, http.StatusOK, map[string]string{"status": "parse_error"})
		return
	}

	log.Warn().
		Str("order_reference", data.Order.OrderReference).
		Str("response_code", data.Transaction.ResponseCode).
		Float64("amount", data.Transaction.TransactionAmount).
		Msg("nomba payment_failed")

	if data.Order.OrderReference == "" {
		respond.JSON(w, r, http.StatusOK, map[string]string{"status": "processed"})
		return
	}

	subID, err := uuid.Parse(data.Order.OrderReference)
	if err != nil {
		respond.JSON(w, r, http.StatusOK, map[string]string{"status": "processed"})
		return
	}

	sub, err := h.subs.GetByIDNoTenant(r.Context(), subID)
	if err != nil {
		respond.JSON(w, r, http.StatusOK, map[string]string{"status": "processed"})
		return
	}

	// Move PENDING_PAYMENT to PAST_DUE on failed checkout payment
if sub.Status == domain.StatusPendingPayment {
	_, updateErr := h.subs.UpdateStatus(r.Context(), subID, sub.TenantID, domain.StatusPastDue)
	if updateErr != nil {
		log.Error().Err(updateErr).Str("sub_id", subID.String()).Msg("nomba webhook: failed to move pending to past_due")
	} else {
		retryAt := time.Now().UTC().AddDate(0, 0, 3)
		_, _ = h.jobs.Enqueue(r.Context(), &sub.TenantID, domain.JobRetryFailedPayment,
			mustJSON(map[string]string{
				"subscription_id": subID.String(),
				"tenant_id":       sub.TenantID.String(),
			}), retryAt, 3, sub.Mode)
		log.Warn().
			Str("sub_id", subID.String()).
			Str("response_code", data.Transaction.ResponseCode).
			Msg("nomba webhook: checkout payment failed — subscription PAST_DUE, retry scheduled Day 3")
	}
} else {
		log.Warn().
			Str("sub_id", subID.String()).
			Str("status", string(sub.Status)).
			Str("response_code", data.Transaction.ResponseCode).
			Msg("nomba checkout payment failed — subscription has no payment method")
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{"status": "processed"})
}

func verifyNombaSignature(body []byte, signature, timestamp, secret string) bool {
	var payload nombaWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return false
	}
	var data nombaPaymentData
	if err := json.Unmarshal(payload.Data, &data); err != nil {
		return false
	}

	responseCode := data.Transaction.ResponseCode
	if responseCode == "null" {
		responseCode = ""
	}

	hashPayload := strings.Join([]string{
		payload.EventType,
		payload.RequestID,
		data.Merchant.UserID,
		data.Merchant.WalletID,
		data.Transaction.TransactionID,
		data.Transaction.Type,
		data.Transaction.Time,
		responseCode,
		timestamp,
	}, ":")

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(hashPayload))
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func MapNombaFailureCode(nombaCode string) string {
	switch nombaCode {
	case "51":
		return "insufficient_funds"
	case "41", "43":
		return "stolen_card"
	case "54":
		return "card_expired"
	case "62", "57", "36":
		return "card_blocked"
	case "91", "96":
		return "issuer_unavailable"
	case "06", "12", "34":
		return "processing_error"
	case "68":
		return "timeout"
	default:
		return fmt.Sprintf("nomba_%s", nombaCode)
	}
}

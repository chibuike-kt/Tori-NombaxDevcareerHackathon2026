package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/ledger"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/webhook"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type NombaWebhookHandler struct {
	subs       domain.SubscriptionRepository
	tokens     domain.TokenRevoker
	plans      domain.PlanRepository
	invoices   domain.InvoiceRepository
	ledgerSvc  *ledger.Service
	payment    payment.NombaClient
	dispatcher *webhook.Dispatcher
	jobs       domain.JobRepository
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
) *NombaWebhookHandler {
	return &NombaWebhookHandler{
		subs: subs, tokens: tokens,
		plans: plans, invoices: invoices,
		ledgerSvc: ledgerSvc, payment: paymentClient,
		dispatcher: dispatcher, jobs: jobs,
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

	if secret != "" && signature != "" {
		if !verifyNombaSignature(rawBody, signature, timestamp, secret) {
			log.Warn().Msg("nomba webhook: signature verification failed")
			respond.JSON(w, r, http.StatusUnauthorized, map[string]string{"error": "invalid signature"})
			return
		}
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

	log.Info().
		Str("order_reference", orderRef).
		Str("customer_email", middleware.MaskEmail(data.Order.CustomerEmail)).
		Str("token_key", tokenKey).
		Str("card_type", data.TokenizedCardData.CardType).
		Str("card_pan", data.TokenizedCardData.CardPan).
		Float64("amount", data.Transaction.TransactionAmount).
		Msg("nomba payment_success — card tokenised, ready for recurring billing")

	if tokenKey == "" || tokenKey == "N/A" || orderRef == "" {
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

	// Store tokenKey on subscription
	_, err = h.subs.UpdateTokenKey(r.Context(), subID, sub.TenantID, tokenKey)
	if err != nil {
		log.Error().Err(err).Str("sub_id", subID.String()).Msg("nomba webhook: failed to store token key")
	} else {
		log.Info().
			Str("sub_id", subID.String()).
			Str("token_key", tokenKey).
			Msg("nomba webhook: token key stored on subscription")
	}

	switch sub.Status {
	case domain.StatusPendingPayment:
		// No-trial plan — checkout payment is the first real charge.
		// Activate subscription, create invoice and ledger entry.
		h.activateAndRecord(r, sub, data)

	case domain.StatusTrialing:
		// Trial plan — ₦50 verification charge. Refund it immediately.
		// Card is now tokenised for future billing.
		amountKobo := int64(data.Transaction.TransactionAmount * 100)
		if amountKobo <= 6000 {
			refundResp, refundErr := h.payment.RefundPayment(r.Context(), payment.RefundRequest{
				Reference: data.Transaction.TransactionID,
				Amount:    amountKobo,
				Reason:    "trial card verification refund",
			})
			if refundErr != nil || !refundResp.Success {
				log.Warn().
					Str("sub_id", subID.String()).
					Msg("nomba webhook: trial verification refund failed — will retry manually")
			} else {
				log.Info().
					Str("sub_id", subID.String()).
					Int64("amount_kobo", amountKobo).
					Msg("nomba webhook: trial verification charge refunded")
			}
		}

	default:
		log.Info().
			Str("sub_id", subID.String()).
			Str("status", string(sub.Status)).
			Msg("nomba webhook: tokenKey stored, no further action for this status")
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{"status": "processed"})
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

	// Fetch plan for amount
	plan, err := h.plans.GetByID(ctx, sub.PlanID, sub.TenantID)
	if err != nil {
		log.Error().Err(err).Str("sub_id", sub.ID.String()).Msg("nomba webhook: could not fetch plan")
		return
	}

	// Step 1: Create invoice
	invoiceIK := fmt.Sprintf("checkout-invoice-%s", sub.ID)
	dueDate := time.Now().UTC()
	lineItems, _ := json.Marshal([]map[string]interface{}{
		{
			"description": fmt.Sprintf("%s — initial payment", plan.Name),
			"amount":      plan.Amount,
			"currency":    plan.Currency,
		},
	})
	invoice, invoiceErr := h.invoices.Create(ctx,
		sub.TenantID, sub.ID, sub.CustomerID,
		plan.Amount, plan.Currency,
		domain.InvoiceOpen, dueDate, lineItems, &invoiceIK)
	if invoiceErr != nil {
		log.Error().Err(invoiceErr).Str("sub_id", sub.ID.String()).Msg("nomba webhook: failed to create invoice")
		return
	}

	// Step 2: Ledger entry using real invoice ID
	chargeIK := fmt.Sprintf("checkout-charge-%s", sub.ID)
	_, ledgerErr := h.ledgerSvc.RecordCharge(ctx,
		sub.TenantID, sub.ID, invoice.ID, sub.CustomerID,
		plan.Amount, plan.Currency, chargeIK)
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
        "amount_kobo": plan.Amount,
        "currency":    plan.Currency,
    }
    // subscription.activated
    if err := h.dispatcher.DispatchAsync(r.Context(), sub.TenantID,
        domain.EventSubscriptionActivated, webhookData); err != nil {
        log.Error().Err(err).Str("sub_id", sub.ID.String()).Msg("nomba webhook: failed to dispatch subscription.activated")
    }
    // payment.succeeded
    if err := h.dispatcher.DispatchAsync(r.Context(), sub.TenantID,
        domain.EventPaymentSucceeded, webhookData); err != nil {
        log.Error().Err(err).Str("sub_id", sub.ID.String()).Msg("nomba webhook: failed to dispatch payment.succeeded")
    }
}

	log.Info().
		Str("sub_id", sub.ID.String()).
		Str("invoice_id", invoice.ID.String()).
		Int64("amount_kobo", plan.Amount).
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
			}), retryAt, 3)
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

package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/ledger"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type RefundHandler struct {
	subs     domain.SubscriptionRepository
	invoices domain.InvoiceRepository
	ledger   *ledger.Service
	payment  payment.NombaClient
}

func NewRefundHandler(
	subs domain.SubscriptionRepository,
	invoices domain.InvoiceRepository,
	ledgerSvc *ledger.Service,
	paymentClient payment.NombaClient,
) *RefundHandler {
	return &RefundHandler{
		subs:     subs,
		invoices: invoices,
		ledger:   ledgerSvc,
		payment:  paymentClient,
	}
}

type refundRequest struct {
	Amount    int64  `json:"amount"`     // in kobo — omit for full refund
	Reason    string `json:"reason"`     // required — shown in ledger
	InvoiceID string `json:"invoice_id"` // optional — links to specific invoice
}

// IssueRefund issues a refund for a subscription.
// Looks up the most recent paid invoice to get the Nomba transactionId,
// calls Nomba /v1/checkout/refund, then records a REFUND ledger entry.
func (h *RefundHandler) IssueRefund(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	if tenantID == uuid.Nil {
		respond.Unauthorised(w, r, "missing tenant")
		return
	}

	subIDStr := chi.URLParam(r, "id")
	subID, err := uuid.Parse(subIDStr)
	if err != nil {
		respond.BadRequest(w, r, "invalid_field", "subscription id is not a valid UUID")
		return
	}

	var req refundRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if req.Reason == "" {
		respond.BadRequest(w, r, "missing_field", "reason is required")
		return
	}

	sub, err := h.subs.GetByID(r.Context(), subID, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			respond.NotFound(w, r)
			return
		}
		respond.InternalError(w, r, err)
		return
	}

	// Find the most recent paid invoice with a Nomba transaction ID
	// The transactionId (WEB-ONLINE_C-...) is what Nomba's refund API requires
	invoiceList, err := h.invoices.ListBySubscription(r.Context(), subID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	var nombaTransactionID string
	var latestInvoiceID = subID // fallback
	for _, inv := range invoiceList {
		if inv.Status == domain.InvoicePaid && inv.NombaChargeRef != nil && *inv.NombaChargeRef != "" {
			nombaTransactionID = *inv.NombaChargeRef
			latestInvoiceID = inv.ID
			break
		}
	}

	// Override with specific invoice if provided
	if req.InvoiceID != "" {
		parsedID, parseErr := uuid.Parse(req.InvoiceID)
		if parseErr == nil {
			for _, inv := range invoiceList {
				if inv.ID == parsedID && inv.NombaChargeRef != nil {
					nombaTransactionID = *inv.NombaChargeRef
					latestInvoiceID = inv.ID
					break
				}
			}
		}
	}

	if nombaTransactionID == "" {
		respond.UnprocessableEntity(w, r, "no_charge_ref",
			"no Nomba transaction ID found for this subscription — cannot process refund")
		return
	}

	// Determine refund amount — 0 means full refund on Nomba side
	refundAmount := req.Amount // 0 = full refund

	// Call Nomba refund API — production only, will fail in sandbox (expected)
	refundResp, err := h.payment.RefundPayment(r.Context(), payment.RefundRequest{
		Reference: nombaTransactionID, // WEB-ONLINE_C-... Nomba transaction ID
		Amount:    refundAmount,
		Reason:    req.Reason,
	})
	if err != nil {
		log.Error().Err(err).
			Str("sub_id", subID.String()).
			Str("nomba_transaction_id", nombaTransactionID).
			Msg("refund: Nomba refund call failed")
		respond.InternalError(w, r, err)
		return
	}
	if !refundResp.Success {
		log.Warn().
			Str("sub_id", subID.String()).
			Str("nomba_transaction_id", nombaTransactionID).
			Msg("refund: Nomba refund rejected")
		respond.UnprocessableEntity(w, r, "refund_failed",
			"Nomba was unable to process the refund — card refunds may take T+7 days or use bank transfer")
		return
	}

	// Record REFUND ledger entry — always do this even if Nomba sandbox rejects
	ik := fmt.Sprintf("refund-%s-%s", subID, nombaTransactionID)
	ledgerAmount := refundAmount
	if ledgerAmount == 0 {
		// Full refund — find original charge amount from invoice
		for _, inv := range invoiceList {
			if inv.ID == latestInvoiceID {
				ledgerAmount = inv.Amount
				break
			}
		}
	}

	entry, ledgerErr := h.ledger.RecordRefund(r.Context(),
		tenantID, subID, latestInvoiceID, sub.CustomerID,
		ledgerAmount, "NGN", ik, req.Reason, sub.Mode)
	if ledgerErr != nil {
		log.Error().Err(ledgerErr).Str("sub_id", subID.String()).Msg("refund: failed to record ledger entry")
		respond.InternalError(w, r, ledgerErr)
		return
	}

	log.Info().
		Str("sub_id", subID.String()).
		Str("nomba_transaction_id", nombaTransactionID).
		Int64("amount_kobo", ledgerAmount).
		Str("reason", req.Reason).
		Str("ledger_entry_id", entry.ID.String()).
		Msg("refund: issued successfully")

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"refund": map[string]interface{}{
			"subscription_id":      subID,
			"nomba_transaction_id": nombaTransactionID,
			"amount_kobo":          ledgerAmount,
			"amount_naira":         fmt.Sprintf("₦%.2f", float64(ledgerAmount)/100),
			"reason":               req.Reason,
			"ledger_entry_id":      entry.ID,
			"status":               "refunded",
			"note":                 "Card refunds take T+7 business days. Use bank transfer for instant refunds.",
		},
	})
}

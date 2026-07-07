package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/events"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/finops"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/payment"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type PayoutHandler struct {
	payouts   domain.PayoutRepository
	payment   payment.NombaClient
	jobs      domain.JobRepository
	finops    *finops.Service
	eventsRec *events.Recorder
}

func NewPayoutHandler(payouts domain.PayoutRepository, paymentClient payment.NombaClient, jobs domain.JobRepository, finopsSvc *finops.Service, eventsRecorder *events.Recorder) *PayoutHandler {
	return &PayoutHandler{payouts: payouts, payment: paymentClient, jobs: jobs, finops: finopsSvc, eventsRec: eventsRecorder}
}

type createPayoutRequest struct {
	AmountKobo    int64  `json:"amount_kobo"`
	BankCode      string `json:"bank_code"`
	BankName      string `json:"bank_name"`
	AccountNumber string `json:"account_number"`
	AccountName   string `json:"account_name"`
}

// Create validates the requested amount against the merchant's available
// (T+1-settled) balance, creates the payout as pending, and enqueues the
// async transfer job — the HTTP response returns immediately.
func (h *PayoutHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	mode := middleware.GetMode(r.Context())

	var req createPayoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}
	if req.AmountKobo <= 0 {
		respond.BadRequest(w, r, "invalid_amount", "amount_kobo must be greater than zero")
		return
	}
	if req.BankCode == "" || req.AccountNumber == "" || req.AccountName == "" {
		respond.BadRequest(w, r, "missing_field", "bank_code, account_number, and account_name are required")
		return
	}

	balance, err := h.finops.GetBalance(r.Context(), tenantID, mode)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	if req.AmountKobo > balance.AvailableKobo {
		respond.UnprocessableEntity(w, r, "insufficient_balance", "amount exceeds available balance")
		return
	}

	po, err := h.payouts.Create(r.Context(), tenantID, mode, req.AmountKobo, "NGN",
		req.BankCode, req.BankName, req.AccountNumber, req.AccountName)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	payload, _ := json.Marshal(map[string]string{
		"payout_id": po.ID.String(),
		"tenant_id": tenantID.String(),
	})
	if _, err := h.jobs.Enqueue(r.Context(), &tenantID, domain.JobProcessPayout, payload, time.Now(), 5, mode); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	h.eventsRec.Record(r.Context(), tenantID, mode, domain.EventPayoutRequested, "payout", po.ID,
		"Payout requested — "+formatNaira(po.AmountKobo)+" to "+po.BankName)

	respond.JSON(w, r, http.StatusCreated, po)
}

func (h *PayoutHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	mode := middleware.GetMode(r.Context())

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit == 0 {
		limit = 20
	}

	payouts, err := h.payouts.List(r.Context(), tenantID, mode, limit, offset)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	respond.List(w, r, http.StatusOK, payouts, &respond.Pagination{Total: int64(len(payouts))})
}

func (h *PayoutHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "payout ID is not a valid UUID")
		return
	}

	po, err := h.payouts.GetByID(r.Context(), id, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			respond.NotFound(w, r)
			return
		}
		respond.InternalError(w, r, err)
		return
	}
	respond.JSON(w, r, http.StatusOK, po)
}

// ListBanks proxies Nomba's bank list, used to populate the payout bank selector.
func (h *PayoutHandler) ListBanks(w http.ResponseWriter, r *http.Request) {
	banks, err := h.payment.ListBanks(r.Context())
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	respond.JSON(w, r, http.StatusOK, banks)
}

// ResolveAccount looks up the account holder's name so operators can confirm
// a payout destination before submitting the request.
func (h *PayoutHandler) ResolveAccount(w http.ResponseWriter, r *http.Request) {
	accountNumber := r.URL.Query().Get("account_number")
	bankCode := r.URL.Query().Get("bank_code")
	if accountNumber == "" || bankCode == "" {
		respond.BadRequest(w, r, "missing_field", "account_number and bank_code are required")
		return
	}

	accountName, err := h.payment.ResolveBankAccount(r.Context(), accountNumber, bankCode)
	if err != nil {
		respond.UnprocessableEntity(w, r, "account_lookup_failed", "could not resolve account — check the account number and bank")
		return
	}
	respond.JSON(w, r, http.StatusOK, map[string]string{"account_name": accountName})
}

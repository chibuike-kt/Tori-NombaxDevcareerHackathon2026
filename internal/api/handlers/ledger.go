package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/ledger"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type LedgerHandler struct {
	svc *ledger.Service
}

func NewLedgerHandler(svc *ledger.Service) *LedgerHandler {
	return &LedgerHandler{svc: svc}
}

func (h *LedgerHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit == 0 {
		limit = 50
	}

	from, to := parseDateRange(r)

	entries, err := h.svc.ListByDateRange(r.Context(), tenantID, from, to, limit, offset)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.List(w, r, http.StatusOK, entries, &respond.Pagination{Total: int64(len(entries))})
}

func (h *LedgerHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "ledger entry ID is not a valid UUID")
		return
	}

	entry, err := h.svc.ListBySubscription(r.Context(), tenantID, id, 1, 0)
	if err != nil || len(entry) == 0 {
		respond.NotFound(w, r)
		return
	}

	respond.JSON(w, r, http.StatusOK, entry[0])
}

func (h *LedgerHandler) Summary(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	from, to := parseDateRange(r)

	summary, err := h.svc.GetSummary(r.Context(), tenantID, from, to)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, summary)
}

func parseDateRange(r *http.Request) (time.Time, time.Time) {
	from := time.Now().AddDate(0, -1, 0)
	to := time.Now()
	if f := r.URL.Query().Get("from"); f != "" {
		if t, err := time.Parse("2006-01-02", f); err == nil {
			from = t.UTC()
		}
	}
	if t := r.URL.Query().Get("to"); t != "" {
		if parsed, err := time.Parse("2006-01-02", t); err == nil {
			// Set to end of day so today's entries are included
			to = parsed.UTC().Add(24*time.Hour - time.Second)
		}
	}
	return from, to
}

func (h *LedgerHandler) MonthlyRevenue(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	from, to := parseDateRange(r)
	if from.IsZero() {
		from = time.Now().UTC().AddDate(-1, 0, 0) // default: last 12 months
	}
	if to.IsZero() {
		to = time.Now().UTC()
	}

	rows, err := h.svc.GetMonthlyRevenue(r.Context(), tenantID, from, to)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, rows)
}

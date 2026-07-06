package handlers

import (
	"net/http"
	"strconv"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type InvoiceHandler struct {
	invoices domain.InvoiceRepository
}

func NewInvoiceHandler(invoices domain.InvoiceRepository) *InvoiceHandler {
	return &InvoiceHandler{invoices: invoices}
}

func (h *InvoiceHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	limit := 50
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}

	mode := middleware.GetMode(r.Context())

	// Filter by status if provided
	statusParam := r.URL.Query().Get("status")
	if statusParam != "" {
		invoices, err := h.invoices.ListByStatus(r.Context(), tenantID,
			domain.InvoiceStatus(statusParam), mode, limit, offset)
		if err != nil {
			respond.InternalError(w, r, err)
			return
		}
		respond.List(w, r, http.StatusOK, invoices, &respond.Pagination{
			Total: int64(len(invoices)),
		})
		return
	}

	invoices, err := h.invoices.ListByTenant(r.Context(), tenantID, mode, limit, offset)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	respond.List(w, r, http.StatusOK, invoices, &respond.Pagination{
		Total: int64(len(invoices)),
	})
}

func (h *InvoiceHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "invoice ID is not a valid UUID")
		return
	}

	invoice, err := h.invoices.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	respond.JSON(w, r, http.StatusOK, invoice)
}

func (h *InvoiceHandler) ListBySubscription(w http.ResponseWriter, r *http.Request) {
	subIDStr := chi.URLParam(r, "id")
	subID, err := uuid.Parse(subIDStr)
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	invoices, err := h.invoices.ListBySubscription(r.Context(), subID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	respond.List(w, r, http.StatusOK, invoices, &respond.Pagination{
		Total: int64(len(invoices)),
	})
}

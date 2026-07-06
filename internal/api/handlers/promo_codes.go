package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type PromoCodeHandler struct {
	promoCodes domain.PromoCodeRepository
	plans      domain.PlanRepository
}

func NewPromoCodeHandler(promoCodes domain.PromoCodeRepository, plans domain.PlanRepository) *PromoCodeHandler {
	return &PromoCodeHandler{promoCodes: promoCodes, plans: plans}
}

var promoCodePattern = regexp.MustCompile(`^[A-Z0-9]{4,20}$`)

type createPromoCodeRequest struct {
	Code          string  `json:"code"`
	Description   string  `json:"description"`
	DiscountType  string  `json:"discount_type"`
	DiscountValue int64   `json:"discount_value"`
	PlanID        *string `json:"plan_id"`
	MaxUses       *int    `json:"max_uses"`
	ExpiresAt     *string `json:"expires_at"`
}

// Create handles POST /v1/promo-codes.
func (h *PromoCodeHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	var req createPromoCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.BadRequest(w, r, "invalid_body", "request body is not valid JSON")
		return
	}

	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if !promoCodePattern.MatchString(code) {
		respond.BadRequest(w, r, "invalid_code", "code must be 4-20 uppercase alphanumeric characters")
		return
	}

	discountType := domain.DiscountType(req.DiscountType)
	if discountType != domain.DiscountTypePercentage && discountType != domain.DiscountTypeFixed {
		respond.BadRequest(w, r, "invalid_discount_type", "discount_type must be 'percentage' or 'fixed'")
		return
	}

	if discountType == domain.DiscountTypePercentage {
		if req.DiscountValue < 1 || req.DiscountValue > 100 {
			respond.BadRequest(w, r, "invalid_discount_value", "percentage discount must be between 1 and 100")
			return
		}
	} else if req.DiscountValue < 100 {
		respond.BadRequest(w, r, "invalid_discount_value", "fixed discount must be at least 100 kobo")
		return
	}

	var planID *uuid.UUID
	if req.PlanID != nil && *req.PlanID != "" {
		id, err := uuid.Parse(*req.PlanID)
		if err != nil {
			respond.BadRequest(w, r, "invalid_plan_id", "plan_id is not a valid UUID")
			return
		}
		if _, err := h.plans.GetByID(r.Context(), id, tenantID); err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				respond.NotFound(w, r)
				return
			}
			respond.InternalError(w, r, err)
			return
		}
		planID = &id
	}

	if req.MaxUses != nil && *req.MaxUses < 1 {
		respond.BadRequest(w, r, "invalid_max_uses", "max_uses must be at least 1")
		return
	}

	var expiresAt *time.Time
	if req.ExpiresAt != nil && *req.ExpiresAt != "" {
		t, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			respond.BadRequest(w, r, "invalid_expires_at", "expires_at must be an RFC3339 timestamp")
			return
		}
		expiresAt = &t
	}

	// Pre-check for a clear conflict error rather than surfacing a raw
	// unique-constraint violation from the database.
	if existing, _ := h.promoCodes.GetByCode(r.Context(), tenantID, code); existing != nil {
		respond.Conflict(w, r, "code_already_exists", "a promo code with this code already exists")
		return
	}

	mode := middleware.GetMode(r.Context())
	promo, err := h.promoCodes.Create(r.Context(), tenantID, code, req.Description, discountType, req.DiscountValue, planID, req.MaxUses, expiresAt, mode)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusCreated, promo)
}

// List handles GET /v1/promo-codes — active and inactive.
func (h *PromoCodeHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	mode := middleware.GetMode(r.Context())
	codes, err := h.promoCodes.List(r.Context(), tenantID, mode)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, codes)
}

// Deactivate handles DELETE /v1/promo-codes/{id} — soft delete only, never a
// hard delete from the dashboard.
func (h *PromoCodeHandler) Deactivate(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "promo code ID is not a valid UUID")
		return
	}

	promo, err := h.promoCodes.Deactivate(r.Context(), id, tenantID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			respond.NotFound(w, r)
			return
		}
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, promo)
}

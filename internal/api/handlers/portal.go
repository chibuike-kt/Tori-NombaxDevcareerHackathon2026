package handlers

import (
	"net/http"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/subscription"
	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"os"
)

type PortalHandler struct {
	customers domain.CustomerRepository
	subs      domain.SubscriptionRepository
	plans     domain.PlanRepository
}

func NewPortalHandler(
	customers domain.CustomerRepository,
	subs domain.SubscriptionRepository,
	plans domain.PlanRepository,
) *PortalHandler {
	return &PortalHandler{customers: customers, subs: subs, plans: plans}
}

// extractPortalCustomerID validates the portal token and returns the customer ID.
func extractPortalCustomerID(r *http.Request) (uuid.UUID, error) {
	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		// Also accept Bearer token
		header := r.Header.Get("Authorization")
		if len(header) > 7 {
			tokenStr = header[7:]
		}
	}

	secret := os.Getenv("JWT_SECRET")
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return uuid.Nil, domain.ErrUnauthorised
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return uuid.Nil, domain.ErrUnauthorised
	}

	tokenType, _ := claims["type"].(string)
	if tokenType != "portal" {
		return uuid.Nil, domain.ErrUnauthorised
	}

	customerIDStr, _ := claims["customer_id"].(string)
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		return uuid.Nil, domain.ErrUnauthorised
	}

	return customerID, nil
}

// GetPortalData returns the customer and their subscriptions for the portal.
func (h *PortalHandler) GetPortalData(w http.ResponseWriter, r *http.Request) {
	customerID, err := extractPortalCustomerID(r)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired portal token")
		return
	}

	// Always fetch customer directly — no tenant needed
	customer, err := h.customers.GetByIDNoTenant(r.Context(), customerID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	subs, err := h.subs.ListByCustomerNoTenant(r.Context(), customerID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	type subWithPlan struct {
		*domain.Subscription
		Plan *domain.Plan `json:"plan"`
	}

	enriched := make([]subWithPlan, 0, len(subs))
	for _, sub := range subs {
		if sub.Status == domain.StatusCancelled {
			continue
		}
		plan, _ := h.plans.GetByID(r.Context(), sub.PlanID, sub.TenantID)
		enriched = append(enriched, subWithPlan{
			Subscription: sub,
			Plan:         plan,
		})
	}

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"customer":      customer,
		"subscriptions": enriched,
	})
}
// PortalCancel cancels a subscription via portal token.
func (h *PortalHandler) PortalCancel(w http.ResponseWriter, r *http.Request) {
	customerID, err := extractPortalCustomerID(r)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired portal token")
		return
	}

	subID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	sub, err := h.subs.GetByIDNoTenant(r.Context(), subID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	// Verify this subscription belongs to the customer in the token
	if sub.CustomerID != customerID {
		respond.Unauthorised(w, r, "subscription does not belong to this customer")
		return
	}

	_, err = subscription.Transition(sub.Status, subscription.EventCustomerCancelled)
	if err != nil {
		respond.UnprocessableEntity(w, r, "invalid_transition", err.Error())
		return
	}

	updated, err := h.subs.Cancel(r.Context(), subID, sub.TenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, updated)
}

// PortalPause pauses a subscription via portal token.
func (h *PortalHandler) PortalPause(w http.ResponseWriter, r *http.Request) {
	customerID, err := extractPortalCustomerID(r)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired portal token")
		return
	}

	subID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	sub, err := h.subs.GetByIDNoTenant(r.Context(), subID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	if sub.CustomerID != customerID {
		respond.Unauthorised(w, r, "subscription does not belong to this customer")
		return
	}

	_, err = subscription.Transition(sub.Status, subscription.EventCustomerPaused)
	if err != nil {
		respond.UnprocessableEntity(w, r, "invalid_transition", err.Error())
		return
	}

	updated, err := h.subs.Pause(r.Context(), subID, sub.TenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, updated)
}

// PortalResume resumes a subscription via portal token.
func (h *PortalHandler) PortalResume(w http.ResponseWriter, r *http.Request) {
	customerID, err := extractPortalCustomerID(r)
	if err != nil {
		respond.Unauthorised(w, r, "invalid or expired portal token")
		return
	}

	subID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "subscription ID is not a valid UUID")
		return
	}

	sub, err := h.subs.GetByIDNoTenant(r.Context(), subID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	if sub.CustomerID != customerID {
		respond.Unauthorised(w, r, "subscription does not belong to this customer")
		return
	}

	_, err = subscription.Transition(sub.Status, subscription.EventCustomerResumed)
	if err != nil {
		respond.UnprocessableEntity(w, r, "invalid_transition", err.Error())
		return
	}

	updated, err := h.subs.Resume(r.Context(), subID, sub.TenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, updated)
}

package handlers

import (
	"crypto/rand"
	"encoding/json"
	"math/big"
	"net/http"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/email"
	"github.com/rs/zerolog/log"
)

// otpTTL is how long a portal login code stays valid.
const otpTTL = 10 * time.Minute

// PortalAuthHandler implements self-service portal login via a 6-digit
// email code — independent of the dashboard's tenant password/JWT auth.
type PortalAuthHandler struct {
	customers   domain.CustomerRepository
	tenants     domain.TenantRepository
	otps        domain.CustomerOTPRepository
	emailClient *email.ResendClient
}

func NewPortalAuthHandler(
	customers domain.CustomerRepository,
	tenants domain.TenantRepository,
	otps domain.CustomerOTPRepository,
	emailClient *email.ResendClient,
) *PortalAuthHandler {
	return &PortalAuthHandler{customers: customers, tenants: tenants, otps: otps, emailClient: emailClient}
}

func generatePortalOTPCode() (string, error) {
	const digits = "0123456789"
	code := make([]byte, 6)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		if err != nil {
			return "", err
		}
		code[i] = digits[n.Int64()]
	}
	return string(code), nil
}

// RequestOTP handles POST /v1/portal/auth/request-otp. Always returns the
// same generic response regardless of whether the email matches a customer,
// so the endpoint can't be used to enumerate customer emails.
func (h *PortalAuthHandler) RequestOTP(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" {
		respond.BadRequest(w, r, "missing_field", "email is required")
		return
	}

	genericResponse := map[string]string{
		"message": "If this email is associated with a subscription, a login code has been sent.",
	}

	matches, err := h.customers.GetAllByEmailNoTenant(r.Context(), body.Email)
	if err != nil || len(matches) == 0 {
		respond.JSON(w, r, http.StatusOK, genericResponse)
		return
	}

	// An email can belong to customers of more than one merchant — the most
	// recently created match is used. Handling multi-merchant disambiguation
	// is a real product surface, but out of scope here.
	customer := matches[0]

	code, err := generatePortalOTPCode()
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}
	expiresAt := time.Now().UTC().Add(otpTTL)
	if _, err := h.otps.Create(r.Context(), customer.ID, code, expiresAt); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	merchantName := "your merchant"
	if tenant, err := h.tenants.GetByID(r.Context(), customer.TenantID); err == nil {
		merchantName = tenant.Name
	}

	subject, html := email.PortalOTPEmail(merchantName, code)
	if h.emailClient != nil {
		if err := h.emailClient.Send(r.Context(), customer.Email, subject, html); err != nil {
			log.Error().Err(err).Str("customer_id", customer.ID.String()).Msg("portal auth: failed to send OTP email")
		}
	}

	respond.JSON(w, r, http.StatusOK, genericResponse)
}

// VerifyOTP handles POST /v1/portal/auth/verify-otp — exchanges a valid code
// for a portal JWT.
func (h *PortalAuthHandler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Code == "" {
		respond.BadRequest(w, r, "missing_field", "code is required")
		return
	}

	otp, err := h.otps.GetByCode(r.Context(), body.Code)
	if err != nil {
		respond.BadRequest(w, r, "invalid_code", "this code is invalid or has expired")
		return
	}
	if otp.UsedAt != nil {
		respond.BadRequest(w, r, "code_already_used", "this code has already been used")
		return
	}
	if time.Now().UTC().After(otp.ExpiresAt) {
		respond.BadRequest(w, r, "code_expired", "this code has expired — request a new one")
		return
	}

	if err := h.otps.MarkUsed(r.Context(), otp.ID); err != nil {
		log.Error().Err(err).Str("otp_id", otp.ID.String()).Msg("portal auth: failed to mark OTP used")
	}

	token, err := middleware.GeneratePortalToken(otp.CustomerID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{"token": token})
}

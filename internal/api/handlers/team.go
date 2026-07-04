package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/email"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type TeamHandler struct {
	members     domain.MemberRepository
	invitations domain.InvitationRepository
	audit       domain.AuditRepository
	tenants     domain.TenantRepository
	emailClient *email.ResendClient
}

func NewTeamHandler(members domain.MemberRepository, invitations domain.InvitationRepository, audit domain.AuditRepository, tenants domain.TenantRepository, emailClient *email.ResendClient) *TeamHandler {
	return &TeamHandler{members: members, invitations: invitations, audit: audit, tenants: tenants, emailClient: emailClient}
}

// ListMembers returns all members and pending invitations for the tenant.
func (h *TeamHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	members, err := h.members.List(r.Context(), tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	invitations, err := h.invitations.List(r.Context(), tenantID)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"members":     members,
		"invitations": invitations,
	})
}

// InviteMember sends an invitation to a new team member.
func (h *TeamHandler) InviteMember(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	var body struct {
		Email string            `json:"email"`
		Role  domain.MemberRole `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" {
		respond.BadRequest(w, r, "invalid_body", "email is required")
		return
	}

	// Default role to developer
	if body.Role == "" {
		body.Role = domain.MemberRoleDeveloper
	}

	// Check if already a member
	existing, _ := h.members.GetByEmail(r.Context(), tenantID, body.Email)
	if existing != nil {
		respond.BadRequest(w, r, "already_member", "this email is already a team member")
		return
	}

	// Generate secure invitation token
	tokenBytes := make([]byte, 24)
	_, _ = rand.Read(tokenBytes)
	token := hex.EncodeToString(tokenBytes)

	inv, err := h.invitations.Create(r.Context(), tenantID, body.Email, body.Role, token, nil, time.Now().Add(72*time.Hour))
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	// Send the invite email
	tenant, err := h.tenants.GetByID(r.Context(), tenantID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID.String()).Msg("team: failed to load tenant for invite email")
	} else {
		appURL := os.Getenv("APP_URL")
		inviteURL := appURL + "/accept-invite?token=" + inv.Token
		subject, html := email.InviteEmail(tenant.Name, inviteURL, string(body.Role))
		if err := h.emailClient.Send(r.Context(), body.Email, subject, html); err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID.String()).Msg("team: failed to send invite email")
		}
	}

	// Audit log
	_, _ = h.audit.Create(r.Context(), tenantID, nil, "", "member.invited", body.Email, r.RemoteAddr, nil)

	respond.JSON(w, r, http.StatusCreated, inv)
}

// AcceptInvite handles POST /v1/team/invitations/accept — a public endpoint.
// It validates the invitation token, creates the member with a password, and
// marks the invitation accepted.
func (h *TeamHandler) AcceptInvite(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token    string `json:"token"`
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Token == "" || body.Password == "" {
		respond.BadRequest(w, r, "invalid_body", "token and password are required")
		return
	}
	if len(body.Password) < 8 {
		respond.BadRequest(w, r, "weak_password", "password must be at least 8 characters")
		return
	}

	inv, err := h.invitations.GetByToken(r.Context(), body.Token)
	if err != nil {
		respond.BadRequest(w, r, "invalid_token", "invitation is invalid or has expired")
		return
	}
	if inv.AcceptedAt != nil {
		respond.BadRequest(w, r, "already_accepted", "this invitation has already been accepted")
		return
	}
	if time.Now().UTC().After(inv.ExpiresAt) {
		respond.BadRequest(w, r, "invitation_expired", "this invitation has expired — ask for a new one")
		return
	}

	passwordHash := HashPassword(body.Password)
	member, err := h.members.Create(r.Context(), inv.TenantID, inv.Email, body.Name, inv.Role, domain.MemberStatusActive, &passwordHash)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	if _, err := h.invitations.Accept(r.Context(), body.Token); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	_, _ = h.audit.Create(r.Context(), inv.TenantID, &member.ID, member.Email, "member.joined", member.Email, r.RemoteAddr, nil)

	respond.JSON(w, r, http.StatusCreated, map[string]interface{}{
		"message": "Invitation accepted. You can now log in.",
	})
}

// UpdateMemberRole changes a member's role.
func (h *TeamHandler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "member ID is not a valid UUID")
		return
	}

	var body struct {
		Role domain.MemberRole `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Role == "" {
		respond.BadRequest(w, r, "invalid_body", "role is required")
		return
	}

	// Prevent changing own role
	member, err := h.members.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	updated, err := h.members.UpdateRole(r.Context(), id, tenantID, body.Role)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	// Audit log
	_, _ = h.audit.Create(r.Context(), tenantID, nil, "", "member.role_changed",
		member.Email+":"+string(body.Role), r.RemoteAddr, nil)

	respond.JSON(w, r, http.StatusOK, updated)
}

// RemoveMember removes a team member.
func (h *TeamHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "member ID is not a valid UUID")
		return
	}

	member, err := h.members.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respond.NotFound(w, r)
		return
	}

	// Prevent removing the owner
	if member.Role == domain.MemberRoleOwner {
		respond.BadRequest(w, r, "cannot_remove_owner", "workspace owner cannot be removed")
		return
	}

	if err := h.members.Delete(r.Context(), id, tenantID); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	// Audit log
	_, _ = h.audit.Create(r.Context(), tenantID, nil, "", "member.removed", member.Email, r.RemoteAddr, nil)

	respond.JSON(w, r, http.StatusOK, map[string]string{"status": "removed"})
}

// RevokeInvitation cancels a pending invitation.
func (h *TeamHandler) RevokeInvitation(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.BadRequest(w, r, "invalid_id", "invitation ID is not a valid UUID")
		return
	}

	if err := h.invitations.Delete(r.Context(), id, tenantID); err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]string{"status": "revoked"})
}

// ListAuditLog returns recent administrative activity for the tenant.
func (h *TeamHandler) ListAuditLog(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r.Context())

	entries, err := h.audit.List(r.Context(), tenantID, 50, 0)
	if err != nil {
		respond.InternalError(w, r, err)
		return
	}

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"data": entries,
	})
}

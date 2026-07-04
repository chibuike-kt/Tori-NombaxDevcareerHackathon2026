package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/middleware"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type TeamHandler struct {
	members     domain.MemberRepository
	invitations domain.InvitationRepository
	audit       domain.AuditRepository
}

func NewTeamHandler(members domain.MemberRepository, invitations domain.InvitationRepository, audit domain.AuditRepository) *TeamHandler {
	return &TeamHandler{members: members, invitations: invitations, audit: audit}
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

	// Audit log
	_, _ = h.audit.Create(r.Context(), tenantID, nil, "", "member.invited", body.Email, r.RemoteAddr, nil)

	respond.JSON(w, r, http.StatusCreated, inv)
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

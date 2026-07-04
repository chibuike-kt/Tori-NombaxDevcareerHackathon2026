package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	db "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ── Member repo ──────────────────────────────────────────────────────────────

type MemberRepo struct {
	q *db.Queries
}

func NewMemberRepo(pool *pgxpool.Pool) *MemberRepo {
	return &MemberRepo{q: db.New(pool)}
}

func memberFromRow(row db.Member) *domain.Member {
	m := &domain.Member{
		ID:        row.ID,
		TenantID:  row.TenantID,
		Email:     row.Email,
		Role:      domain.MemberRole(row.Role),
		Status:    domain.MemberStatus(row.Status),
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
	}
	if row.Name.Valid {
		m.Name = row.Name.String
	}
	if row.LastLoginAt.Valid {
		t := row.LastLoginAt.Time
		m.LastLoginAt = &t
	}
	if row.PasswordHash.Valid {
		m.PasswordHash = row.PasswordHash.String
	}
	return m
}

func (r *MemberRepo) Create(ctx context.Context, tenantID uuid.UUID, email, name string, role domain.MemberRole, status domain.MemberStatus, passwordHash *string) (*domain.Member, error) {
	ph := pgtype.Text{}
	if passwordHash != nil {
		ph = pgtype.Text{String: *passwordHash, Valid: true}
	}
	row, err := r.q.CreateMember(ctx, db.CreateMemberParams{
		TenantID:     tenantID,
		Email:        email,
		Name:         pgtype.Text{String: name, Valid: name != ""},
		Role:         string(role),
		Status:       string(status),
		PasswordHash: ph,
	})
	if err != nil {
		return nil, fmt.Errorf("create member: %w", err)
	}
	return memberFromRow(row), nil
}

func (r *MemberRepo) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*domain.Member, error) {
	row, err := r.q.GetMemberByID(ctx, db.GetMemberByIDParams{ID: id, TenantID: tenantID})
	if err != nil {
		return nil, fmt.Errorf("get member: %w", err)
	}
	return memberFromRow(row), nil
}

func (r *MemberRepo) GetByEmail(ctx context.Context, tenantID uuid.UUID, email string) (*domain.Member, error) {
	row, err := r.q.GetMemberByEmail(ctx, db.GetMemberByEmailParams{TenantID: tenantID, Email: email})
	if err != nil {
		return nil, fmt.Errorf("get member by email: %w", err)
	}
	return memberFromRow(row), nil
}

func (r *MemberRepo) GetByEmailAcrossTenants(ctx context.Context, email string) (*domain.Member, error) {
	row, err := r.q.GetMemberByEmailAcrossTenants(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("get member by email across tenants: %w", err)
	}
	return memberFromRow(row), nil
}

func (r *MemberRepo) List(ctx context.Context, tenantID uuid.UUID) ([]*domain.Member, error) {
	rows, err := r.q.ListMembers(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list members: %w", err)
	}
	members := make([]*domain.Member, len(rows))
	for i, row := range rows {
		members[i] = memberFromRow(row)
	}
	return members, nil
}

func (r *MemberRepo) UpdateRole(ctx context.Context, id, tenantID uuid.UUID, role domain.MemberRole) (*domain.Member, error) {
	row, err := r.q.UpdateMemberRole(ctx, db.UpdateMemberRoleParams{ID: id, TenantID: tenantID, Role: string(role)})
	if err != nil {
		return nil, fmt.Errorf("update member role: %w", err)
	}
	return memberFromRow(row), nil
}

func (r *MemberRepo) UpdateStatus(ctx context.Context, id, tenantID uuid.UUID, status domain.MemberStatus) (*domain.Member, error) {
	row, err := r.q.UpdateMemberStatus(ctx, db.UpdateMemberStatusParams{ID: id, TenantID: tenantID, Status: string(status)})
	if err != nil {
		return nil, fmt.Errorf("update member status: %w", err)
	}
	return memberFromRow(row), nil
}

func (r *MemberRepo) Delete(ctx context.Context, id, tenantID uuid.UUID) error {
	return r.q.DeleteMember(ctx, db.DeleteMemberParams{ID: id, TenantID: tenantID})
}

// ── Invitation repo ───────────────────────────────────────────────────────────

type InvitationRepo struct {
	q *db.Queries
}

func NewInvitationRepo(pool *pgxpool.Pool) *InvitationRepo {
	return &InvitationRepo{q: db.New(pool)}
}

func invitationFromRow(row db.Invitation) *domain.Invitation {
	inv := &domain.Invitation{
		ID:        row.ID,
		TenantID:  row.TenantID,
		Email:     row.Email,
		Role:      domain.MemberRole(row.Role),
		Token:     row.Token,
		ExpiresAt: row.ExpiresAt,
		CreatedAt: row.CreatedAt,
	}
	if row.InvitedBy.Valid {
		id := row.InvitedBy.Bytes
		uid := uuid.UUID(id)
		inv.InvitedBy = &uid
	}
	if row.AcceptedAt.Valid {
		t := row.AcceptedAt.Time
		inv.AcceptedAt = &t
	}
	return inv
}

func (r *InvitationRepo) Create(ctx context.Context, tenantID uuid.UUID, email string, role domain.MemberRole, token string, invitedBy *uuid.UUID, expiresAt time.Time) (*domain.Invitation, error) {
	ib := pgtype.UUID{}
	if invitedBy != nil {
		ib = pgtype.UUID{Bytes: *invitedBy, Valid: true}
	}
	row, err := r.q.CreateInvitation(ctx, db.CreateInvitationParams{
		TenantID:  tenantID,
		Email:     email,
		Role:      string(role),
		Token:     token,
		InvitedBy: ib,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return nil, fmt.Errorf("create invitation: %w", err)
	}
	return invitationFromRow(row), nil
}

func (r *InvitationRepo) GetByToken(ctx context.Context, token string) (*domain.Invitation, error) {
	row, err := r.q.GetInvitationByToken(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("get invitation: %w", err)
	}
	return invitationFromRow(row), nil
}

func (r *InvitationRepo) List(ctx context.Context, tenantID uuid.UUID) ([]*domain.Invitation, error) {
	rows, err := r.q.ListInvitations(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list invitations: %w", err)
	}
	invs := make([]*domain.Invitation, len(rows))
	for i, row := range rows {
		invs[i] = invitationFromRow(row)
	}
	return invs, nil
}

func (r *InvitationRepo) Accept(ctx context.Context, token string) (*domain.Invitation, error) {
	row, err := r.q.AcceptInvitation(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("accept invitation: %w", err)
	}
	return invitationFromRow(row), nil
}

func (r *InvitationRepo) Delete(ctx context.Context, id, tenantID uuid.UUID) error {
	return r.q.DeleteInvitation(ctx, db.DeleteInvitationParams{ID: id, TenantID: tenantID})
}

// ── Audit repo ────────────────────────────────────────────────────────────────

type AuditRepo struct {
	q *db.Queries
}

func NewAuditRepo(pool *pgxpool.Pool) *AuditRepo {
	return &AuditRepo{q: db.New(pool)}
}

func auditFromRow(row db.AuditLog) *domain.AuditEntry {
	entry := &domain.AuditEntry{
		ID:        row.ID,
		TenantID:  row.TenantID,
		Action:    row.Action,
		CreatedAt: row.CreatedAt,
	}
	if row.ActorID.Valid {
		id := uuid.UUID(row.ActorID.Bytes)
		entry.ActorID = &id
	}
	if row.ActorEmail.Valid {
		entry.ActorEmail = row.ActorEmail.String
	}
	if row.Target.Valid {
		entry.Target = row.Target.String
	}
	if row.IpAddress.Valid {
		entry.IPAddress = row.IpAddress.String
	}
	if row.Metadata != nil {
		entry.Metadata = json.RawMessage(row.Metadata)
	}
	return entry
}

func (r *AuditRepo) Create(ctx context.Context, tenantID uuid.UUID, actorID *uuid.UUID, actorEmail, action, target, ip string, metadata json.RawMessage) (*domain.AuditEntry, error) {
	aid := pgtype.UUID{}
	if actorID != nil {
		aid = pgtype.UUID{Bytes: *actorID, Valid: true}
	}
	row, err := r.q.CreateAuditLog(ctx, db.CreateAuditLogParams{
		TenantID:   tenantID,
		ActorID:    aid,
		ActorEmail: pgtype.Text{String: actorEmail, Valid: actorEmail != ""},
		Action:     action,
		Target:     pgtype.Text{String: target, Valid: target != ""},
		IpAddress:  pgtype.Text{String: ip, Valid: ip != ""},
		Metadata:   metadata,
	})
	if err != nil {
		return nil, fmt.Errorf("create audit log: %w", err)
	}
	return auditFromRow(row), nil
}

func (r *AuditRepo) List(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*domain.AuditEntry, error) {
	rows, err := r.q.ListAuditLog(ctx, db.ListAuditLogParams{
		TenantID: tenantID,
		Limit:    int32(limit),
		Offset:   int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("list audit log: %w", err)
	}
	entries := make([]*domain.AuditEntry, len(rows))
	for i, row := range rows {
		entries[i] = auditFromRow(row)
	}
	return entries, nil
}

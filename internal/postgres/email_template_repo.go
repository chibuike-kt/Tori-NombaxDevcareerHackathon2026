package postgres

import (
	"context"
	"errors"
	"fmt"

	db "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/db/generated"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type EmailTemplateRepo struct {
	q *db.Queries
}

func NewEmailTemplateRepo(pool *pgxpool.Pool) *EmailTemplateRepo {
	return &EmailTemplateRepo{q: db.New(pool)}
}

func emailTemplateFromRow(row db.EmailTemplate) *domain.EmailTemplate {
	return &domain.EmailTemplate{
		ID:         row.ID,
		TenantID:   row.TenantID,
		EventType:  row.EventType,
		Subject:    row.Subject,
		HTMLBody:   row.HtmlBody,
		IsEnabled:  row.IsEnabled,
		UseDefault: row.UseDefault,
		CreatedAt:  row.CreatedAt,
		UpdatedAt:  row.UpdatedAt,
	}
}

func (r *EmailTemplateRepo) Get(ctx context.Context, tenantID uuid.UUID, eventType string) (*domain.EmailTemplate, error) {
	row, err := r.q.GetEmailTemplate(ctx, db.GetEmailTemplateParams{TenantID: tenantID, EventType: eventType})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get email template: %w", err)
	}
	return emailTemplateFromRow(row), nil
}

func (r *EmailTemplateRepo) List(ctx context.Context, tenantID uuid.UUID) ([]*domain.EmailTemplate, error) {
	rows, err := r.q.ListEmailTemplates(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list email templates: %w", err)
	}
	templates := make([]*domain.EmailTemplate, len(rows))
	for i, row := range rows {
		templates[i] = emailTemplateFromRow(row)
	}
	return templates, nil
}

func (r *EmailTemplateRepo) Upsert(ctx context.Context, tenantID uuid.UUID, eventType, subject, htmlBody string, isEnabled, useDefault bool) (*domain.EmailTemplate, error) {
	row, err := r.q.UpsertEmailTemplate(ctx, db.UpsertEmailTemplateParams{
		TenantID:   tenantID,
		EventType:  eventType,
		Subject:    subject,
		HtmlBody:   htmlBody,
		IsEnabled:  isEnabled,
		UseDefault: useDefault,
	})
	if err != nil {
		return nil, fmt.Errorf("upsert email template: %w", err)
	}
	return emailTemplateFromRow(row), nil
}

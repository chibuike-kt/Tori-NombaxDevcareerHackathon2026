-- name: CreateMember :one
INSERT INTO members (tenant_id, email, name, role, status, password_hash)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetMemberByID :one
SELECT * FROM members WHERE id = $1 AND tenant_id = $2;

-- name: GetMemberByEmail :one
SELECT * FROM members WHERE tenant_id = $1 AND email = $2;

-- name: ListMembers :many
SELECT * FROM members WHERE tenant_id = $1 ORDER BY created_at ASC;

-- name: UpdateMemberRole :one
UPDATE members SET role = $3, updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: UpdateMemberStatus :one
UPDATE members SET status = $3, updated_at = NOW()
WHERE id = $1 AND tenant_id = $2
RETURNING *;

-- name: UpdateMemberLastLogin :exec
UPDATE members SET last_login_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: DeleteMember :exec
DELETE FROM members WHERE id = $1 AND tenant_id = $2;

-- name: CreateInvitation :one
INSERT INTO invitations (tenant_id, email, role, token, invited_by, expires_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetInvitationByToken :one
SELECT * FROM invitations WHERE token = $1;

-- name: ListInvitations :many
SELECT * FROM invitations
WHERE tenant_id = $1 AND accepted_at IS NULL
ORDER BY created_at DESC;

-- name: AcceptInvitation :one
UPDATE invitations SET accepted_at = NOW()
WHERE token = $1
RETURNING *;

-- name: DeleteInvitation :exec
DELETE FROM invitations WHERE id = $1 AND tenant_id = $2;

-- name: CreateAuditLog :one
INSERT INTO audit_log (tenant_id, actor_id, actor_email, action, target, ip_address, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListAuditLog :many
SELECT * FROM audit_log
WHERE tenant_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

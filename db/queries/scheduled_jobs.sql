-- name: EnqueueJob :one
INSERT INTO scheduled_jobs (tenant_id, job_type, payload, scheduled_at, max_attempts, mode)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ClaimNextJob :one
-- SKIP LOCKED means concurrent workers won't block each other.
UPDATE scheduled_jobs
SET
    status    = 'processing',
    locked_at = NOW(),
    locked_by = $1,
    attempts  = attempts + 1
WHERE id = (
    SELECT id FROM scheduled_jobs
    WHERE status = 'pending'
      AND scheduled_at <= NOW()
      AND attempts < max_attempts
    ORDER BY scheduled_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
RETURNING *;

-- name: MarkJobDone :exec
UPDATE scheduled_jobs SET status = 'done' WHERE id = $1;

-- name: MarkJobFailed :exec
UPDATE scheduled_jobs SET status = 'failed', last_error = $2 WHERE id = $1;

-- name: RequeueJob :exec
UPDATE scheduled_jobs
SET status = 'pending', scheduled_at = $2, locked_at = NULL, locked_by = NULL
WHERE id = $1;

-- name: RecoverStaleLocks :exec
-- Jobs locked more than 10 minutes ago by a crashed worker go back to pending.
UPDATE scheduled_jobs
SET status = 'pending', locked_at = NULL, locked_by = NULL
WHERE status = 'processing'
  AND locked_at < NOW() - INTERVAL '10 minutes';

-- name: GetJobQueueDepth :one
SELECT COUNT(*) AS depth FROM scheduled_jobs WHERE status = 'pending';

-- name: ListFailedJobs :many
SELECT * FROM scheduled_jobs
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: RetryJob :exec
UPDATE scheduled_jobs
SET status = 'pending', attempts = 0, last_error = NULL, scheduled_at = NOW()
WHERE id = $1;

-- name: CancelPendingJobsForSubscription :exec
UPDATE scheduled_jobs
SET status = 'cancelled'
WHERE status = 'pending'
  AND payload->>'subscription_id' = $1;

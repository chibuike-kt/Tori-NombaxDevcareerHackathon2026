package scheduler

import (
	"context"
	"encoding/json"
	"os"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/rs/zerolog/log"
)

// JobHandler is a function that processes a single job payload.
type JobHandler func(ctx context.Context, payload json.RawMessage) error

// Worker polls the job queue and dispatches to registered handlers.
type Worker struct {
	jobs     domain.JobRepository
	handlers map[domain.JobType]JobHandler
	interval time.Duration
	id       string
}

func NewWorker(jobs domain.JobRepository, interval time.Duration) *Worker {
	id := os.Getenv("WORKER_INSTANCE_ID")
	if id == "" {
		id = "worker-1"
	}
	return &Worker{
		jobs:     jobs,
		handlers: make(map[domain.JobType]JobHandler),
		interval: interval,
		id:       id,
	}
}

// Register adds a handler for a job type.
func (w *Worker) Register(jobType domain.JobType, handler JobHandler) {
	w.handlers[jobType] = handler
}

// Run starts the polling loop. Blocks until ctx is cancelled.
func (w *Worker) Run(ctx context.Context) {
	log.Info().Str("worker_id", w.id).Msg("worker started")
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	// Also run stale lock recovery every 5 minutes.
	staleTicker := time.NewTicker(5 * time.Minute)
	defer staleTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Info().Str("worker_id", w.id).Msg("worker stopping")
			return
		case <-staleTicker.C:
			if err := w.jobs.RecoverStaleLocks(ctx); err != nil {
				log.Error().Err(err).Msg("stale lock recovery failed")
			}
		case <-ticker.C:
			w.processNext(ctx)
		}
	}
}

func (w *Worker) processNext(ctx context.Context) {
	job, err := w.jobs.ClaimNext(ctx, w.id)
	if err != nil {
		// No jobs available is normal — not an error worth logging.
		return
	}
	if job == nil {
		return
	}

	logger := log.With().
		Str("job_id", job.ID.String()).
		Str("job_type", string(job.JobType)).
		Int("attempt", job.Attempts).
		Logger()

	handler, ok := w.handlers[job.JobType]
	if !ok {
		logger.Error().Msg("no handler registered for job type")
		_ = w.jobs.MarkFailed(ctx, job.ID, "no handler registered")
		return
	}

	logger.Info().Msg("processing job")

if err := handler(ctx, job.Payload); err != nil {
    logger.Error().Err(err).Msg("job failed")
    _ = w.jobs.MarkFailed(ctx, job.ID, err.Error())

    // Alert if this job has exhausted all attempts
    if job.Attempts+1 >= job.MaxAttempts {
        logger.Error().
            Str("job_id", job.ID.String()).
            Str("job_type", string(job.JobType)).
            Int("attempts", job.Attempts+1).
            RawJSON("payload", job.Payload).
            Msg("DEAD LETTER: job exhausted all retry attempts and will not be retried — manual intervention required")
    }
    return
}

	_ = w.jobs.MarkDone(ctx, job.ID)
	logger.Info().Msg("job done")
}

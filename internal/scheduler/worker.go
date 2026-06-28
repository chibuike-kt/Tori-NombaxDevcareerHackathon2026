package scheduler

import (
	"context"
	"encoding/json"
	"fmt"
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
		id = "worker"
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

// RunPool starts n concurrent polling goroutines.
// Each goroutine has its own ID and independently claims jobs via SKIP LOCKED.
// Because PostgreSQL SKIP LOCKED is used, multiple goroutines never process the same job.
func (w *Worker) RunPool(ctx context.Context, n int) {
	for i := 1; i <= n; i++ {
		clone := &Worker{
			jobs:     w.jobs,
			handlers: w.handlers, // shared — handlers are stateless
			interval: w.interval,
			id:       fmt.Sprintf("%s-%d", w.id, i),
		}
		go clone.Run(ctx)
	}
	log.Info().Int("pool_size", n).Msg("worker pool started")
}

// Run starts the polling loop. Blocks until ctx is cancelled.
func (w *Worker) Run(ctx context.Context) {
	log.Info().Str("worker_id", w.id).Msg("worker started")
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	// Stale lock recovery runs on worker-1 only to avoid duplicate recovery runs
	var staleTicker *time.Ticker
	if w.id == "worker-1" {
		staleTicker = time.NewTicker(5 * time.Minute)
		defer staleTicker.Stop()
	} else {
		staleTicker = time.NewTicker(999 * time.Hour) // effectively disabled
		defer staleTicker.Stop()
	}

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
		// Dead letter alert — job exhausted all attempts
		if job.Attempts+1 >= job.MaxAttempts {
			logger.Error().
				Str("job_id", job.ID.String()).
				Str("job_type", string(job.JobType)).
				Int("attempts", job.Attempts+1).
				RawJSON("payload", job.Payload).
				Msg("DEAD LETTER: job exhausted all retry attempts — manual intervention required")
		}
		return
	}

	_ = w.jobs.MarkDone(ctx, job.ID)
	logger.Info().Msg("job done")
}

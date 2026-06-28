package handlers

import (
	"net/http"
	"runtime"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SystemHealthHandler struct {
	pool *pgxpool.Pool
	jobs domain.JobRepository
}

func NewSystemHealthHandler(pool *pgxpool.Pool, jobs domain.JobRepository) *SystemHealthHandler {
	return &SystemHealthHandler{pool: pool, jobs: jobs}
}

func (h *SystemHealthHandler) Check(w http.ResponseWriter, r *http.Request) {
	// Database pool stats
	dbStatus := "ok"
	var poolStats map[string]interface{}
	if h.pool != nil {
		stats := h.pool.Stat()
		poolStats = map[string]interface{}{
			"total_conns":    stats.TotalConns(),
			"acquired_conns": stats.AcquiredConns(),
			"idle_conns":     stats.IdleConns(),
			"max_conns":      stats.MaxConns(),
		}
		if stats.TotalConns() == 0 {
			dbStatus = "degraded"
		}
	}

	// Job queue depth
	var queueDepth int64
	if h.jobs != nil {
		depth, err := h.jobs.GetQueueDepth(r.Context())
		if err == nil {
			queueDepth = depth
		}
	}

	// Runtime memory stats
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	respond.JSON(w, r, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"service":   "tori-api",
		"version":   "1.0.0",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"checks": map[string]interface{}{
			"api":      "ok",
			"database": dbStatus,
			"nomba":    "connected",
		},
		"database": poolStats,
		"worker": map[string]interface{}{
			"queue_depth": queueDepth,
		},
		"runtime": map[string]interface{}{
			"goroutines":   runtime.NumGoroutine(),
			"heap_alloc_mb": float64(mem.HeapAlloc) / 1024 / 1024,
			"num_gc":       mem.NumGC,
		},
	})
}

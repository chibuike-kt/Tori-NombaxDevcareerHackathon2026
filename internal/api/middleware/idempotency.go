package middleware

import (
	"net/http"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/rs/zerolog/log"
)

// responseRecorder captures the status and body a handler writes so it can
// be persisted for idempotency replay, while still passing everything
// through to the real ResponseWriter unchanged.
type responseRecorder struct {
	http.ResponseWriter
	status      int
	body        []byte
	wroteHeader bool
}

func newResponseRecorder(w http.ResponseWriter) *responseRecorder {
	return &responseRecorder{ResponseWriter: w, status: http.StatusOK}
}

func (r *responseRecorder) WriteHeader(status int) {
	r.status = status
	r.wroteHeader = true
	r.ResponseWriter.WriteHeader(status)
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	if !r.wroteHeader {
		// http.ResponseWriter.Write implicitly calls WriteHeader(200) if it
		// hasn't been called yet — mirror that here so r.status is accurate.
		r.WriteHeader(http.StatusOK)
	}
	r.body = append(r.body, b...)
	return r.ResponseWriter.Write(b)
}

// IdempotencyMiddleware makes any mutating Platform API request safe to
// retry: a client that sends the same Idempotency-Key header twice (for the
// same tenant) gets the exact original response replayed back — same
// status, same body — without the operation running twice. GET/HEAD
// requests and requests with no Idempotency-Key header pass through
// unaffected.
func IdempotencyMiddleware(repo domain.IdempotencyKeyRepository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet || r.Method == http.MethodHead {
				next.ServeHTTP(w, r)
				return
			}

			key := r.Header.Get("Idempotency-Key")
			if key == "" {
				next.ServeHTTP(w, r)
				return
			}

			tenantID := GetTenantID(r.Context())
			mode := GetMode(r.Context())

			w.Header().Set("Idempotency-Key", key)

			if existing, err := repo.Get(r.Context(), tenantID, key); err == nil && existing != nil {
				w.Header().Set("Idempotency-Replayed", "true")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(existing.ResponseStatus)
				_, _ = w.Write(existing.ResponseBody)
				return
			}

			rec := newResponseRecorder(w)
			next.ServeHTTP(rec, r)

			// Only store successful responses — a failed attempt (a 4xx/5xx)
			// should be retryable with the same key, not permanently replayed.
			if rec.status >= 200 && rec.status < 300 {
				if err := repo.Store(r.Context(), tenantID, key, r.URL.Path, r.Method, rec.status, rec.body, mode); err != nil {
					log.Error().Err(err).Str("idempotency_key", key).Str("path", r.URL.Path).
						Msg("idempotency: failed to store response")
				}
			}
		})
	}
}

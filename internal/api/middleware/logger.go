package middleware

import (
	"net/http"
	"time"

	apicontext "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/context"
	"github.com/rs/zerolog/log"
)

// responseWriter wraps http.ResponseWriter to capture the status code.
type responseWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (rw *responseWriter) WriteHeader(status int) {
	rw.status = status
	rw.ResponseWriter.WriteHeader(status)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.bytes += n
	return n, err
}

// RequestLogger logs every request with method, path, status, latency, and request ID.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}

		next.ServeHTTP(rw, r)

		latency := time.Since(start)
		requestID := apicontext.GetRequestID(r.Context())

		logger := log.Info()
		if rw.status >= 500 {
			logger = log.Error()
		} else if rw.status >= 400 {
			logger = log.Warn()
		}

		logger.
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Int("status", rw.status).
			Dur("latency_ms", latency).
			Int("bytes", rw.bytes).
			Str("request_id", requestID).
			Str("ip", r.RemoteAddr).
			Msg("request")
	})
}

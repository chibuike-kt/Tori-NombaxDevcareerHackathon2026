package middleware

import (
	"net/http"

	apicontext "github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/context"
	"github.com/google/uuid"
)

func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := uuid.New().String()
		ctx := apicontext.SetRequestID(r.Context(), id)
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

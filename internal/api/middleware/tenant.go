package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/api/respond"
	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
)

type tenantContextKey string

const tenantKey tenantContextKey = "tenant"

// HashAPIKey produces the SHA-256 hex digest of a plaintext API key.
func HashAPIKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func APIKeyAuth(tenants domain.TenantRepository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.Header.Get("X-API-Key")
			if key == "" {
				respond.Unauthorised(w, r, "missing API key")
				return
			}

			hash := HashAPIKey(key)
			tenant, err := tenants.GetByAPIKeyHash(r.Context(), hash)
			if err != nil {
				respond.Unauthorised(w, r, "invalid API key")
				return
			}

			ctx := context.WithValue(r.Context(), tenantKey, tenant)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func JWTAuth(secret string, tenants domain.TenantRepository, tokens domain.TokenRevoker) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				respond.Unauthorised(w, r, "missing bearer token")
				return
			}
			token := strings.TrimPrefix(header, "Bearer ")

			// Check Redis denylist before validating JWT
			if tokens.IsRevoked(r.Context(), token) {
				respond.Unauthorised(w, r, "token has been revoked")
				return
			}

			tenantID, err := validateJWT(token, secret)
			if err != nil {
				respond.Unauthorised(w, r, "invalid token")
				return
			}

			tenant, err := tenants.GetByID(r.Context(), tenantID)
			if err != nil {
				respond.Unauthorised(w, r, "tenant not found")
				return
			}

			ctx := context.WithValue(r.Context(), tenantKey, tenant)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetTenant(ctx context.Context) *domain.Tenant {
	if t, ok := ctx.Value(tenantKey).(*domain.Tenant); ok {
		return t
	}
	return nil
}

func GetTenantID(ctx context.Context) uuid.UUID {
	if t := GetTenant(ctx); t != nil {
		return t.ID
	}
	return uuid.Nil
}

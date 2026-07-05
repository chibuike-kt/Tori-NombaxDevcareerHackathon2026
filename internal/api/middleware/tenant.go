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

type apiKeyModeContextKey string

const apiKeyModeKey apiKeyModeContextKey = "api_key_mode"

// WithAPIKeyMode attaches the mode ("test" or "live") of the API key that
// authenticated the request to the context.
func WithAPIKeyMode(ctx context.Context, mode string) context.Context {
	return context.WithValue(ctx, apiKeyModeKey, mode)
}

// GetAPIKeyMode returns the API key mode for the request, defaulting to
// "live" for JWT-authenticated dashboard requests and background jobs that
// never carry an API key.
func GetAPIKeyMode(ctx context.Context) string {
	if m, ok := ctx.Value(apiKeyModeKey).(string); ok && m != "" {
		return m
	}
	return "live"
}

type sessionIDContextKey string

const sessionIDKey sessionIDContextKey = "session_id"

// WithSessionID attaches the current request's session ID to the context.
func WithSessionID(ctx context.Context, sessionID string) context.Context {
	return context.WithValue(ctx, sessionIDKey, sessionID)
}

// GetSessionID returns the session ID for the current request, or "" if the
// request was not authenticated via a session-tracked JWT.
func GetSessionID(ctx context.Context) string {
	if id, ok := ctx.Value(sessionIDKey).(string); ok {
		return id
	}
	return ""
}

// HashAPIKey produces the SHA-256 hex digest of a plaintext API key.
func HashAPIKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

func APIKeyAuth(tenants domain.TenantRepository, apiKeys domain.APIKeyRepository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.Header.Get("X-API-Key")
			if key == "" {
				respond.Unauthorised(w, r, "missing API key")
				return
			}

			hash := HashAPIKey(key)
			record, err := apiKeys.GetByHash(r.Context(), hash)
			if err != nil {
				respond.Unauthorised(w, r, "invalid API key")
				return
			}

			tenant, err := tenants.GetByID(r.Context(), record.TenantID)
			if err != nil {
				respond.Unauthorised(w, r, "invalid API key")
				return
			}

			_ = apiKeys.TouchLastUsed(r.Context(), record.ID)

			ctx := context.WithValue(r.Context(), tenantKey, tenant)
			ctx = WithAPIKeyMode(ctx, record.Mode)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func JWTAuth(secret string, tenants domain.TenantRepository, tokens domain.TokenRevoker, sessions domain.SessionRepository) func(http.Handler) http.Handler {
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

			tenantID, sessionID, err := validateJWT(token, secret)
			if err != nil {
				respond.Unauthorised(w, r, "invalid token")
				return
			}

			// Empty sessionID means the token predates session tracking —
			// let it through rather than force-logging out existing users.
			if sessionID != "" && !sessions.IsActive(r.Context(), tenantID, sessionID) {
				respond.Unauthorised(w, r, "session has been revoked")
				return
			}

			tenant, err := tenants.GetByID(r.Context(), tenantID)
			if err != nil {
				respond.Unauthorised(w, r, "tenant not found")
				return
			}

			ctx := context.WithValue(r.Context(), tenantKey, tenant)
			ctx = WithSessionID(ctx, sessionID)
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

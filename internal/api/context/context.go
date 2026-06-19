package apicontext

import (
	"context"
	"net/http"

	"github.com/google/uuid"
)

type contextKey string

const (
	requestIDKey contextKey = "request_id"
	tenantKey    contextKey = "tenant"
)

func SetRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey, id)
}

func GetRequestID(ctx context.Context) string {
	if id, ok := ctx.Value(requestIDKey).(string); ok {
		return id
	}
	return ""
}

func SetRequestIDHeader(w http.ResponseWriter, id string) {
	w.Header().Set("X-Request-ID", id)
}

func GetTenantID(ctx context.Context) uuid.UUID {
	if id, ok := ctx.Value(tenantKey).(uuid.UUID); ok {
		return id
	}
	return uuid.Nil
}

func SetTenantID(ctx context.Context, id uuid.UUID) context.Context {
	return context.WithValue(ctx, tenantKey, id)
}

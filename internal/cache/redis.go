package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"time"

	"github.com/chibuike-kt/Tori-NombaxDevcareerHackathon2026/internal/domain"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type TokenStore struct {
	client *redis.Client
}

func NewTokenStore() (*TokenStore, error) {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = os.Getenv("REDIS_URL")
	}
	if addr == "" {
		addr = "redis:6379"
	}
	password := os.Getenv("REDIS_PASSWORD")

	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     password,
		DB:           0,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis connection failed: %w", err)
	}

	return &TokenStore{client: client}, nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return "revoked:" + hex.EncodeToString(h[:])
}

func (s *TokenStore) Revoke(ctx context.Context, token string, expiresAt time.Time) error {
	key := hashToken(token)
	ttl := time.Until(expiresAt)
	if ttl <= 0 {
		return nil
	}
	return s.client.Set(ctx, key, "1", ttl).Err()
}

func (s *TokenStore) IsRevoked(ctx context.Context, token string) bool {
	key := hashToken(token)
	val, err := s.client.Get(ctx, key).Result()
	if err != nil {
		return false
	}
	return val == "1"
}

const maxLoginAttempts = 5
const lockoutDuration = 15 * time.Minute

func (s *TokenStore) RecordLoginFailure(ctx context.Context, email string) (int, error) {
	key := "login_failures:" + email
	count, err := s.client.Incr(ctx, key).Result()
	if err != nil {
		return 0, err
	}
	if count == 1 {
		s.client.Expire(ctx, key, lockoutDuration)
	}
	return int(count), nil
}

func (s *TokenStore) IsLoginLocked(ctx context.Context, email string) bool {
	key := "login_failures:" + email
	count, err := s.client.Get(ctx, key).Int()
	if err != nil {
		return false
	}
	return count >= maxLoginAttempts
}

func (s *TokenStore) ClearLoginFailures(ctx context.Context, email string) {
	s.client.Del(ctx, "login_failures:"+email)
}

// ── Session tracking ─────────────────────────────────────────────────────────
// Sessions are keyed by tenant so the dashboard can list and individually
// revoke a tenant's active logins. The session ID is embedded in both the
// access and refresh JWTs at issuance — it is not the token itself, so a
// session can be listed and revoked without ever storing raw tokens.

type sessionRecord struct {
	IPAddress  string    `json:"ip_address"`
	UserAgent  string    `json:"user_agent"`
	CreatedAt  time.Time `json:"created_at"`
	LastSeenAt time.Time `json:"last_seen_at"`
}

func sessionKey(tenantID uuid.UUID, sessionID string) string {
	return "session:" + tenantID.String() + ":" + sessionID
}

func sessionIndexKey(tenantID uuid.UUID) string {
	return "session_index:" + tenantID.String()
}

func (s *TokenStore) Create(ctx context.Context, tenantID uuid.UUID, sessionID, ipAddress, userAgent string, ttl time.Duration) error {
	now := time.Now().UTC()
	data, err := json.Marshal(sessionRecord{
		IPAddress:  ipAddress,
		UserAgent:  userAgent,
		CreatedAt:  now,
		LastSeenAt: now,
	})
	if err != nil {
		return err
	}

	pipe := s.client.TxPipeline()
	pipe.Set(ctx, sessionKey(tenantID, sessionID), data, ttl)
	pipe.SAdd(ctx, sessionIndexKey(tenantID), sessionID)
	pipe.Expire(ctx, sessionIndexKey(tenantID), ttl)
	_, err = pipe.Exec(ctx)
	return err
}

func (s *TokenStore) Touch(ctx context.Context, tenantID uuid.UUID, sessionID string) error {
	key := sessionKey(tenantID, sessionID)
	data, err := s.client.Get(ctx, key).Bytes()
	if err != nil {
		return err
	}
	var rec sessionRecord
	if err := json.Unmarshal(data, &rec); err != nil {
		return err
	}
	rec.LastSeenAt = time.Now().UTC()

	ttl := s.client.TTL(ctx, key).Val()
	if ttl <= 0 {
		return nil
	}
	updated, err := json.Marshal(rec)
	if err != nil {
		return err
	}
	return s.client.Set(ctx, key, updated, ttl).Err()
}

func (s *TokenStore) IsActive(ctx context.Context, tenantID uuid.UUID, sessionID string) bool {
	exists, err := s.client.Exists(ctx, sessionKey(tenantID, sessionID)).Result()
	return err == nil && exists == 1
}

func (s *TokenStore) List(ctx context.Context, tenantID uuid.UUID) ([]*domain.Session, error) {
	ids, err := s.client.SMembers(ctx, sessionIndexKey(tenantID)).Result()
	if err != nil {
		return nil, err
	}

	sessions := make([]*domain.Session, 0, len(ids))
	for _, id := range ids {
		data, err := s.client.Get(ctx, sessionKey(tenantID, id)).Bytes()
		if err != nil {
			// Expired or already revoked — prune the stale index entry.
			s.client.SRem(ctx, sessionIndexKey(tenantID), id)
			continue
		}
		var rec sessionRecord
		if err := json.Unmarshal(data, &rec); err != nil {
			continue
		}
		sessions = append(sessions, &domain.Session{
			ID:         id,
			TenantID:   tenantID,
			IPAddress:  rec.IPAddress,
			UserAgent:  rec.UserAgent,
			CreatedAt:  rec.CreatedAt,
			LastSeenAt: rec.LastSeenAt,
		})
	}

	sort.Slice(sessions, func(i, j int) bool { return sessions[i].LastSeenAt.After(sessions[j].LastSeenAt) })
	return sessions, nil
}

func (s *TokenStore) RevokeSession(ctx context.Context, tenantID uuid.UUID, sessionID string) error {
	pipe := s.client.TxPipeline()
	pipe.Del(ctx, sessionKey(tenantID, sessionID))
	pipe.SRem(ctx, sessionIndexKey(tenantID), sessionID)
	_, err := pipe.Exec(ctx)
	return err
}

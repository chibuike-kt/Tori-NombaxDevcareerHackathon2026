package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

type TokenStore struct {
	client *redis.Client
}

func NewTokenStore() (*TokenStore, error) {
	addr := os.Getenv("REDIS_URL")
	if addr == "" {
		addr = "redis:6379"
	}
	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     "",
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

// Revoke marks a token as revoked until its expiry time.
// Redis automatically deletes the key when the TTL expires.
func (s *TokenStore) Revoke(ctx context.Context, token string, expiresAt time.Time) error {
	key := hashToken(token)
	ttl := time.Until(expiresAt)
	if ttl <= 0 {
		return nil // already expired, nothing to do
	}
	return s.client.Set(ctx, key, "1", ttl).Err()
}

// IsRevoked returns true if the token has been revoked.
func (s *TokenStore) IsRevoked(ctx context.Context, token string) bool {
	key := hashToken(token)
	val, err := s.client.Get(ctx, key).Result()
	if err != nil {
		return false // Redis miss or error — allow the request
	}
	return val == "1"
}

const maxLoginAttempts = 5
const lockoutDuration = 15 * time.Minute

// RecordLoginFailure increments the failed login counter for an email.
// Returns the current attempt count.
func (s *TokenStore) RecordLoginFailure(ctx context.Context, email string) (int, error) {
	key := "login_failures:" + email
	count, err := s.client.Incr(ctx, key).Result()
	if err != nil {
		return 0, err
	}
	// Set expiry on first attempt
	if count == 1 {
		s.client.Expire(ctx, key, lockoutDuration)
	}
	return int(count), nil
}

// IsLoginLocked returns true if the email has exceeded the max login attempts.
func (s *TokenStore) IsLoginLocked(ctx context.Context, email string) bool {
	key := "login_failures:" + email
	count, err := s.client.Get(ctx, key).Int()
	if err != nil {
		return false
	}
	return count >= maxLoginAttempts
}

// ClearLoginFailures resets the counter on successful login.
func (s *TokenStore) ClearLoginFailures(ctx context.Context, email string) {
	s.client.Del(ctx, "login_failures:"+email)
}

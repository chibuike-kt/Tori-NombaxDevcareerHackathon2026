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

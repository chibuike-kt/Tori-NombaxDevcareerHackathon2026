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

package middleware

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	TenantID  uuid.UUID `json:"tenant_id"`
	SessionID string    `json:"session_id,omitempty"`
	Role      string    `json:"role,omitempty"`
	jwt.RegisteredClaims
}

// GenerateJWT issues a short-lived access token carrying the member's role,
// so RequireRole checks never need a database lookup on the request path.
func GenerateJWT(tenantID uuid.UUID, sessionID, role string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	claims := Claims{
		TenantID:  tenantID,
		SessionID: sessionID,
		Role:      role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func GenerateRefreshToken(tenantID uuid.UUID, sessionID, role string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	claims := Claims{
		TenantID:  tenantID,
		SessionID: sessionID,
		Role:      role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// validateJWT returns the tenant ID, session ID, and role embedded in the
// token. SessionID and Role are empty for tokens issued before those claims
// existed.
func validateJWT(tokenStr, secret string) (uuid.UUID, string, string, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return uuid.Nil, "", "", err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return uuid.Nil, "", "", fmt.Errorf("invalid token claims")
	}

	return claims.TenantID, claims.SessionID, claims.Role, nil
}

func GeneratePortalToken(customerID uuid.UUID) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	claims := jwt.MapClaims{
		"customer_id": customerID.String(),
		"type":        "portal",
		"exp":         time.Now().Add(time.Hour).Unix(),
		"iat":         time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ValidateRefreshToken(tokenStr string) (uuid.UUID, string, string, error) {
	secret := os.Getenv("JWT_SECRET")
	return validateJWT(tokenStr, secret)
}

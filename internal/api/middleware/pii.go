package middleware

import "strings"

// MaskEmail masks an email address for safe logging.
// amaka@startup.ng → am***@startup.ng
func MaskEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 {
		return "***"
	}
	local := parts[0]
	if len(local) <= 2 {
		return "**@" + parts[1]
	}
	return local[:2] + strings.Repeat("*", len(local)-2) + "@" + parts[1]
}

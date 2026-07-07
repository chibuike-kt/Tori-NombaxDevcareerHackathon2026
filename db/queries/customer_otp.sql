-- name: CreateCustomerOTP :one
INSERT INTO customer_otp_codes (customer_id, code, expires_at)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetCustomerOTPByCode :one
SELECT * FROM customer_otp_codes WHERE code = $1;

-- name: MarkCustomerOTPUsed :exec
UPDATE customer_otp_codes SET used_at = NOW() WHERE id = $1;

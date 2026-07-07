-- Portal self-service login: a customer enters their email, gets a 6-digit
-- code, and exchanges it for a portal JWT — no dashboard account involved.
CREATE TABLE customer_otp_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    code text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_otp_codes_code ON customer_otp_codes(code);
CREATE INDEX idx_customer_otp_codes_customer ON customer_otp_codes(customer_id);

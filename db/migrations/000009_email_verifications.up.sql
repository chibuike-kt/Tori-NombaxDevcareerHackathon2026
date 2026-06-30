ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_tenant ON email_verifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_code ON email_verifications(code);

-- Mark existing tenants as verified so they are not affected by the new flow
UPDATE tenants SET email_verified = true, verified_at = NOW() WHERE email_verified = false;

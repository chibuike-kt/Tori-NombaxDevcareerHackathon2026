DROP TABLE IF EXISTS email_verifications;
ALTER TABLE tenants 
  DROP COLUMN IF EXISTS email_verified,
  DROP COLUMN IF EXISTS verified_at;

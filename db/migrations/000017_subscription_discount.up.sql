-- Persist the promo-code discount (if any) applied at checkout, in kobo, so
-- RegenerateCheckout can re-apply the same discount instead of silently
-- falling back to the plan's full price. Zero means no discount was applied.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS discount_kobo bigint NOT NULL DEFAULT 0;

# Tori Roadmap

What comes after the hackathon.

## Near term

- **Mandate setup flow** — let customers authorize a direct-debit mandate during checkout so the recovery ladder can escalate to mandate debiting without a separate setup step
- **USSD payment rail** — add USSD as a recovery option for customers on feature phones, integrated into the dunning ladder after pay-link
- **Webhook event replay** — let operators replay any historical webhook event from the dashboard, not just failed deliveries
- **Promo code analytics** — track redemption rates, revenue impact, and top-performing codes in the Finance dashboard

## Medium term

- **Multi-currency** — USD stablecoin support via Atlas (USDC/USDT) for Nigerian digital workers earning in crypto; NGN and USD in parallel ledgers
- **White-label customer portal** — custom domain support so operators can host the self-service portal at `billing.yourproduct.com`
- **ML churn prediction** — upgrade the billing health score from heuristic to a trained model on payment history, dunning attempts, and plan tenure
- **Revenue forecasting** — MRR projection with confidence intervals based on current churn rate and trial conversion

## Long term

- **Multi-product support** — one Tori tenant managing multiple products, each with its own subscription pool, plans, and webhook endpoints
- **Embedded checkout** — inline iframe checkout (no redirect) with Tori's branding layer over Nomba's card form
- **Payout rails** — direct NGN payouts to operator bank accounts from the Tori ledger balance
- **SOC 2 Type II** — when Tori goes to production at scale

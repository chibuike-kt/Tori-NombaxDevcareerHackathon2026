export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id: string }
  | { type: "h3"; text: string }
  | { type: "code"; lang?: string; code: string }
  | { type: "callout"; variant?: "info" | "warn" | "success"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; items: string[] }
  | { type: "param"; name: string; paramType: string; required?: boolean; description: string }
  | { type: "response"; status: number; description: string; body?: string };

export type Section = {
  id: string; label: string; icon: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  endpoint?: string; group?: string; blocks: Block[];
};
export type Group = { group: string; items: Section[] };
export type Tab = { id: string; label: string; groups: Group[] };

const BASE = "https://api.tori.ng";

export const TABS: Tab[] = [
  // ═══════════════════════════════════════════════════════════
  // TAB 1  DOCUMENTATION
  // ═══════════════════════════════════════════════════════════
  {
    id: "documentation",
    label: "Documentation",
    groups: [
      {
        group: "Introduction",
        items: [
          {
            id: "welcome",
            label: "Welcome to Tori",
            icon: "ti-hand-stop",
            blocks: [
              {
                type: "p",
                text: "Tori is a recurring billing engine built natively on Nomba's payment infrastructure. Nigerian card failure rates run 8 to 10 percent per billing cycle. On a 1,000 subscriber product at ₦10,000 a month with a 10 percent failure rate, that is ₦800,000 at risk every single cycle if nobody retries the failed charges correctly. Every Nigerian SaaS, edtech, and creator platform that charges customers on a recurring basis has had to build the retry logic, the state machine, and the ledger from scratch. Tori is that system, already built.",
              },
              {
                type: "callout",
                variant: "success",
                text: "Live demo available. Log in with dev@tori.ng / tori-dev-2026 to explore 20 real subscribers across all billing states, 10 months of ledger history, and real Nomba sandbox integration.",
              },
              { type: "h2", text: "What Tori does", id: "what" },
              {
                type: "list",
                items: [
                  "Charges customers through Nomba on each billing cycle: monthly, annual, or custom",
                  "Classifies payment failures and retries on Nigerian payday windows",
                  "Escalates failed payments up a recovery ladder: card retry first, then a direct debit mandate, then a manual pay link",
                  "Recovery Command Center shows every at risk, recovering, and recovered subscription with one click retry and pay link actions",
                  "Writes every charge, refund, and adjustment to an immutable double entry ledger",
                  "Records every subscription status change in a transition audit trail with a timestamp, reason, and actor",
                  "Fires signed webhooks to your product for every billing event",
                  "Reconciles every Nomba transaction against the ledger nightly",
                  "Computes MRR, churn, dunning recovery, and revenue forecast from real data",
                  "Team management with roles (owner, admin, developer, viewer), email invites, and an admin action audit log",
                  "Test and live API keys. A tori_test_ key routes to Nomba sandbox, a tori_live_ key routes to Nomba production, automatically",
                  "Promo codes with percentage or fixed discounts, plan specific codes, use limits, and expiry dates",
                  "Session management with instant revocation. See every active login with device, IP, and last active time, and kill any of them from the dashboard",
                ],
              },
              { type: "h2", text: "How it works, end to end", id: "how-it-works" },
              {
                type: "list",
                items: [
                  "You create a plan (price, interval, trial length) and get a live API key and a test API key",
                  "You call POST /v1/platform/checkout with a customer email and plan ID, and an optional promo_code",
                  "If the promo code is valid, Tori applies the discount to the first charge and returns original_amount_kobo, discount_kobo, and final_amount_kobo in the response",
                  "Tori creates a Nomba checkout session. A tori_test_ key hits Nomba sandbox. A tori_live_ key hits Nomba production. No code branching required on your side",
                  "The customer pays. Nomba fires a payment_success webhook. Tori tokenises the card and activates the subscription",
                  "On each billing cycle, Tori charges the stored token automatically. No cron job, no retry logic, on your end",
                  "If a charge fails, Tori retries on the card first, escalates to a direct debit mandate if one exists on the subscription, and falls back to a manual pay link plus a payment.action_required webhook if both fail",
                  "Every status change, for example ACTIVE to PAST_DUE or PAST_DUE to DUNNING, is written to the transition audit trail with a timestamp, a reason, and who or what triggered it",
                  "Your team can invite teammates with specific roles, review every admin action in the audit log, and revoke any login session instantly from the Security page",
                ],
              },
              { type: "h2", text: "The three objects", id: "objects" },
              {
                type: "table",
                headers: ["Object", "Represents", "Example"],
                rows: [
                  [
                    "Plan",
                    "Pricing template  amount, interval, trial",
                    "₦15,000/month, 14-day trial",
                  ],
                  [
                    "Customer",
                    "A person or business that pays you",
                    "amaka@startup.ng, linked to your user ID",
                  ],
                  [
                    "Subscription",
                    "The live billing relationship",
                    "Amaka on Pro, currently ACTIVE",
                  ],
                ],
              },
              { type: "h2", text: "What Tori does not do", id: "what-not" },
              {
                type: "p",
                text: "Tori is not a payment processor. Nomba moves the money. Tori is the orchestration layer  it decides when to charge, what to do when it fails, and how to record what happened. Think of Nomba as the engine and Tori as the transmission.",
              },
            ],
          },
          {
            id: "nomba-integration",
            label: "Nomba integration",
            icon: "ti-credit-card",
            blocks: [
              {
                type: "p",
                text: "Tori is built natively on three Nomba payment APIs. Understanding how they work together explains the full flow from signup to automatic recurring charge.",
              },
              { type: "h2", text: "The three Nomba APIs", id: "three-apis" },
              {
                type: "table",
                headers: ["API", "Nomba endpoint", "When Tori uses it"],
                rows: [
                  [
                    "Hosted checkout",
                    "POST /v1/checkout/order",
                    "Customer subscribes  creates Nomba payment page with tokenizeCard: true",
                  ],
                  [
                    "Tokenised card charge",
                    "POST /v1/checkout/tokenized-card-payment",
                    "Every renewal and dunning retry  no customer action needed",
                  ],
                  [
                    "Direct debit mandate",
                    "POST /v1/direct-debits",
                    "Alternative  bank account debit instead of card",
                  ],
                ],
              },
              {
                type: "h2",
                text: "Checkout and tokenisation flow",
                id: "checkout-flow",
              },
              {
                type: "code",
                lang: "bash",
                code: `Step 1  POST /v1/platform/checkout → Tori creates Nomba checkout session
Step 2  Tori returns checkout_url
Step 3  You redirect customer to checkout_url immediately
Step 4  Customer enters card on Nomba hosted page
Step 5  Nomba fires payment_success webhook → Tori
Step 6  Tori extracts tokenizedCardData.tokenKey
Step 7  Tori stores tokenKey on subscription
Step 8  Nomba redirects customer to your callback_url
Step 9  Every future charge uses stored tokenKey automatically`,
              },
              {
                type: "callout",
                variant: "info",
                text: "Card data never touches Tori. Tori stores only the tokenKey reference. Card numbers and CVV are handled entirely by Nomba's PCI-compliant infrastructure.",
              },
              {
                type: "h2",
                text: "Inbound webhook verification",
                id: "nomba-webhook",
              },
              {
                type: "code",
                lang: "bash",
                code: "Signed string: eventType:requestId:userId:walletId:transactionId:type:time:responseCode:timestamp\nAlgorithm: HMAC-SHA256 → base64 encode → compare with nomba-signature header",
              },
              {
                type: "p",
                text: "Tori also deduplicates Nomba webhooks by requestId via Redis with a 24-hour TTL  preventing double-processing on Nomba retries.",
              },
              {
                type: "h2",
                text: "Nightly reconciliation",
                id: "reconciliation",
              },
              {
                type: "table",
                headers: ["Outcome", "Meaning", "Action"],
                rows: [
                  [
                    "matched",
                    "Nomba transaction found in ledger, amounts agree",
                    "All good",
                  ],
                  [
                    "missing_in_ledger",
                    "Nomba has the charge, no Tori ledger entry",
                    "Review → create ADMIN_OVERRIDE entry",
                  ],
                  [
                    "amount_mismatch",
                    "Both exist but amounts differ",
                    "Investigate conversion logic",
                  ],
                ],
              },
            ],
          },
        ],
      },
      {
        group: "Getting Started",
        items: [
          {
            id: "keys",
            label: "Obtain API keys",
            icon: "ti-key",
            blocks: [
              {
                type: "p",
                text: "Every tenant gets two keys the moment you register: a live key and a test key. Every Platform API call requires one of them in the X-API-Key header. Each full key is shown exactly once, at creation or rotation.",
              },
              {
                type: "callout",
                variant: "warn",
                text: "Your API key is shown only once. Tori stores only a SHA-256 hash. If you lose it, rotate it from the API Keys page. The old key stops working immediately.",
              },
              { type: "h2", text: "Key format", id: "format" },
              {
                type: "code",
                lang: "bash",
                code: `Live:  tori_live_a5eac054adef09a31a7d823d6e71b1245deffa7eb5c8a51c765e7678e9d578c0
Test:  tori_test_4d2c9f6e1a8b3d5c7e9f0a2b4d6e8f1a3c5e7d9f1b3d5e7f9a1c3e5d7f9b1a3c`,
              },
              {
                type: "p",
                text: "The prefix is not cosmetic. Tori reads it on every Platform API request and routes accordingly: tori_live_ hits Nomba production, tori_test_ hits Nomba sandbox. See the Test mode section below for what that means in practice.",
              },
              { type: "h2", text: "Usage", id: "using" },
              {
                type: "code",
                lang: "bash",
                code: `curl ${BASE}/v1/platform/plans \\
  -H "X-API-Key: tori_live_..." \\
  -H "Content-Type: application/json"`,
              },
              { type: "h2", text: "Where to store it", id: "secret" },
              {
                type: "list",
                items: [
                  "Server environment variables (process.env.TORI_API_KEY)",
                  "Secret manager (AWS Secrets Manager, HashiCorp Vault, Railway secrets)",
                  "Never in source code, never in frontend/mobile code",
                ],
              },
            ],
          },
          {
            id: "test-mode",
            label: "Test mode",
            icon: "ti-flask",
            blocks: [
              {
                type: "p",
                text: "Use your tori_test_ key to hit Nomba sandbox. No real money moves. Everything else behaves identically to production: checkout sessions, tokenisation, webhooks, dunning, the ledger.",
              },
              { type: "h2", text: "How routing works", id: "test-routing" },
              {
                type: "p",
                text: "Tori looks at the prefix of the key on the X-API-Key header of every Platform API request. A tori_test_ key always talks to Nomba's sandbox environment, no matter what NOMBA_ENV is set to on the server. A tori_live_ key always talks to Nomba production. There is no separate test mode flag to pass in the request body. The key decides.",
              },
              {
                type: "code",
                lang: "bash",
                code: `# This call never touches real money, because the key is tori_test_
curl ${BASE}/v1/platform/checkout \\
  -H "X-API-Key: tori_test_4d2c9f6e1a8b3d5c..." \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "amaka@startup.ng", "plan_id": "plan_..." }'`,
              },
              {
                type: "callout",
                variant: "info",
                text: "The dashboard has a Live/Test toggle in the header. Switching it does not change which key your server uses. It only changes what the operator dashboard displays. Your server always uses whichever key you deployed to it.",
              },
              {
                type: "h2",
                text: "What test mode is good for",
                id: "test-uses",
              },
              {
                type: "list",
                items: [
                  "Building your integration end to end before you have real Nomba production credentials approved",
                  "Running your CI test suite against real checkout, webhook, and dunning flows without spending money",
                  "Demoing the product to a stakeholder without creating real subscriptions",
                ],
              },
              {
                type: "callout",
                variant: "warn",
                text: "Revoke and regenerate keys independently. Revoking your test key does not affect your live key, and vice versa. Rotate whichever one leaked.",
              },
            ],
          },
          {
            id: "auth",
            label: "Authentication",
            icon: "ti-lock",
            blocks: [
              {
                type: "p",
                text: "Tori has two authentication systems for two distinct purposes.",
              },
              {
                type: "table",
                headers: ["Method", "Header", "Use", "Expires"],
                rows: [
                  [
                    "API key",
                    "X-API-Key: tori_live_...",
                    "Platform API  your server",
                    "Never until rotated",
                  ],
                  [
                    "JWT access token",
                    "Authorization: Bearer eyJ...",
                    "Dashboard API",
                    "15 minutes",
                  ],
                  [
                    "Refresh token",
                    "POST /v1/auth/refresh body",
                    "Get new access token",
                    "7 days",
                  ],
                  [
                    "Portal token",
                    "?token=eyJ... query param",
                    "Customer self-service portal",
                    "1 hour",
                  ],
                ],
              },
              { type: "h2", text: "Platform API", id: "platform-auth" },
              {
                type: "code",
                lang: "bash",
                code: `curl ${BASE}/v1/platform/checkout \\
  -H "X-API-Key: tori_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "amaka@startup.ng", "plan_id": "plan_..." }'`,
              },
              { type: "h2", text: "Dashboard JWT", id: "dashboard-auth" },
              {
                type: "code",
                lang: "bash",
                code: `POST ${BASE}/v1/auth/login
{ "email": "ops@classpay.ng", "password": "yourpassword" }

# Response
{ "data": { "access_token": "eyJ...", "refresh_token": "eyJ...", "token_type": "Bearer" } }

# Then use on dashboard calls:
Authorization: Bearer eyJ...`,
              },
              {
                type: "callout",
                variant: "warn",
                text: "Never use the JWT in server code, never put the API key in browser code. Your API key has full account access  keep it server-side only.",
              },
            ],
          },
          {
            id: "first",
            label: "Quick start",
            icon: "ti-rocket",
            blocks: [
              {
                type: "p",
                text: "From zero to a live recurring subscription in four steps.",
              },
              {
                type: "callout",
                variant: "info",
                text: "All amounts are in kobo  the smallest Naira unit. ₦15,000 = 1500000 kobo. No decimal amounts anywhere in the API.",
              },
              { type: "h2", text: "1  Create a plan", id: "step-1" },
              {
                type: "code",
                lang: "bash",
                code: `curl ${BASE}/v1/platform/plans -H "X-API-Key: tori_live_..." \\
  -d '{ "name": "Pro", "amount": 1500000, "interval": "monthly", "trial_period_days": 14 }'`,
              },
              {
                type: "h2",
                text: "2  Optionally create a promo code",
                id: "step-2",
              },
              {
                type: "p",
                text: "Skip this if you are not running a discount. If you are, create the code once, then pass it on any checkout call.",
              },
              {
                type: "code",
                lang: "bash",
                code: `curl ${BASE}/v1/promo-codes -H "Authorization: Bearer eyJ..." \\
  -d '{ "code": "LAUNCH20", "discount_type": "percentage", "discount_value": 20 }'`,
              },
              { type: "h2", text: "3  Start a subscription", id: "step-3" },
              {
                type: "p",
                text: "The checkout endpoint finds or creates the customer by email and starts the subscription in one call. Always redirect the customer to checkout_url immediately  even during a free trial  so their card is tokenised now. Pass promo_code if the customer has a discount code.",
              },
              {
                type: "code",
                lang: "bash",
                code: `curl ${BASE}/v1/platform/checkout -H "X-API-Key: tori_live_..." \\
  -d '{ "email": "amaka@startup.ng", "plan_id": "plan_...",
        "external_id": "user_123", "idempotency_key": "signup_user_123",
        "callback_url": "https://yourapp.ng/payment/success",
        "promo_code": "LAUNCH20" }'`,
              },
              {
                type: "callout",
                variant: "info",
                text: "Use your tori_test_ key for this whole flow while you are building. Swap in your tori_live_ key only when you are ready to charge real customers.",
              },
              {
                type: "h2",
                text: "4  Register a webhook endpoint",
                id: "step-4",
              },
              {
                type: "code",
                lang: "bash",
                code: `curl ${BASE}/v1/webhooks/endpoints -H "Authorization: Bearer eyJ..." \\
  -d '{ "url": "https://yourapp.ng/webhooks/tori", "events": ["*"] }'`,
              },
              { type: "h2", text: "5  Handle billing events", id: "step-5" },
              {
                type: "code",
                lang: "js",
                code: `app.post('/webhooks/tori', (req, res) => {
  const sig = req.headers['x-tori-signature'];
  const expected = 'sha256=' + crypto.createHmac('sha256', process.env.TORI_WEBHOOK_SECRET)
    .update(req.body).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig)))
    return res.status(401).send('Invalid signature');

  const { event_type, data } = JSON.parse(req.body);
  switch (event_type) {
    case 'subscription.activated': grantAccess(data.customer_id); break;
    case 'dunning.exhausted':      revokeAccess(data.customer_id); break;
    case 'dunning.recovered':      grantAccess(data.customer_id); break;
    case 'subscription.cancelled': offboard(data.customer_id); break;
  }
  res.status(200).send('ok'); // always 200 immediately
});`,
              },
              {
                type: "callout",
                variant: "success",
                text: "That is the complete integration. Tori manages this customer's billing indefinitely  charging, retrying on payday windows, reconciling with Nomba, and notifying your product via webhooks.",
              },
            ],
          },
        ],
      },
      {
        group: "Core Concepts",
        items: [
          {
            id: "plans",
            label: "Plans",
            icon: "ti-file-text",
            blocks: [
              {
                type: "p",
                text: "A plan is a pricing template. Create it once  any number of customers can subscribe. Changing a plan's price only affects new subscribers; existing ones keep their original price.",
              },
              { type: "h2", text: "Billing intervals", id: "intervals" },
              {
                type: "table",
                headers: ["Interval", "When charged", "Use case"],
                rows: [
                  [
                    "monthly",
                    "Once per calendar month with correct month-end handling",
                    "SaaS, memberships",
                  ],
                  ["annual", "Once per year", "Annual plans"],
                  [
                    "custom",
                    "Every N days you specify",
                    "Termly fees, quarterly billing",
                  ],
                ],
              },
              {
                type: "callout",
                variant: "info",
                text: "Month-end billing is handled correctly. A subscription starting January 31 renews on February 28 (or 29 in a leap year), then March 31. It never drifts or skips a month.",
              },
              { type: "h2", text: "Trial periods", id: "trials" },
              {
                type: "p",
                text: "Set trial_period_days to give new subscribers a free trial. When the trial ends, Tori automatically charges the stored tokenKey. If it succeeds → ACTIVE. If it fails → GRACE_PERIOD.",
              },
              {
                type: "callout",
                variant: "warn",
                text: "Always redirect to checkout_url immediately at signup  even during a free trial. This tokenises the card now so Tori can charge automatically at trial end. Without a tokenKey at trial end, the subscription moves to PAST_DUE.",
              },
            ],
          },
          {
            id: "subs",
            label: "Subscriptions",
            icon: "ti-refresh",
            blocks: [
              {
                type: "p",
                text: "A subscription is the live billing relationship between one customer and one plan. It is the central object in Tori  everything else exists to support it.",
              },
              { type: "h2", text: "The nine states", id: "nine-states" },
              {
                type: "table",
                headers: ["State", "Meaning", "Billing?"],
                rows: [
                  [
                    "PENDING_PAYMENT",
                    "Subscription created. Customer redirected to Nomba checkout. Moves to ACTIVE only after payment_success webhook confirms payment.",
                    "No awaiting payment",
                  ],
                  [
                    "TRIALING",
                    "Free trial. Card tokenised with ₦1 verification charge. No revenue charge yet.",
                    "No",
                  ],
                  ["ACTIVE", "Healthy. Customer charged on each cycle.", "Yes"],
                  [
                    "GRACE_PERIOD",
                    "First charge failed. Silent 48-hour retry before dunning. No customer disruption.",
                    "Retrying",
                  ],
                  [
                    "PAST_DUE",
                    "Grace retry failed, or trial ended with no card, or checkout abandoned. Dunning schedule begins.",
                    "Retrying",
                  ],
                  [
                    "DUNNING",
                    "Retrying on payday schedule: Day 3, 7, 14, 21.",
                    "Retrying",
                  ],
                  ["PAUSED", "Billing deliberately suspended.", "No"],
                  [
                    "SUSPENDED",
                    "All retries exhausted. Payment never recovered.",
                    "No",
                  ],
                  [
                    "CANCELLED",
                    "Permanently ended. Terminal no further transitions.",
                    "No",
                  ],
                ],
              },
              { type: "h2", text: "State transitions", id: "transitions" },
              {
                type: "table",
                headers: ["From", "Trigger", "To"],
                rows: [
                  [
                    "PENDING_PAYMENT",
                    "payment_success webhook received",
                    "ACTIVE",
                  ],
                  [
                    "PENDING_PAYMENT",
                    "payment_failed webhook received",
                    "PAST_DUE",
                  ],
                  ["PENDING_PAYMENT", "No tokenKey after 24 hours", "PAST_DUE"],
                  ["TRIALING", "Trial ends, charge succeeds", "ACTIVE"],
                  ["TRIALING", "Trial ends, no tokenKey stored", "PAST_DUE"],
                  ["TRIALING", "Trial ends, charge fails", "GRACE_PERIOD"],
                  ["ACTIVE", "Renewal charge fails", "GRACE_PERIOD"],
                  ["GRACE_PERIOD", "48-hour retry succeeds", "ACTIVE"],
                  ["GRACE_PERIOD", "48-hour retry fails", "PAST_DUE"],
                  ["PAST_DUE", "Retry succeeds", "ACTIVE"],
                  ["PAST_DUE", "Permanent failure", "SUSPENDED"],
                  ["DUNNING", "Retry succeeds", "ACTIVE"],
                  ["DUNNING", "All 4 retries exhausted", "SUSPENDED"],
                  ["ACTIVE", "POST /pause", "PAUSED"],
                  ["PAUSED", "POST /resume", "ACTIVE"],
                  ["Any except CANCELLED", "POST /cancel", "CANCELLED"],
                ],
              },
              {
                type: "callout",
                variant: "success",
                text: "The state machine is validated by 28 unit tests. Every transition is checked before execution. You can never end up in an inconsistent state.",
              },
            ],
          },
          {
            id: "dunning",
            label: "Dunning & retries",
            icon: "ti-clock",
            blocks: [
              {
                type: "p",
                text: "Dunning is how Tori recovers failed payments. It classifies every failure, decides whether to retry, and schedules retries at the right times for the Nigerian market.",
              },
              { type: "h2", text: "The GRACE_PERIOD", id: "grace" },
              {
                type: "p",
                text: "When a renewal charge fails on an ACTIVE subscription, Tori enters a 48-hour GRACE_PERIOD. A silent retry fires at the 48-hour mark. No webhook fires. No customer disruption. This handles the most common Nigerian failure: a card with temporary insufficient funds that clears within 48 hours without any customer action.",
              },
              {
                type: "h2",
                text: "Failure classification",
                id: "classification",
              },
              {
                type: "table",
                headers: ["Nomba code", "Type", "Classification", "Action"],
                rows: [
                  [
                    "51",
                    "insufficient_funds",
                    "RETRIABLE",
                    "Retry on payday schedule",
                  ],
                  [
                    "91, 96",
                    "issuer_unavailable",
                    "RETRIABLE",
                    "Retry after backoff",
                  ],
                  ["68", "timeout", "RETRIABLE", "Retry after short delay"],
                  [
                    "06, 12, 34",
                    "processing_error",
                    "RETRIABLE",
                    "Retry after backoff",
                  ],
                  ["54", "card_expired", "PERMANENT", "Stop immediately"],
                  [
                    "62, 57, 36",
                    "card_blocked",
                    "PERMANENT",
                    "Stop immediately",
                  ],
                  ["41, 43", "stolen_card", "PERMANENT", "Stop immediately"],
                ],
              },
              {
                type: "h2",
                text: "Payday retry schedule",
                id: "retry-schedule",
              },
              {
                type: "table",
                headers: ["Attempt", "Timing", "Why"],
                rows: [
                  [
                    "Grace retry",
                    "48 hours after failure",
                    "Silent window  most common failures clear here",
                  ],
                  ["Attempt 1", "Day 3", "Early retry  catches bank outages"],
                  ["Attempt 2", "Day 7", "Covers weekly salary cycles"],
                  ["Attempt 3", "Day 14", "Covers biweekly cycles"],
                  [
                    "Attempt 4",
                    "Day 21",
                    "Final attempt  covers late-month salaries",
                  ],
                ],
              },
            ],
          },
          {
            id: "ledger",
            label: "The ledger",
            icon: "ti-book",
            blocks: [
              {
                type: "p",
                text: "An append-only record of every financial event. Every charge, refund, credit, proration, and adjustment writes one immutable row. Nothing is ever edited or deleted. MRR, churn, and dunning recovery are all computed from this ledger.",
              },
              { type: "h2", text: "Entry types", id: "entries" },
              {
                type: "table",
                headers: ["Type", "When written", "Direction"],
                rows: [
                  ["CHARGE", "Successful subscription charge", "DEBIT"],
                  ["REFUND", "Refund issued", "CREDIT"],
                  ["CREDIT", "Manual credit", "CREDIT"],
                  ["PRORATION", "Mid-cycle plan change", "DEBIT or CREDIT"],
                  ["TRIAL_START", "Trial begins", "Audit marker"],
                  ["TRIAL_END", "Trial ends", "Audit marker"],
                  [
                    "ADMIN_OVERRIDE",
                    "Manual correction with reason",
                    "DEBIT or CREDIT",
                  ],
                ],
              },
              {
                type: "callout",
                variant: "success",
                text: "Every ledger entry has a unique idempotency_key. If a job handler retries due to a crash, the duplicate write fails silently on the unique constraint. No customer is ever double-charged.",
              },
            ],
          },
          {
            id: "webhooks-concept",
            label: "Webhooks",
            icon: "ti-webhook",
            blocks: [
              {
                type: "p",
                text: "Webhooks are how Tori tells your product what happened. When a subscription activates, a payment fails, or a customer cancels  Tori sends a signed HTTP POST to your server.",
              },
              { type: "h2", text: "Event catalogue", id: "events" },
              {
                type: "table",
                headers: ["Event", "When it fires", "What to do"],
                rows: [
                  [
                    "subscription.created",
                    "Subscription created",
                    "Store subscription ID",
                  ],
                  [
                    "subscription.activated",
                    "Trial ends and charge succeeds",
                    "Unlock full access",
                  ],
                  ["subscription.paused", "Paused", "Restrict access"],
                  ["subscription.resumed", "Resumed", "Restore access"],
                  [
                    "subscription.cancelled",
                    "Permanently cancelled",
                    "Offboard gracefully",
                  ],
                  [
                    "subscription.suspended",
                    "All retries exhausted",
                    "Suspend access",
                  ],
                  ["payment.succeeded", "Charge went through", "Send receipt"],
                  ["payment.failed", "Charge failed", "Show payment warning"],
                  [
                    "dunning.started",
                    "First retry scheduled",
                    "Show soft warning",
                  ],
                  [
                    "dunning.recovered",
                    "Retry succeeded",
                    "Restore full access",
                  ],
                  [
                    "dunning.exhausted",
                    "All retries failed",
                    "Suspend, notify urgently",
                  ],
                  [
                    "invoice.generated",
                    "Invoice created",
                    "Update billing records",
                  ],
                  [
                    "invoice.paid",
                    "Invoice marked paid",
                    "Update billing records",
                  ],
                ],
              },
              {
                type: "h2",
                text: "Delivery retry schedule",
                id: "delivery-retries",
              },
              {
                type: "table",
                headers: ["Attempt", "Timing"],
                rows: [
                  ["1", "Immediately"],
                  ["2", "5 minutes after failure"],
                  ["3", "30 minutes after failure"],
                  ["4", "2 hours after failure"],
                  ["5", "6 hours after failure"],
                ],
              },
              {
                type: "callout",
                variant: "warn",
                text: "Always respond 200 immediately and process events asynchronously. Duplicate events are possible  make your handler idempotent.",
              },
            ],
          },
        ],
      },
      {
        group: "Integration Guides",
        items: [
          {
            id: "guide-saas",
            label: "SaaS: ClassPay",
            icon: "ti-building-store",
            blocks: [
              {
                type: "p",
                text: "Complete integration for ClassPay, a Nigerian edtech SaaS charging schools ₦25,000/month. Backend: Laravel. Goal: zero custom billing logic.",
              },
              { type: "h2", text: "Step 1: Config", id: "guide-plans" },
              {
                type: "code",
                lang: "bash",
                code: `TORI_API_KEY=tori_live_...
TORI_PLAN_BASIC=plan_abc123...
TORI_PLAN_PRO=plan_xyz456...
TORI_WEBHOOK_SECRET=whsec_...`,
              },
              {
                type: "h2",
                text: "Step 2: Signup  one call",
                id: "guide-signup",
              },
              {
                type: "code",
                lang: "php",
                code: `public function complete(Request $request) {
    $school = School::create(['name' => $request->name, 'email' => $request->email]);

    $response = Http::withHeaders(['X-API-Key' => env('TORI_API_KEY')])
        ->post('https://api.tori.ng/v1/platform/checkout', [
            'email'           => $school->email,
            'plan_id'         => $request->plan === 'pro' ? env('TORI_PLAN_PRO') : env('TORI_PLAN_BASIC'),
            'name'            => $school->name,
            'external_id'     => (string) $school->id,
            'idempotency_key' => 'signup_' . $school->id,
            'callback_url'    => route('payment.success'),
            'promo_code'      => $request->input('promo_code'), // optional, null is fine
        ]);

    $data = $response->json()['data'];
    $school->update(['tori_subscription_id' => $data['subscription']['id']]);

    if ($data['promo_applied'] ?? false) {
        // Discount was valid and applied. final_amount_kobo is what was actually charged.
        Log::info('Promo applied', ['discount_kobo' => $data['discount_kobo']]);
    }

    return redirect($data['checkout_url']); // always redirect  even during trial
}`,
              },
              {
                type: "h2",
                text: "Step 3: Webhook handler",
                id: "guide-webhooks",
              },
              {
                type: "code",
                lang: "php",
                code: `public function handle(Request $request) {
    $expected = 'sha256=' . hash_hmac('sha256', $request->getContent(), env('TORI_WEBHOOK_SECRET'));
    if (!hash_equals($expected, $request->header('X-Tori-Signature')))
        return response('Invalid signature', 401);

    $event  = $request->json()->all();
    $school = School::where('tori_subscription_id', $event['data']['id'])->first();
    if (!$school) return response('ok', 200);

    match ($event['event_type']) {
        'subscription.activated' => $school->update(['access' => 'full']),
        'dunning.started'        => $school->update(['access' => 'restricted']),
        'dunning.recovered'      => $school->update(['access' => 'full']),
        'dunning.exhausted'      => $school->update(['access' => 'suspended']),
        'subscription.cancelled' => $school->update(['access' => 'none']),
        default => null,
    };
    return response('ok', 200);
}`,
              },
              {
                type: "callout",
                variant: "success",
                text: "What ClassPay never had to build: no cron job for monthly charges, no retry logic, no Nigerian card failure classification, no dunning schedule, no revenue reporting, no webhook delivery system.",
              },
            ],
          },
          {
            id: "guide-node",
            label: "Node.js integration",
            icon: "ti-brand-nodejs",
            blocks: [
              {
                type: "p",
                text: "The same integration in Node.js with Express.",
              },
              { type: "h2", text: "Signup", id: "node-signup" },
              {
                type: "code",
                lang: "js",
                code: `router.post('/register', async (req, res) => {
  const { name, email, plan } = req.body;
  const user = await db.users.create({ name, email, plan });

  const { data } = await fetch('https://api.tori.ng/v1/platform/checkout', {
    method: 'POST',
    headers: { 'X-API-Key': process.env.TORI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email, name,
      plan_id: plan === 'pro' ? process.env.TORI_PLAN_PRO : process.env.TORI_PLAN_BASIC,
      external_id: String(user.id),
      idempotency_key: \`signup_\${user.id}\`,
      callback_url: \`\${process.env.APP_URL}/payment/success\`,
    }),
  }).then(r => r.json());

  await db.users.update(user.id, { tori_subscription_id: data.subscription.id });
  res.redirect(data.checkout_url); // always redirect  even during trial
});`,
              },
              { type: "h2", text: "Webhook handler", id: "node-webhooks" },
              {
                type: "code",
                lang: "js",
                code: `router.post('/tori', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig      = req.headers['x-tori-signature'];
  const expected = 'sha256=' + crypto.createHmac('sha256', process.env.TORI_WEBHOOK_SECRET)
    .update(req.body).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig)))
    return res.status(401).send('Invalid signature');

  const { event_type, data } = JSON.parse(req.body);
  const user = await db.users.findBy({ tori_subscription_id: data.id });
  if (!user) return res.status(200).send('ok');

  const accessMap = {
    'subscription.activated': 'full', 'dunning.recovered': 'full', 'subscription.resumed': 'full',
    'dunning.started': 'restricted', 'subscription.paused': 'paused',
    'dunning.exhausted': 'suspended', 'subscription.cancelled': 'none',
  };
  if (accessMap[event_type]) await db.users.update(user.id, { access: accessMap[event_type] });
  res.status(200).send('ok');
});`,
              },
              {
                type: "callout",
                variant: "warn",
                text: "Use express.raw() on the webhook route  not express.json(). The HMAC is computed on raw request bytes. Parsing body as JSON first causes signature verification to fail.",
              },
            ],
          },
          {
            id: "guide-checklist",
            label: "Integration checklist",
            icon: "ti-checklist",
            blocks: [
              { type: "h2", text: "Setup", id: "checklist-setup" },
              {
                type: "list",
                items: [
                  "API key in secret manager  not source code",
                  "Webhook endpoint registered with correct URL",
                  "Webhook secret in environment",
                  "Plan IDs in environment",
                  "Tori subscription ID stored per user in your DB",
                ],
              },
              { type: "h2", text: "Signup flow", id: "checklist-signup" },
              {
                type: "list",
                items: [
                  "Checkout call server-side only",
                  "Idempotency key on every checkout call",
                  "external_id set to your own user ID",
                  "Customer redirected to checkout_url immediately  even during free trial",
                  "callback_url set to your payment success page",
                ],
              },
              { type: "h2", text: "Webhook handler", id: "checklist-webhooks" },
              {
                type: "list",
                items: [
                  "Raw request body for HMAC  not parsed JSON",
                  "Signature verified before processing",
                  "Returns 200 immediately, processes async",
                  "Idempotent handler",
                  "All 13 event types handled",
                  "Local access state updated per event",
                ],
              },
              { type: "h2", text: "Before go-live", id: "checklist-golive" },
              {
                type: "list",
                items: [
                  "Tested full checkout with Nomba card 5434621074252808, OTP 9999",
                  "Verified tokenKey stored after payment_success webhook",
                  "Verified signature rejection on tampered payloads",
                  "Verified idempotency: same key twice returns same subscription",
                  "Verified access suspended on dunning.exhausted",
                  "Verified access restored on dunning.recovered",
                ],
              },
            ],
          },
        ],
      },
      {
        group: "Nigerian Context",
        items: [
          {
            id: "nigerian-cards",
            label: "Nigerian card behaviour",
            icon: "ti-credit-card",
            blocks: [
              {
                type: "p",
                text: "Nigerian card failures are different from those in Europe or the US. Tori is designed specifically for how Nigerian card infrastructure behaves.",
              },
              {
                type: "h2",
                text: "Why Nigerian cards fail differently",
                id: "why-different",
              },
              {
                type: "list",
                items: [
                  "Many cards are issued with online transactions blocked by default. The bank returns a decline that looks temporary but will never succeed.",
                  "Insufficient funds is the most common retriable failure. Nigerian salaries arrive on specific dates  payday-aligned retries recover most of these.",
                  "Bank system outages are more frequent than other markets. A failed transaction during an outage should be retried.",
                  "International transaction limits are common. Cards may have online transactions enabled but with charge limits.",
                ],
              },
              {
                type: "h2",
                text: "Nomba failure code mapping",
                id: "failure-mapping",
              },
              {
                type: "table",
                headers: ["Code", "Meaning", "Classification", "Retried?"],
                rows: [
                  [
                    "51",
                    "Insufficient funds",
                    "RETRIABLE",
                    "Yes  payday schedule",
                  ],
                  ["54", "Card expired", "PERMANENT", "No"],
                  ["62, 57", "Card blocked", "PERMANENT", "No"],
                  ["41, 43", "Stolen/lost card", "PERMANENT", "No"],
                  ["91, 96", "Issuer unavailable", "RETRIABLE", "Yes  backoff"],
                  [
                    "06, 12, 34",
                    "Processing error",
                    "RETRIABLE",
                    "Yes  backoff",
                  ],
                  ["68", "Timeout", "RETRIABLE", "Yes  short retry"],
                ],
              },
            ],
          },
          {
            id: "nigerian-use-cases",
            label: "Nigerian use cases",
            icon: "ti-building-store",
            blocks: [
              { type: "h2", text: "SaaS  school management", id: "saas" },
              {
                type: "p",
                text: "₦25,000/month per school, 200 schools. Every month ~16 fail. Tori classifies failures, retries retriable ones on payday windows, fires webhooks per outcome. Zero manual billing work.",
              },
              { type: "h2", text: "Creator  memberships", id: "creator" },
              {
                type: "p",
                text: "₦2,500/month, 2,000 subscribers. At 8% failure: 160 failed charges per month, ₦400,000 at risk. Tori's GRACE_PERIOD and dunning engine recover the majority automatically. Portal tokens let members self-serve.",
              },
              { type: "h2", text: "Edtech  termly billing", id: "edtech" },
              {
                type: "code",
                lang: "json",
                code: `{ "name": "Term fees SS2", "amount": 5000000, "interval": "custom", "interval_days": 120 }`,
              },
              {
                type: "p",
                text: "School fees every 120 days. Monthly doesn't fit. Annual requires ₦150,000 upfront. Custom interval handles this exactly  Tori charges every 120 days automatically.",
              },
            ],
          },
        ],
      },
    ],
  },
  // ═══════════════════════════════════════════════════════════
  // TAB 2  API REFERENCE
  // ═══════════════════════════════════════════════════════════
  {
    id: "api-reference",
    label: "API Reference",
    groups: [
      {
        group: "Basics",
        items: [
          {
            id: "ref-conventions",
            label: "Conventions",
            icon: "ti-adjustments",
            blocks: [
              { type: "h2", text: "Base URL", id: "base-url" },
              {
                type: "code",
                lang: "bash",
                code: `Production:  https://api.tori.ng
Sandbox:     Uses Nomba sandbox internally when NOMBA_ENV=sandbox`,
              },
              { type: "h2", text: "Response envelope", id: "envelope" },
              {
                type: "code",
                lang: "json",
                code: `// Single object
{ "data": { "id": "...", "...": "..." }, "meta": { "request_id": "uuid", "api_version": "2026-06-01" } }

// List
{ "data": [...], "pagination": { "has_more": false, "total": 20 }, "meta": { ... } }

// Error
{ "error": { "code": "not_found", "message": "resource does not exist" }, "meta": { ... } }`,
              },
              { type: "h2", text: "Amounts are always in kobo", id: "money" },
              {
                type: "p",
                text: "Every amount field is an integer in kobo. ₦15,000 = 1500000. ₦2,500 = 250000. No decimal amounts anywhere.",
              },
              { type: "h2", text: "Dates", id: "dates" },
              {
                type: "p",
                text: "All timestamps are ISO 8601 UTC. Filter dates use YYYY-MM-DD: ?from=2026-06-01&to=2026-06-30.",
              },
              { type: "h2", text: "Pagination", id: "pagination" },
              {
                type: "code",
                lang: "bash",
                code: "GET /v1/customers?limit=50&offset=100",
              },
            ],
          },
          {
            id: "ref-errors",
            label: "Error codes",
            icon: "ti-alert-triangle",
            blocks: [
              {
                type: "p",
                text: "Always branch on error.code  never on error.message. Codes are stable; messages may change.",
              },
              {
                type: "table",
                headers: ["HTTP", "Code", "Meaning", "Fix"],
                rows: [
                  [
                    "400",
                    "invalid_body",
                    "Request body not valid JSON",
                    "Check body format",
                  ],
                  [
                    "400",
                    "missing_field",
                    "Required field missing",
                    "Add the field",
                  ],
                  [
                    "400",
                    "invalid_amount",
                    "Amount zero or negative",
                    "Send positive kobo integer",
                  ],
                  [
                    "400",
                    "invalid_field",
                    "Field wrong type or format",
                    "Check field format",
                  ],
                  [
                    "401",
                    "unauthorised",
                    "Invalid or missing credentials",
                    "Check X-API-Key or JWT",
                  ],
                  [
                    "404",
                    "not_found",
                    "Resource does not exist",
                    "Check the ID",
                  ],
                  [
                    "409",
                    "email_taken",
                    "Customer email already exists",
                    "Look up existing customer",
                  ],
                  [
                    "422",
                    "invalid_transition",
                    "State machine rejected action",
                    "Check current state",
                  ],
                  [
                    "422",
                    "plan_inactive",
                    "Plan not accepting new subscribers",
                    "Use active plan",
                  ],
                  [
                    "429",
                    "rate_limited",
                    "Too many requests",
                    "Back off until reset",
                  ],
                  [
                    "500",
                    "internal_error",
                    "Unexpected server error",
                    "Retry with backoff",
                  ],
                ],
              },
            ],
          },
        ],
      },
      {
        group: "Authenticate",
        items: [
          {
            id: "ref-register",
            label: "Register",
            icon: "ti-user-plus",
            method: "POST",
            endpoint: "/v1/auth/register",
            blocks: [
              {
                type: "p",
                text: "Create a new Tori tenant account. Returns JWT tokens immediately  no separate login needed.",
              },
              { type: "h2", text: "Headers", id: "register-headers" },
              {
                type: "param",
                name: "Content-Type",
                paramType: "string",
                required: true,
                description: "Must be application/json",
              },
              { type: "h2", text: "Body", id: "register-body" },
              {
                type: "param",
                name: "name",
                paramType: "string",
                required: true,
                description: "Your business name e.g. ClassPay",
              },
              {
                type: "param",
                name: "email",
                paramType: "string",
                required: true,
                description: "Your business email address",
              },
              {
                type: "param",
                name: "password",
                paramType: "string",
                required: true,
                description: "Minimum 8 characters",
              },
              { type: "h2", text: "Response", id: "register-response" },
              {
                type: "response",
                status: 200,
                description: "Account created successfully",
                body: `{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "response",
                status: 400,
                description: "Validation failed",
                body: `{ "error": { "code": "missing_field", "message": "email is required" }, "meta": { ... } }`,
              },
              {
                type: "response",
                status: 409,
                description: "Email already registered",
                body: `{ "error": { "code": "email_taken", "message": "an account with this email already exists" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-login",
            label: "Login",
            icon: "ti-login",
            method: "POST",
            endpoint: "/v1/auth/login",
            blocks: [
              {
                type: "p",
                text: "Authenticate and receive JWT tokens for Dashboard API calls. Access tokens expire after 15 minutes.",
              },
              { type: "h2", text: "Headers", id: "login-headers" },
              {
                type: "param",
                name: "Content-Type",
                paramType: "string",
                required: true,
                description: "Must be application/json",
              },
              { type: "h2", text: "Body", id: "login-body" },
              {
                type: "param",
                name: "email",
                paramType: "string",
                required: true,
                description: "Your account email",
              },
              {
                type: "param",
                name: "password",
                paramType: "string",
                required: true,
                description: "Your account password",
              },
              { type: "h2", text: "Response", id: "login-response" },
              {
                type: "response",
                status: 200,
                description: "Login successful",
                body: `{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "response",
                status: 401,
                description: "Invalid credentials",
                body: `{ "error": { "code": "unauthorised", "message": "invalid credentials" }, "meta": { ... } }`,
              },
              {
                type: "callout",
                variant: "warn",
                text: "After 5 failed login attempts, the account is locked for 15 minutes. The counter resets on successful login.",
              },
            ],
          },
          {
            id: "ref-refresh",
            label: "Refresh token",
            icon: "ti-refresh",
            method: "POST",
            endpoint: "/v1/auth/refresh",
            blocks: [
              {
                type: "p",
                text: "Exchange a refresh token for a new access token. Refresh tokens expire after 7 days.",
              },
              { type: "h2", text: "Body", id: "refresh-body" },
              {
                type: "param",
                name: "refresh_token",
                paramType: "string",
                required: true,
                description: "The refresh token from login or previous refresh",
              },
              { type: "h2", text: "Response", id: "refresh-response" },
              {
                type: "response",
                status: 200,
                description: "Token refreshed",
                body: `{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "response",
                status: 401,
                description: "Refresh token invalid or expired",
                body: `{ "error": { "code": "unauthorised", "message": "invalid or expired refresh token" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-logout",
            label: "Logout",
            icon: "ti-logout",
            method: "POST",
            endpoint: "/v1/auth/logout",
            blocks: [
              {
                type: "p",
                text: "Revokes the access token in Redis immediately. Any subsequent request using the revoked token returns 401.",
              },
              { type: "h2", text: "Headers", id: "logout-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "logout-response" },
              {
                type: "response",
                status: 200,
                description: "Logged out",
                body: `{ "data": { "message": "logged out successfully" }, "meta": { ... } }`,
              },
            ],
          },
        ],
      },
      {
        group: "Sessions",
        items: [
          {
            id: "ref-sessions-list",
            label: "List active sessions",
            icon: "ti-devices",
            method: "GET",
            endpoint: "/v1/auth/sessions",
            blocks: [
              {
                type: "p",
                text: "Every login creates a session record in Redis with the device's IP address and user agent. This endpoint lists every session that has not expired or been revoked, for the currently authenticated tenant.",
              },
              { type: "h2", text: "Headers", id: "sessions-list-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "sessions-list-response" },
              {
                type: "response",
                status: 200,
                description: "Sessions returned, most recently active first",
                body: `{
  "data": [
    {
      "id": "3ff914e2b8563b26910423b2c6e3e6d1",
      "ip_address": "102.89.23.44",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
      "created_at": "2026-07-05T00:41:23.259Z",
      "last_seen_at": "2026-07-05T09:12:04.881Z",
      "is_current": true
    },
    {
      "id": "a1c2b3d4e5f60718293a4b5c6d7e8f90",
      "ip_address": "197.210.54.12",
      "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)",
      "created_at": "2026-07-04T08:15:00.000Z",
      "last_seen_at": "2026-07-04T18:30:00.000Z",
      "is_current": false
    }
  ],
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "callout",
                variant: "info",
                text: "is_current tells you which session belongs to the request you just made. Use it to disable or hide the Revoke button for the session the user is currently looking at, so they cannot lock themselves out by accident.",
              },
            ],
          },
          {
            id: "ref-sessions-revoke",
            label: "Revoke a session",
            icon: "ti-logout-2",
            method: "DELETE",
            endpoint: "/v1/auth/sessions/{id}",
            blocks: [
              {
                type: "p",
                text: "Immediately kill one session. Any access token or refresh token tied to that session stops working on its very next request, even if it has not expired yet. There is no 15-minute grace window.",
              },
              { type: "h2", text: "Headers", id: "sessions-revoke-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              {
                type: "h2",
                text: "Path parameters",
                id: "sessions-revoke-path",
              },
              {
                type: "param",
                name: "id",
                paramType: "string",
                required: true,
                description: "The session ID from the sessions list",
              },
              { type: "h2", text: "Response", id: "sessions-revoke-response" },
              {
                type: "response",
                status: 200,
                description: "Session revoked",
                body: `{ "data": { "status": "revoked" }, "meta": { ... } }`,
              },
              {
                type: "callout",
                variant: "warn",
                text: "Revoking your own current session logs you out on your next request. The dashboard hides the Revoke button on the session marked is_current for this reason, but the API itself does not block it.",
              },
            ],
          },
        ],
      },
      {
        group: "API Keys",
        items: [
          {
            id: "ref-apikeys-create",
            label: "Create live API key",
            icon: "ti-plus",
            method: "POST",
            endpoint: "/v1/api-keys",
            blocks: [
              {
                type: "p",
                text: "Generate a new live API key, or replace the existing one if you already have one. The full key is shown exactly once.",
              },
              { type: "h2", text: "Headers", id: "apikey-create-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              {
                type: "param",
                name: "Content-Type",
                paramType: "string",
                required: true,
                description: "application/json",
              },
              { type: "h2", text: "Body", id: "apikey-create-body" },
              {
                type: "param",
                name: "name",
                paramType: "string",
                required: false,
                description:
                  "A label for this key, for example Production server. Defaults to Default",
              },
              { type: "h2", text: "Response", id: "apikey-create-response" },
              {
                type: "response",
                status: 201,
                description: "Key created, shown once",
                body: `{
  "data": {
    "key":  "tori_live_a5eac054adef09a31a7d823d6e71b1245deffa7eb5c8a51c765e7678e9d578c0",
    "name": "Production server",
    "hint": "tori_live_a5ea...78c0",
    "mode": "live"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "callout",
                variant: "warn",
                text: "This is the only time the full key is shown. Tori stores only a SHA-256 hash. Copy it to your secret manager immediately. Calling this again replaces the current live key.",
              },
            ],
          },
          {
            id: "ref-apikeys-test-create",
            label: "Create test API key",
            icon: "ti-flask",
            method: "POST",
            endpoint: "/v1/api-keys/test",
            blocks: [
              {
                type: "p",
                text: "Generate a new test API key, or replace the existing one. Requests signed with this key always hit Nomba sandbox, no matter what the server's live Nomba credentials are.",
              },
              { type: "h2", text: "Headers", id: "apikey-test-create-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              {
                type: "h2",
                text: "Response",
                id: "apikey-test-create-response",
              },
              {
                type: "response",
                status: 201,
                description: "Test key created, shown once",
                body: `{
  "data": {
    "key":  "tori_test_4d2c9f6e1a8b3d5c7e9f0a2b4d6e8f1a3c5e7d9f1b3d5e7f9a1c3e5d7f9b1a3c",
    "name": "Test key",
    "hint": "tori_test_4d2c...1a3c",
    "mode": "test"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
            ],
          },
          {
            id: "ref-apikeys-get",
            label: "Get key hints",
            icon: "ti-eye",
            method: "GET",
            endpoint: "/v1/api-keys",
            blocks: [
              {
                type: "p",
                text: "Returns the hint (first prefix plus last 4 characters) for both the live key and the test key. Either one may not exist yet. The full key is never retrievable after creation.",
              },
              { type: "h2", text: "Headers", id: "apikey-get-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "apikey-get-response" },
              {
                type: "response",
                status: 200,
                description: "Both key hints returned",
                body: `{
  "data": {
    "live": { "hint": "tori_live_a5ea...78c0", "exists": true },
    "test": { "hint": null, "exists": false }
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "p",
                text: "hint is null and exists is false for any mode you have not generated a key for yet.",
              },
            ],
          },
          {
            id: "ref-apikeys-rotate",
            label: "Rotate live API key",
            icon: "ti-rotate",
            method: "POST",
            endpoint: "/v1/api-keys/rotate",
            blocks: [
              {
                type: "p",
                text: "Generates a new live key and immediately invalidates the current one. Deploy the new key to all your servers before rotating.",
              },
              { type: "h2", text: "Headers", id: "apikey-rotate-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "apikey-rotate-response" },
              {
                type: "response",
                status: 200,
                description: "Key rotated, new key shown once",
                body: `{
  "data": {
    "key":  "tori_live_x9y8z7...",
    "name": "Rotated key",
    "hint": "tori_live_x9y8...a1b2",
    "mode": "live"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "callout",
                variant: "warn",
                text: "The old key stops working the instant you rotate. Any server still using the old key receives 401 immediately.",
              },
            ],
          },
          {
            id: "ref-apikeys-revoke",
            label: "Revoke a key",
            icon: "ti-trash",
            method: "DELETE",
            endpoint: "/v1/api-keys/{mode}",
            blocks: [
              {
                type: "p",
                text: "Revoke the live key or the test key. Revoking one does not affect the other. There is no undo, generate a new one afterward if you need to keep using that mode.",
              },
              { type: "h2", text: "Headers", id: "apikey-revoke-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Path parameters", id: "apikey-revoke-path" },
              {
                type: "param",
                name: "mode",
                paramType: "string",
                required: true,
                description: "live or test",
              },
              { type: "h2", text: "Response", id: "apikey-revoke-response" },
              {
                type: "response",
                status: 200,
                description: "Key revoked",
                body: `{ "data": { "status": "revoked" }, "meta": { ... } }`,
              },
              {
                type: "response",
                status: 400,
                description: "Invalid mode",
                body: `{ "error": { "code": "invalid_mode", "message": "mode must be 'live' or 'test'" }, "meta": { ... } }`,
              },
            ],
          },
        ],
      },
      {
        group: "Plans",
        items: [
          {
            id: "ref-plans-create",
            label: "Create plan",
            icon: "ti-plus",
            method: "POST",
            endpoint: "/v1/platform/plans",
            blocks: [
              {
                type: "p",
                text: "Create a pricing plan. Plans are reusable  create once, any number of customers can subscribe.",
              },
              { type: "h2", text: "Headers", id: "plans-create-headers" },
              {
                type: "param",
                name: "X-API-Key",
                paramType: "string",
                required: true,
                description: "Your secret API key",
              },
              {
                type: "param",
                name: "Content-Type",
                paramType: "string",
                required: true,
                description: "application/json",
              },
              { type: "h2", text: "Body", id: "plans-create-body" },
              {
                type: "param",
                name: "name",
                paramType: "string",
                required: true,
                description: "Plan display name e.g. Pro, Business",
              },
              {
                type: "param",
                name: "amount",
                paramType: "integer",
                required: true,
                description: "Amount in kobo. ₦15,000 = 1500000",
              },
              {
                type: "param",
                name: "currency",
                paramType: "string",
                required: false,
                description: "Always NGN. Defaults to NGN",
              },
              {
                type: "param",
                name: "interval",
                paramType: "string",
                required: false,
                description: "monthly | annual | custom. Defaults to monthly",
              },
              {
                type: "param",
                name: "interval_count",
                paramType: "integer",
                required: false,
                description:
                  "For custom interval: number of days between charges",
              },
              {
                type: "param",
                name: "trial_period_days",
                paramType: "integer",
                required: false,
                description: "Free trial length in days. 0 = no trial",
              },
              { type: "h2", text: "Response", id: "plans-create-response" },
              {
                type: "response",
                status: 201,
                description: "Plan created",
                body: `{
  "data": {
    "id": "afecaf33-ca8d-4e1c-86ef-c232bbf11bed",
    "tenant_id": "2d9ff9ec-90db-41cf-9dd6-a5c92f054f97",
    "name": "Pro",
    "amount": 1500000,
    "currency": "NGN",
    "interval": "monthly",
    "interval_count": 1,
    "trial_period_days": 14,
    "is_active": true,
    "created_at": "2026-06-26T00:00:00Z"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "response",
                status: 400,
                description: "Validation failed",
                body: `{ "error": { "code": "invalid_amount", "message": "amount must be a positive integer in kobo" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-plans-list",
            label: "List plans",
            icon: "ti-list",
            method: "GET",
            endpoint: "/v1/plans",
            blocks: [
              {
                type: "p",
                text: "Returns all plans for your account, sorted by creation date descending.",
              },
              { type: "h2", text: "Headers", id: "plans-list-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "plans-list-response" },
              {
                type: "response",
                status: 200,
                description: "Plans returned",
                body: `{
  "data": [
    { "id": "fd0dccfd-...", "name": "Basic", "amount": 250000, "interval": "monthly", "trial_period_days": 0, "is_active": true },
    { "id": "afecaf33-...", "name": "Pro", "amount": 1500000, "interval": "monthly", "trial_period_days": 14, "is_active": true }
  ],
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
            ],
          },
          {
            id: "ref-plans-get",
            label: "Get plan",
            icon: "ti-file-text",
            method: "GET",
            endpoint: "/v1/plans/{plan_id}",
            blocks: [
              { type: "p", text: "Fetch a single plan by ID." },
              { type: "h2", text: "Headers", id: "plans-get-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Path parameters", id: "plans-get-path" },
              {
                type: "param",
                name: "plan_id",
                paramType: "uuid",
                required: true,
                description: "The plan ID",
              },
              { type: "h2", text: "Response", id: "plans-get-response" },
              {
                type: "response",
                status: 200,
                description: "Plan returned",
                body: `{
  "data": { "id": "afecaf33-...", "name": "Pro", "amount": 1500000, "currency": "NGN", "interval": "monthly", "trial_period_days": 14, "is_active": true },
  "meta": { ... }
}`,
              },
              {
                type: "response",
                status: 404,
                description: "Plan not found",
                body: `{ "error": { "code": "not_found", "message": "the requested resource does not exist" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-plans-deactivate",
            label: "Deactivate plan",
            icon: "ti-ban",
            method: "DELETE",
            endpoint: "/v1/plans/{plan_id}",
            blocks: [
              {
                type: "p",
                text: "Deactivate a plan. New subscriptions cannot use it. Existing subscribers are unaffected.",
              },
              { type: "h2", text: "Headers", id: "plans-deactivate-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              {
                type: "h2",
                text: "Path parameters",
                id: "plans-deactivate-path",
              },
              {
                type: "param",
                name: "plan_id",
                paramType: "uuid",
                required: true,
                description: "The plan ID to deactivate",
              },
              { type: "h2", text: "Response", id: "plans-deactivate-response" },
              {
                type: "response",
                status: 200,
                description: "Plan deactivated",
                body: `{ "data": { "id": "afecaf33-...", "is_active": false }, "meta": { ... } }`,
              },
            ],
          },
        ],
      },
      {
        group: "Customers",
        items: [
          {
            id: "ref-customers-create",
            label: "Create customer",
            icon: "ti-user-plus",
            method: "POST",
            endpoint: "/v1/platform/customers",
            blocks: [
              {
                type: "p",
                text: "Create a customer. The checkout endpoint creates customers automatically  use this only for pre-creating customers before subscription.",
              },
              { type: "h2", text: "Headers", id: "customers-create-headers" },
              {
                type: "param",
                name: "X-API-Key",
                paramType: "string",
                required: true,
                description: "Your secret API key",
              },
              {
                type: "param",
                name: "Content-Type",
                paramType: "string",
                required: true,
                description: "application/json",
              },
              { type: "h2", text: "Body", id: "customers-create-body" },
              {
                type: "param",
                name: "email",
                paramType: "string",
                required: true,
                description: "Customer email address",
              },
              {
                type: "param",
                name: "name",
                paramType: "string",
                required: false,
                description: "Customer display name",
              },
              {
                type: "param",
                name: "external_id",
                paramType: "string",
                required: false,
                description:
                  "Your own user ID  allows lookup by your ID without storing Tori IDs",
              },
              { type: "h2", text: "Response", id: "customers-create-response" },
              {
                type: "response",
                status: 201,
                description: "Customer created",
                body: `{
  "data": {
    "id": "2c8e91c2-e848-43d2-888c-b680c6909453",
    "tenant_id": "2d9ff9ec-90db-41cf-9dd6-a5c92f054f97",
    "email": "amaka@startup.ng",
    "name": "Amaka Obi",
    "external_id": "user_12345",
    "created_at": "2026-06-26T00:00:00Z"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "response",
                status: 409,
                description: "Email already exists",
                body: `{ "error": { "code": "email_taken", "message": "a customer with this email already exists" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-customers-list",
            label: "List customers",
            icon: "ti-users",
            method: "GET",
            endpoint: "/v1/customers",
            blocks: [
              {
                type: "p",
                text: "Returns all customers for your account, newest first.",
              },
              { type: "h2", text: "Headers", id: "customers-list-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              {
                type: "h2",
                text: "Query parameters",
                id: "customers-list-query",
              },
              {
                type: "param",
                name: "limit",
                paramType: "integer",
                required: false,
                description: "Max results per page. Default 50, max 100",
              },
              {
                type: "param",
                name: "offset",
                paramType: "integer",
                required: false,
                description: "Number of results to skip. Default 0",
              },
              {
                type: "param",
                name: "external_id",
                paramType: "string",
                required: false,
                description: "Filter by your own user ID",
              },
              { type: "h2", text: "Response", id: "customers-list-response" },
              {
                type: "response",
                status: 200,
                description: "Customers returned",
                body: `{
  "data": [
    { "id": "2c8e91c2-...", "email": "amaka@startup.ng", "name": "Amaka Obi", "external_id": "user_12345", "created_at": "2026-06-26T00:00:00Z" }
  ],
  "pagination": { "has_more": false, "total": 20 },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
            ],
          },
          {
            id: "ref-customers-get",
            label: "Get customer",
            icon: "ti-user",
            method: "GET",
            endpoint: "/v1/platform/customers/{customer_id}",
            blocks: [
              { type: "p", text: "Fetch a single customer by Tori ID." },
              { type: "h2", text: "Headers", id: "customers-get-headers" },
              {
                type: "param",
                name: "X-API-Key",
                paramType: "string",
                required: true,
                description: "Your secret API key",
              },
              { type: "h2", text: "Path parameters", id: "customers-get-path" },
              {
                type: "param",
                name: "customer_id",
                paramType: "uuid",
                required: true,
                description: "The customer ID",
              },
              { type: "h2", text: "Response", id: "customers-get-response" },
              {
                type: "response",
                status: 200,
                description: "Customer returned",
                body: `{
  "data": {
    "id": "2c8e91c2-e848-43d2-888c-b680c6909453",
    "tenant_id": "2d9ff9ec-90db-41cf-9dd6-a5c92f054f97",
    "email": "amaka@startup.ng",
    "name": "Amaka Obi",
    "external_id": "user_12345",
    "created_at": "2026-06-26T00:00:00Z"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "response",
                status: 404,
                description: "Customer not found",
                body: `{ "error": { "code": "not_found", "message": "the requested resource does not exist" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-customers-portal",
            label: "Generate portal token",
            icon: "ti-user-circle",
            method: "GET",
            endpoint: "/v1/platform/customers/{customer_id}/portal-token",
            blocks: [
              {
                type: "p",
                text: "Generate a short-lived portal token. Redirect the customer to /portal?token=... so they can manage their own subscription.",
              },
              { type: "h2", text: "Headers", id: "portal-headers" },
              {
                type: "param",
                name: "X-API-Key",
                paramType: "string",
                required: true,
                description: "Your secret API key",
              },
              { type: "h2", text: "Path parameters", id: "portal-path" },
              {
                type: "param",
                name: "customer_id",
                paramType: "uuid",
                required: true,
                description: "The customer ID",
              },
              { type: "h2", text: "Response", id: "portal-response" },
              {
                type: "response",
                status: 200,
                description: "Portal token generated",
                body: `{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": "3600"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "callout",
                variant: "warn",
                text: "Portal tokens expire after 1 hour. Generate a fresh token each time the customer visits your billing page. Never store or reuse portal tokens.",
              },
            ],
          },
        ],
      },
      {
        group: "Checkout",
        items: [
          {
            id: "ref-checkout",
            label: "Create checkout",
            icon: "ti-shopping-cart",
            method: "POST",
            endpoint: "/v1/platform/checkout",
            blocks: [
              {
                type: "p",
                text: "The primary integration endpoint. Finds or creates the customer, starts the subscription, creates a Nomba checkout session, and returns the checkout URL  all in one call.",
              },
              { type: "h2", text: "Headers", id: "checkout-headers" },
              {
                type: "param",
                name: "X-API-Key",
                paramType: "string",
                required: true,
                description:
                  "Your secret API key (Platform API)  OR  Authorization: Bearer {token} (Dashboard API)",
              },
              {
                type: "param",
                name: "Content-Type",
                paramType: "string",
                required: true,
                description: "application/json",
              },
              { type: "h2", text: "Body", id: "checkout-body" },
              {
                type: "param",
                name: "email",
                paramType: "string",
                required: true,
                description:
                  "Customer email. Tori finds an existing customer or creates a new one.",
              },
              {
                type: "param",
                name: "plan_id",
                paramType: "uuid",
                required: true,
                description: "ID of the plan to subscribe to",
              },
              {
                type: "param",
                name: "name",
                paramType: "string",
                required: false,
                description: "Customer name  used if creating a new customer",
              },
              {
                type: "param",
                name: "external_id",
                paramType: "string",
                required: false,
                description:
                  "Your own user ID  stored on the customer record for lookups",
              },
              {
                type: "param",
                name: "idempotency_key",
                paramType: "string",
                required: false,
                description:
                  "Prevents duplicate subscriptions on network retries. Strongly recommended.",
              },
              {
                type: "param",
                name: "callback_url",
                paramType: "string",
                required: false,
                description:
                  "Where Nomba redirects the customer after payment. Defaults to Tori success page.",
              },
              { type: "h2", text: "Response", id: "checkout-response" },
              {
                type: "response",
                status: 201,
                description: "Subscription started, checkout URL ready",
                body: `{
  "data": {
    "customer": {
      "id": "2c8e91c2-e848-43d2-888c-b680c6909453",
      "email": "amaka@startup.ng",
      "name": "Amaka Obi",
      "external_id": "user_12345",
      "created_at": "2026-06-26T00:00:00Z"
    },
    "subscription": {
      "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
      "status": "TRIALING",
      "current_period_start": "2026-06-26T00:00:00Z",
      "current_period_end": "2026-07-10T00:00:00Z",
      "trial_end": "2026-07-10T00:00:00Z",
      "dunning_attempt": 0
    },
    "customer_created": true,
    "checkout_url": "https://pay.nomba.com/sandbox/QMoj...",
    "requires_payment_method": true
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "response",
                status: 400,
                description: "Missing required field",
                body: `{ "error": { "code": "missing_field", "message": "plan_id is required" }, "meta": { ... } }`,
              },
              {
                type: "response",
                status: 422,
                description: "Plan is inactive",
                body: `{ "error": { "code": "plan_inactive", "message": "this plan is no longer accepting new subscriptions" }, "meta": { ... } }`,
              },
              {
                type: "callout",
                variant: "warn",
                text: "Always redirect the customer to checkout_url immediately  even during a free trial. This tokenises the card now so Tori can charge automatically at trial end. Without a tokenKey at trial end, the subscription moves to PAST_DUE.",
              },
              {
                type: "callout",
                variant: "info",
                text: "customer_created is true if a new customer was just created, false if an existing customer was matched by email. Use this to decide whether to send a welcome email.",
              },
            ],
          },
        ],
      },
      {
        group: "Subscriptions",
        items: [
          {
            id: "ref-subs-list",
            label: "List subscriptions",
            icon: "ti-list",
            method: "GET",
            endpoint: "/v1/subscriptions",
            blocks: [
              {
                type: "p",
                text: "Returns all subscriptions for your account. Filter by status to find everything in a specific billing state.",
              },
              { type: "h2", text: "Headers", id: "subs-list-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Query parameters", id: "subs-list-query" },
              {
                type: "param",
                name: "status",
                paramType: "string",
                required: false,
                description:
                  "Filter by state: TRIALING | ACTIVE | GRACE_PERIOD | PAST_DUE | DUNNING | PAUSED | SUSPENDED | CANCELLED",
              },
              {
                type: "param",
                name: "limit",
                paramType: "integer",
                required: false,
                description: "Max results. Default 20",
              },
              {
                type: "param",
                name: "offset",
                paramType: "integer",
                required: false,
                description: "Results to skip. Default 0",
              },
              { type: "h2", text: "Response", id: "subs-list-response" },
              {
                type: "response",
                status: 200,
                description: "Subscriptions returned",
                body: `{
  "data": [
    {
      "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
      "customer_id": "2c8e91c2-...",
      "plan_id": "afecaf33-...",
      "status": "ACTIVE",
      "current_period_start": "2026-06-26T00:00:00Z",
      "current_period_end": "2026-07-26T00:00:00Z",
      "cancel_at_period_end": false,
      "dunning_attempt": 0
    }
  ],
  "pagination": { "has_more": false, "total": 20 },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
            ],
          },
          {
            id: "ref-subs-get",
            label: "Get subscription",
            icon: "ti-refresh",
            method: "GET",
            endpoint: "/v1/platform/subscriptions/{subscription_id}",
            blocks: [
              { type: "p", text: "Fetch a single subscription by ID." },
              { type: "h2", text: "Headers", id: "subs-get-headers" },
              {
                type: "param",
                name: "X-API-Key",
                paramType: "string",
                required: true,
                description: "Your secret API key",
              },
              { type: "h2", text: "Path parameters", id: "subs-get-path" },
              {
                type: "param",
                name: "subscription_id",
                paramType: "uuid",
                required: true,
                description: "The subscription ID",
              },
              { type: "h2", text: "Response", id: "subs-get-response" },
              {
                type: "response",
                status: 200,
                description: "Subscription returned",
                body: `{
  "data": {
    "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
    "tenant_id": "2d9ff9ec-...",
    "customer_id": "2c8e91c2-...",
    "plan_id": "afecaf33-...",
    "status": "DUNNING",
    "current_period_start": "2026-06-26T00:00:00Z",
    "current_period_end": "2026-07-26T00:00:00Z",
    "trial_end": null,
    "dunning_attempt": 2,
    "next_retry_at": "2026-07-03T00:00:00Z",
    "cancel_at_period_end": false,
    "created_at": "2026-06-26T00:00:00Z",
    "updated_at": "2026-07-03T00:00:00Z"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "table",
                headers: ["Field", "Description"],
                rows: [
                  ["status", "Current state  one of 8 values"],
                  [
                    "dunning_attempt",
                    "Number of failed payment attempts. 0 = healthy",
                  ],
                  [
                    "next_retry_at",
                    "When next retry fires. null if not in dunning",
                  ],
                  ["trial_end", "When trial ends. null if no trial"],
                ],
              },
              {
                type: "response",
                status: 404,
                description: "Subscription not found",
                body: `{ "error": { "code": "not_found", "message": "the requested resource does not exist" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-subs-cancel",
            label: "Cancel subscription",
            icon: "ti-x",
            method: "POST",
            endpoint: "/v1/platform/subscriptions/{subscription_id}/cancel",
            blocks: [
              {
                type: "p",
                text: "Permanently cancel a subscription. This is terminal  cancelled subscriptions cannot be reactivated. If a customer wants to return, create a new subscription.",
              },
              { type: "h2", text: "Headers", id: "subs-cancel-headers" },
              {
                type: "param",
                name: "X-API-Key",
                paramType: "string",
                required: true,
                description: "Your secret API key",
              },
              { type: "h2", text: "Path parameters", id: "subs-cancel-path" },
              {
                type: "param",
                name: "subscription_id",
                paramType: "uuid",
                required: true,
                description: "The subscription ID",
              },
              { type: "h2", text: "Response", id: "subs-cancel-response" },
              {
                type: "response",
                status: 200,
                description: "Subscription cancelled",
                body: `{ "data": { "id": "f6ffcc85-...", "status": "CANCELLED", "cancelled_at": "2026-06-26T00:00:00Z" }, "meta": { ... } }`,
              },
              {
                type: "response",
                status: 422,
                description: "Already cancelled",
                body: `{ "error": { "code": "invalid_transition", "message": "subscription is already cancelled" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-subs-pause",
            label: "Pause subscription",
            icon: "ti-player-pause",
            method: "POST",
            endpoint: "/v1/platform/subscriptions/{subscription_id}/pause",
            blocks: [
              {
                type: "p",
                text: "Pause billing. No charges fire until resumed. The subscription record is kept.",
              },
              { type: "h2", text: "Headers", id: "subs-pause-headers" },
              {
                type: "param",
                name: "X-API-Key",
                paramType: "string",
                required: true,
                description: "Your secret API key",
              },
              { type: "h2", text: "Response", id: "subs-pause-response" },
              {
                type: "response",
                status: 200,
                description: "Subscription paused",
                body: `{ "data": { "id": "f6ffcc85-...", "status": "PAUSED" }, "meta": { ... } }`,
              },
              {
                type: "response",
                status: 422,
                description: "Invalid transition",
                body: `{ "error": { "code": "invalid_transition", "message": "only active subscriptions can be paused" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-subs-resume",
            label: "Resume subscription",
            icon: "ti-player-play",
            method: "POST",
            endpoint: "/v1/platform/subscriptions/{subscription_id}/resume",
            blocks: [
              {
                type: "p",
                text: "Resume a paused subscription. Billing restarts on the next normal cycle.",
              },
              { type: "h2", text: "Headers", id: "subs-resume-headers" },
              {
                type: "param",
                name: "X-API-Key",
                paramType: "string",
                required: true,
                description: "Your secret API key",
              },
              { type: "h2", text: "Response", id: "subs-resume-response" },
              {
                type: "response",
                status: 200,
                description: "Subscription resumed",
                body: `{ "data": { "id": "f6ffcc85-...", "status": "ACTIVE" }, "meta": { ... } }`,
              },
              {
                type: "response",
                status: 422,
                description: "Not paused",
                body: `{ "error": { "code": "invalid_transition", "message": "only paused subscriptions can be resumed" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-plan-change",
            label: "Change plan",
            icon: "ti-arrows-exchange",
            method: "PATCH",
            endpoint: "/v1/platform/subscriptions/{subscription_id}/plan",
            blocks: [
              {
                type: "p",
                text: "Change the subscription's plan mid-cycle with exact proration. Both credit and charge are written to the immutable ledger.",
              },
              { type: "h2", text: "Headers", id: "plan-change-headers" },
              {
                type: "param",
                name: "X-API-Key",
                paramType: "string",
                required: true,
                description: "Your secret API key",
              },
              {
                type: "param",
                name: "Content-Type",
                paramType: "string",
                required: true,
                description: "application/json",
              },
              { type: "h2", text: "Body", id: "plan-change-body" },
              {
                type: "param",
                name: "plan_id",
                paramType: "uuid",
                required: true,
                description: "ID of the new plan to switch to",
              },
              { type: "h2", text: "Response", id: "plan-change-response" },
              {
                type: "response",
                status: 200,
                description: "Plan changed with proration",
                body: `{
  "data": {
    "subscription": { "id": "f6ffcc85-...", "plan_id": "5c9a4529-...", "status": "ACTIVE" },
    "proration": { "credit_kobo": 750000, "charge_kobo": 1125000, "net_adjustment_kobo": 375000 },
    "description": "Upgraded plan  proration charge applied"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "response",
                status: 422,
                description: "Plan change not allowed",
                body: `{ "error": { "code": "invalid_status", "message": "plan changes are only allowed on active subscriptions" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-subs-transitions",
            label: "Transition history",
            icon: "ti-history",
            method: "GET",
            endpoint: "/v1/subscriptions/{subscription_id}/transitions",
            blocks: [
              {
                type: "p",
                text: "Every time a subscription's status changes, Tori writes a row recording the old status, the new status, why it changed, and who or what triggered it. This endpoint returns that history, newest first.",
              },
              { type: "h2", text: "Headers", id: "subs-transitions-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              {
                type: "h2",
                text: "Path parameters",
                id: "subs-transitions-path",
              },
              {
                type: "param",
                name: "subscription_id",
                paramType: "uuid",
                required: true,
                description: "The subscription ID",
              },
              {
                type: "h2",
                text: "Response",
                id: "subs-transitions-response",
              },
              {
                type: "response",
                status: 200,
                description: "Transition history returned",
                body: `{
  "data": [
    {
      "id": "9c1e2f3a-4b5c-6d7e-8f90-1a2b3c4d5e6f",
      "subscription_id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
      "tenant_id": "2d9ff9ec-90db-41cf-9dd6-a5c92f054f97",
      "from_status": "ACTIVE",
      "to_status": "GRACE_PERIOD",
      "reason": "status_update",
      "actor": "system",
      "created_at": "2026-07-03T00:00:00Z"
    },
    {
      "id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f90a1b2c3",
      "subscription_id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
      "tenant_id": "2d9ff9ec-90db-41cf-9dd6-a5c92f054f97",
      "from_status": "TRIALING",
      "to_status": "ACTIVE",
      "reason": "renewal",
      "actor": "system",
      "created_at": "2026-06-26T00:00:00Z"
    }
  ],
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "table",
                headers: ["Field", "Meaning"],
                rows: [
                  ["reason", "'status_update' for a direct status change, 'renewal' for a billing cycle renewal"],
                  ["actor", "'system' for anything triggered by a webhook or a background job. There is no operator-attributed actor yet"],
                ],
              },
              {
                type: "callout",
                variant: "info",
                text: "This history starts from the day the feature shipped. Status changes that happened before that are not backfilled, only new ones are recorded going forward.",
              },
            ],
          },
          {
            id: "ref-subs-retry-now",
            label: "Retry now",
            icon: "ti-refresh-dot",
            method: "POST",
            endpoint: "/v1/subscriptions/{subscription_id}/retry-now",
            blocks: [
              {
                type: "p",
                text: "An operator action from the Recovery Command Center. Queues an immediate payment retry instead of waiting for the next scheduled dunning attempt (Day 3, 7, 14, or 21).",
              },
              { type: "h2", text: "Headers", id: "subs-retry-now-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "subs-retry-now-response" },
              {
                type: "response",
                status: 200,
                description: "Retry queued",
                body: `{ "data": { "message": "retry queued", "subscription_id": "f6ffcc85-..." }, "meta": { ... } }`,
              },
              {
                type: "p",
                text: "The retry runs on the next worker poll cycle, not synchronously in this request. Check the subscription's status or its transition history a few seconds later to see the outcome.",
              },
            ],
          },
          {
            id: "ref-subs-send-pay-link",
            label: "Send pay link",
            icon: "ti-link",
            method: "POST",
            endpoint: "/v1/subscriptions/{subscription_id}/send-pay-link",
            blocks: [
              {
                type: "p",
                text: "An operator action for when card retries and mandate charges have both failed. Marks the subscription's recovery rail as manual and fires a payment.action_required webhook with a fresh checkout link, so you can email or message the customer directly.",
              },
              {
                type: "h2",
                text: "Headers",
                id: "subs-send-pay-link-headers",
              },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              {
                type: "h2",
                text: "Response",
                id: "subs-send-pay-link-response",
              },
              {
                type: "response",
                status: 200,
                description: "Pay link webhook queued",
                body: `{ "data": { "message": "pay link webhook queued", "subscription_id": "f6ffcc85-..." }, "meta": { ... } }`,
              },
              {
                type: "callout",
                variant: "info",
                text: "Handle payment.action_required in your webhook handler the same way you handle dunning.started: show the customer a payment prompt using the checkout link in the event payload.",
              },
            ],
          },
          {
            id: "ref-subs-recover",
            label: "Recover subscription",
            icon: "ti-first-aid-kit",
            method: "POST",
            endpoint: "/v1/subscriptions/{subscription_id}/recover",
            blocks: [
              {
                type: "p",
                text: "Manually move a SUSPENDED subscription back to ACTIVE. Use this after you have confirmed payment out of band, for example the customer paid by bank transfer and told you directly.",
              },
              { type: "h2", text: "Headers", id: "subs-recover-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "subs-recover-response" },
              {
                type: "response",
                status: 200,
                description: "Subscription reactivated",
                body: `{ "data": { "id": "f6ffcc85-...", "status": "ACTIVE" }, "meta": { ... } }`,
              },
              {
                type: "response",
                status: 422,
                description: "Not suspended",
                body: `{ "error": { "code": "invalid_transition", "message": "only suspended subscriptions can be manually recovered" }, "meta": { ... } }`,
              },
            ],
          },
        ],
      },
      {
        group: "Invoices",
        items: [
          {
            id: "ref-invoices-list",
            label: "List invoices",
            icon: "ti-receipt",
            method: "GET",
            endpoint: "/v1/invoices",
            blocks: [
              {
                type: "p",
                text: "Returns all invoices for your account. Filter by status to find open, paid, or voided invoices.",
              },
              { type: "h2", text: "Headers", id: "invoices-list-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              {
                type: "h2",
                text: "Query parameters",
                id: "invoices-list-query",
              },
              {
                type: "param",
                name: "status",
                paramType: "string",
                required: false,
                description: "draft | open | paid | void | uncollectible",
              },
              {
                type: "param",
                name: "limit",
                paramType: "integer",
                required: false,
                description: "Max results. Default 50",
              },
              { type: "h2", text: "Response", id: "invoices-list-response" },
              {
                type: "response",
                status: 200,
                description: "Invoices returned",
                body: `{
  "data": [
    {
      "id": "bb7a9109-5b64-40b1-afe6-7b8197163ad9",
      "subscription_id": "f938d703-...",
      "customer_id": "7eeeec64-...",
      "amount": 250000,
      "currency": "NGN",
      "status": "paid",
      "due_date": "2026-06-23T00:00:00Z",
      "paid_at": "2026-06-24T00:00:00Z",
      "nomba_charge_ref": "WEB-ONLINE_C-abc123",
      "line_items": [{ "description": "Basic  monthly billing", "amount": 250000, "currency": "NGN" }],
      "created_at": "2026-06-23T00:00:00Z"
    }
  ],
  "pagination": { "has_more": false, "total": 20 },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "table",
                headers: ["Status", "Meaning"],
                rows: [
                  ["draft", "Created but not yet finalised"],
                  ["open", "Issued, payment pending"],
                  [
                    "paid",
                    "Payment received  paid_at and nomba_charge_ref populated",
                  ],
                  ["void", "Voided  subscription cancelled before payment"],
                  ["uncollectible", "Dunning exhausted, payment unrecoverable"],
                ],
              },
            ],
          },
          {
            id: "ref-invoices-get",
            label: "Get invoice",
            icon: "ti-file-invoice",
            method: "GET",
            endpoint: "/v1/invoices/{invoice_id}",
            blocks: [
              { type: "p", text: "Fetch a single invoice by ID." },
              { type: "h2", text: "Headers", id: "invoices-get-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Path parameters", id: "invoices-get-path" },
              {
                type: "param",
                name: "invoice_id",
                paramType: "uuid",
                required: true,
                description: "The invoice ID",
              },
              { type: "h2", text: "Response", id: "invoices-get-response" },
              {
                type: "response",
                status: 200,
                description: "Invoice returned",
                body: `{
  "data": {
    "id": "bb7a9109-...", "subscription_id": "f938d703-...", "customer_id": "7eeeec64-...",
    "amount": 250000, "currency": "NGN", "status": "paid",
    "due_date": "2026-06-23T00:00:00Z", "paid_at": "2026-06-24T00:00:00Z",
    "line_items": [{ "description": "Basic  monthly billing", "amount": 250000, "currency": "NGN" }]
  },
  "meta": { ... }
}`,
              },
            ],
          },
        ],
      },
      {
        group: "Ledger",
        items: [
          {
            id: "ref-ledger-list",
            label: "List entries",
            icon: "ti-book",
            method: "GET",
            endpoint: "/v1/ledger",
            blocks: [
              {
                type: "p",
                text: "Returns all ledger entries for your account in a date range, newest first. The ledger is append-only  no entries are ever edited or deleted.",
              },
              { type: "h2", text: "Headers", id: "ledger-list-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Query parameters", id: "ledger-list-query" },
              {
                type: "param",
                name: "from",
                paramType: "string",
                required: false,
                description: "Start date in YYYY-MM-DD format",
              },
              {
                type: "param",
                name: "to",
                paramType: "string",
                required: false,
                description: "End date in YYYY-MM-DD format",
              },
              {
                type: "param",
                name: "limit",
                paramType: "integer",
                required: false,
                description: "Max results. Default 50",
              },
              { type: "h2", text: "Response", id: "ledger-list-response" },
              {
                type: "response",
                status: 200,
                description: "Ledger entries returned",
                body: `{
  "data": [
    {
      "id": "a1b2c3d4-...", "entry_type": "CHARGE", "direction": "DEBIT",
      "amount": 1500000, "currency": "NGN",
      "description": "Subscription renewal  month 1",
      "subscription_id": "f6ffcc85-...", "customer_id": "2c8e91c2-...",
      "created_at": "2026-06-26T00:00:00Z"
    }
  ],
  "pagination": { "has_more": false, "total": 44 },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
            ],
          },
          {
            id: "ref-ledger-summary",
            label: "Ledger summary",
            icon: "ti-chart-pie",
            method: "GET",
            endpoint: "/v1/ledger/summary",
            blocks: [
              {
                type: "p",
                text: "Returns aggregated totals for a period. This is the source of all revenue dashboard numbers.",
              },
              { type: "h2", text: "Headers", id: "ledger-summary-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              {
                type: "h2",
                text: "Query parameters",
                id: "ledger-summary-query",
              },
              {
                type: "param",
                name: "from",
                paramType: "string",
                required: true,
                description: "Start date YYYY-MM-DD",
              },
              {
                type: "param",
                name: "to",
                paramType: "string",
                required: true,
                description: "End date YYYY-MM-DD",
              },
              { type: "h2", text: "Response", id: "ledger-summary-response" },
              {
                type: "response",
                status: 200,
                description: "Summary returned",
                body: `{
  "data": {
    "total_charged": 91500000,
    "total_refunded": 750000,
    "total_credits_applied": 0,
    "net_revenue": 90750000,
    "entry_count": 44,
    "currency": "NGN"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
            ],
          },
        ],
      },
      {
        group: "Webhooks",
        items: [
          {
            id: "ref-webhooks-create",
            label: "Register endpoint",
            icon: "ti-plus",
            method: "POST",
            endpoint: "/v1/webhooks/endpoints",
            blocks: [
              {
                type: "p",
                text: "Register a URL to receive webhook deliveries. The response includes a signing secret  save it immediately, it is shown once.",
              },
              { type: "h2", text: "Headers", id: "webhooks-create-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              {
                type: "param",
                name: "Content-Type",
                paramType: "string",
                required: true,
                description: "application/json",
              },
              { type: "h2", text: "Body", id: "webhooks-create-body" },
              {
                type: "param",
                name: "url",
                paramType: "string",
                required: true,
                description: "Your HTTPS endpoint URL",
              },
              {
                type: "param",
                name: "events",
                paramType: "array",
                required: false,
                description: `List of event types to subscribe to. ["*"] subscribes to all events.`,
              },
              { type: "h2", text: "Response", id: "webhooks-create-response" },
              {
                type: "response",
                status: 201,
                description: "Endpoint registered  secret shown once",
                body: `{
  "data": {
    "endpoint": {
      "id": "ep_abc123-...", "url": "https://yourapp.ng/webhooks/tori",
      "is_active": true, "api_version": "2026-06-01", "created_at": "2026-06-26T00:00:00Z"
    },
    "secret": "whsec_a1b2c3d4e5f...."
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "callout",
                variant: "warn",
                text: "The webhook secret is shown exactly once. If you lose it, delete the endpoint and create a new one.",
              },
            ],
          },
          {
            id: "ref-webhooks-list",
            label: "List endpoints",
            icon: "ti-list",
            method: "GET",
            endpoint: "/v1/webhooks/endpoints",
            blocks: [
              {
                type: "p",
                text: "Returns all registered webhook endpoints for your account.",
              },
              { type: "h2", text: "Headers", id: "webhooks-list-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "webhooks-list-response" },
              {
                type: "response",
                status: 200,
                description: "Endpoints returned",
                body: `{
  "data": [{ "id": "ep_abc123-...", "url": "https://yourapp.ng/webhooks/tori", "is_active": true, "api_version": "2026-06-01" }],
  "meta": { ... }
}`,
              },
            ],
          },
          {
            id: "ref-webhooks-logs",
            label: "Delivery logs",
            icon: "ti-clipboard-list",
            method: "GET",
            endpoint: "/v1/webhooks/logs",
            blocks: [
              {
                type: "p",
                text: "Returns all webhook delivery attempts, newest first. Each shows event type, delivery status, attempt count, and response from your server.",
              },
              { type: "h2", text: "Headers", id: "webhooks-logs-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "webhooks-logs-response" },
              {
                type: "response",
                status: 200,
                description: "Delivery logs returned",
                body: `{
  "data": [
    { "id": "del_xyz789-...", "endpoint_id": "ep_abc123-...", "event_type": "payment.succeeded", "status": "delivered", "attempt_count": 1, "response_status": 200, "created_at": "2026-06-26T00:00:00Z" },
    { "id": "del_xyz790-...", "event_type": "payment.failed", "status": "failed", "attempt_count": 3, "response_status": 500, "created_at": "2026-06-26T00:00:00Z" }
  ],
  "meta": { ... }
}`,
              },
            ],
          },
          {
            id: "ref-webhooks-retry",
            label: "Retry delivery",
            icon: "ti-refresh",
            method: "POST",
            endpoint: "/v1/webhooks/logs/{delivery_id}/retry",
            blocks: [
              {
                type: "p",
                text: "Immediately re-attempt a failed webhook delivery. Useful when your server was temporarily down.",
              },
              { type: "h2", text: "Headers", id: "webhooks-retry-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              {
                type: "h2",
                text: "Path parameters",
                id: "webhooks-retry-path",
              },
              {
                type: "param",
                name: "delivery_id",
                paramType: "uuid",
                required: true,
                description: "The delivery log ID",
              },
              { type: "h2", text: "Response", id: "webhooks-retry-response" },
              {
                type: "response",
                status: 200,
                description: "Retry queued",
                body: `{ "data": { "status": "queued" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-webhooks-delete",
            label: "Delete endpoint",
            icon: "ti-trash",
            method: "DELETE",
            endpoint: "/v1/webhooks/endpoints/{endpoint_id}",
            blocks: [
              {
                type: "p",
                text: "Delete a webhook endpoint and all associated delivery logs.",
              },
              { type: "h2", text: "Headers", id: "webhooks-delete-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "webhooks-delete-response" },
              {
                type: "response",
                status: 200,
                description: "Endpoint deleted",
                body: `{ "data": { "status": "deleted" }, "meta": { ... } }`,
              },
            ],
          },
        ],
      },
      {
        group: "Team Management",
        items: [
          {
            id: "ref-team-list",
            label: "List members",
            icon: "ti-users-group",
            method: "GET",
            endpoint: "/v1/team/members",
            blocks: [
              {
                type: "p",
                text: "Returns every active member of your team plus every invitation that has not been accepted yet. The tenant owner is a member too, with role owner.",
              },
              { type: "h2", text: "Headers", id: "team-list-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "team-list-response" },
              {
                type: "response",
                status: 200,
                description: "Members and invitations returned",
                body: `{
  "data": {
    "members": [
      {
        "id": "cc6307db-a4a1-4a7e-9d61-742a6d1641b8",
        "tenant_id": "2d9ff9ec-90db-41cf-9dd6-a5c92f054f97",
        "email": "dev@tori.ng",
        "name": "Tori Demo",
        "role": "owner",
        "status": "active",
        "last_login_at": "2026-07-05T09:12:04.881Z",
        "created_at": "2026-06-30T23:44:16.663Z",
        "updated_at": "2026-07-05T09:12:04.881Z"
      }
    ],
    "invitations": [
      {
        "id": "d1e2f3a4-b5c6-7d8e-9f01-2a3b4c5d6e7f",
        "tenant_id": "2d9ff9ec-90db-41cf-9dd6-a5c92f054f97",
        "email": "newdev@startup.ng",
        "role": "developer",
        "expires_at": "2026-07-08T09:00:00Z",
        "created_at": "2026-07-05T09:00:00Z"
      }
    ]
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "table",
                headers: ["Role", "Can do"],
                rows: [
                  ["owner", "Everything. Cannot be removed"],
                  ["admin", "Everything except removing the owner"],
                  ["developer", "Manage plans, customers, subscriptions, API keys, webhooks"],
                  ["viewer", "Read-only access to the dashboard"],
                ],
              },
            ],
          },
          {
            id: "ref-team-invite",
            label: "Invite a member",
            icon: "ti-user-plus",
            method: "POST",
            endpoint: "/v1/team/members/invite",
            blocks: [
              {
                type: "p",
                text: "Sends an email invite with a link to accept-invite on your dashboard. The invite token is valid for 72 hours.",
              },
              { type: "h2", text: "Headers", id: "team-invite-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Body", id: "team-invite-body" },
              {
                type: "param",
                name: "email",
                paramType: "string",
                required: true,
                description: "The teammate's email address",
              },
              {
                type: "param",
                name: "role",
                paramType: "string",
                required: false,
                description: "owner | admin | developer | viewer. Defaults to developer",
              },
              { type: "h2", text: "Response", id: "team-invite-response" },
              {
                type: "response",
                status: 201,
                description: "Invitation created and emailed",
                body: `{
  "data": {
    "id": "d1e2f3a4-b5c6-7d8e-9f01-2a3b4c5d6e7f",
    "tenant_id": "2d9ff9ec-90db-41cf-9dd6-a5c92f054f97",
    "email": "newdev@startup.ng",
    "role": "developer",
    "token": "9f8e7d6c5b4a3928f1e0d9c8b7a695847362514f",
    "expires_at": "2026-07-08T09:00:00Z",
    "created_at": "2026-07-05T09:00:00Z"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "response",
                status: 400,
                description: "Already a member",
                body: `{ "error": { "code": "already_member", "message": "this email is already a team member" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-team-role",
            label: "Update member role",
            icon: "ti-shield-check",
            method: "PATCH",
            endpoint: "/v1/team/members/{member_id}/role",
            blocks: [
              {
                type: "p",
                text: "Change what a team member is allowed to do.",
              },
              { type: "h2", text: "Headers", id: "team-role-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Body", id: "team-role-body" },
              {
                type: "param",
                name: "role",
                paramType: "string",
                required: true,
                description: "owner | admin | developer | viewer",
              },
              { type: "h2", text: "Response", id: "team-role-response" },
              {
                type: "response",
                status: 200,
                description: "Role updated",
                body: `{ "data": { "id": "cc6307db-...", "role": "admin" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-team-remove",
            label: "Remove member",
            icon: "ti-user-minus",
            method: "DELETE",
            endpoint: "/v1/team/members/{member_id}",
            blocks: [
              {
                type: "p",
                text: "Removes a team member's access. The workspace owner cannot be removed this way.",
              },
              { type: "h2", text: "Headers", id: "team-remove-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "team-remove-response" },
              {
                type: "response",
                status: 200,
                description: "Member removed",
                body: `{ "data": { "status": "removed" }, "meta": { ... } }`,
              },
              {
                type: "response",
                status: 400,
                description: "Tried to remove the owner",
                body: `{ "error": { "code": "cannot_remove_owner", "message": "workspace owner cannot be removed" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-team-revoke-invite",
            label: "Revoke invitation",
            icon: "ti-mail-x",
            method: "DELETE",
            endpoint: "/v1/team/invitations/{invitation_id}",
            blocks: [
              {
                type: "p",
                text: "Cancels a pending invitation before it is accepted. The invite link stops working immediately.",
              },
              {
                type: "h2",
                text: "Headers",
                id: "team-revoke-invite-headers",
              },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              {
                type: "h2",
                text: "Response",
                id: "team-revoke-invite-response",
              },
              {
                type: "response",
                status: 200,
                description: "Invitation revoked",
                body: `{ "data": { "status": "revoked" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-team-accept-invite",
            label: "Accept invitation",
            icon: "ti-check",
            method: "POST",
            endpoint: "/v1/team/invitations/accept",
            blocks: [
              {
                type: "p",
                text: "Public endpoint, no authentication required. This is what the accept-invite page on your dashboard calls when an invited teammate sets their name and password.",
              },
              { type: "h2", text: "Body", id: "team-accept-invite-body" },
              {
                type: "param",
                name: "token",
                paramType: "string",
                required: true,
                description: "The token from the invite email link",
              },
              {
                type: "param",
                name: "name",
                paramType: "string",
                required: false,
                description: "The new member's display name",
              },
              {
                type: "param",
                name: "password",
                paramType: "string",
                required: true,
                description: "Minimum 8 characters",
              },
              {
                type: "h2",
                text: "Response",
                id: "team-accept-invite-response",
              },
              {
                type: "response",
                status: 201,
                description: "Member created, invitation marked accepted",
                body: `{ "data": { "message": "Invitation accepted. You can now log in." }, "meta": { ... } }`,
              },
              {
                type: "response",
                status: 400,
                description: "Token invalid, expired, or already used",
                body: `{ "error": { "code": "invitation_expired", "message": "this invitation has expired" }, "meta": { ... } }`,
              },
              {
                type: "callout",
                variant: "info",
                text: "After this call succeeds, the new member logs in through the normal POST /v1/auth/login with the email the invite was sent to. There is no separate member login endpoint.",
              },
            ],
          },
          {
            id: "ref-team-audit-log",
            label: "Audit log",
            icon: "ti-clipboard-list",
            method: "GET",
            endpoint: "/v1/team/audit-log",
            blocks: [
              {
                type: "p",
                text: "Every admin action (invite, role change, removal) writes one row here with who did it, from what IP, and when.",
              },
              { type: "h2", text: "Headers", id: "team-audit-log-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "team-audit-log-response" },
              {
                type: "response",
                status: 200,
                description: "Audit log returned, newest first",
                body: `{
  "data": {
    "data": [
      {
        "id": "5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
        "tenant_id": "2d9ff9ec-90db-41cf-9dd6-a5c92f054f97",
        "actor_email": "dev@tori.ng",
        "action": "member.invited",
        "target": "newdev@startup.ng",
        "ip_address": "102.89.23.44",
        "created_at": "2026-07-05T09:00:00Z"
      }
    ]
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
            ],
          },
        ],
      },
      {
        group: "Promo Codes",
        items: [
          {
            id: "ref-promo-create",
            label: "Create promo code",
            icon: "ti-discount",
            method: "POST",
            endpoint: "/v1/promo-codes",
            blocks: [
              {
                type: "p",
                text: "Create a discount code customers can redeem at checkout by passing promo_code on POST /v1/platform/checkout.",
              },
              { type: "h2", text: "Headers", id: "promo-create-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Body", id: "promo-create-body" },
              {
                type: "param",
                name: "code",
                paramType: "string",
                required: true,
                description:
                  "4 to 20 letters and numbers. Tori uppercases it automatically, SAVE20 and save20 are the same code",
              },
              {
                type: "param",
                name: "description",
                paramType: "string",
                required: false,
                description: "Internal note, not shown to the customer",
              },
              {
                type: "param",
                name: "discount_type",
                paramType: "string",
                required: true,
                description: "percentage or fixed",
              },
              {
                type: "param",
                name: "discount_value",
                paramType: "integer",
                required: true,
                description:
                  "For percentage: 1 to 100. For fixed: kobo amount, minimum 100",
              },
              {
                type: "param",
                name: "plan_id",
                paramType: "uuid",
                required: false,
                description: "Restrict the code to one plan. Omit for all plans",
              },
              {
                type: "param",
                name: "max_uses",
                paramType: "integer",
                required: false,
                description: "Total redemptions allowed. Omit for unlimited",
              },
              {
                type: "param",
                name: "expires_at",
                paramType: "string",
                required: false,
                description: "RFC3339 timestamp. Omit for a code that never expires",
              },
              { type: "h2", text: "Response", id: "promo-create-response" },
              {
                type: "response",
                status: 201,
                description: "Promo code created",
                body: `{
  "data": {
    "id": "f16df6ab-1e54-4f33-a91d-3182efa81a15",
    "tenant_id": "2d9ff9ec-90db-41cf-9dd6-a5c92f054f97",
    "code": "SAVE20",
    "description": "Launch discount",
    "discount_type": "percentage",
    "discount_value": 20,
    "plan_id": null,
    "max_uses": null,
    "use_count": 0,
    "expires_at": null,
    "is_active": true,
    "created_at": "2026-07-05T01:08:47.056Z",
    "updated_at": "2026-07-05T01:08:47.056Z"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "response",
                status: 409,
                description: "Code already exists for this tenant",
                body: `{ "error": { "code": "code_already_exists", "message": "a promo code with this code already exists" }, "meta": { ... } }`,
              },
              {
                type: "response",
                status: 400,
                description: "Invalid discount value",
                body: `{ "error": { "code": "invalid_discount_value", "message": "percentage discount must be between 1 and 100" }, "meta": { ... } }`,
              },
            ],
          },
          {
            id: "ref-promo-list",
            label: "List promo codes",
            icon: "ti-list",
            method: "GET",
            endpoint: "/v1/promo-codes",
            blocks: [
              {
                type: "p",
                text: "Returns every promo code for your account, active and inactive, newest first.",
              },
              { type: "h2", text: "Headers", id: "promo-list-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "promo-list-response" },
              {
                type: "response",
                status: 200,
                description: "Promo codes returned",
                body: `{
  "data": [
    {
      "id": "f16df6ab-1e54-4f33-a91d-3182efa81a15",
      "code": "SAVE20",
      "discount_type": "percentage",
      "discount_value": 20,
      "plan_id": null,
      "max_uses": null,
      "use_count": 1,
      "expires_at": null,
      "is_active": true,
      "created_at": "2026-07-05T01:08:47.056Z"
    }
  ],
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "p",
                text: "The dashboard computes a display status from these fields: Active, Expired (past expires_at), Depleted (use_count reached max_uses), or Inactive (is_active is false). Tori does not send a status field, you derive it the same way.",
              },
            ],
          },
          {
            id: "ref-promo-deactivate",
            label: "Deactivate promo code",
            icon: "ti-ban",
            method: "DELETE",
            endpoint: "/v1/promo-codes/{promo_id}",
            blocks: [
              {
                type: "p",
                text: "Soft delete only. Sets is_active to false so the code can no longer be redeemed. There is no hard delete from the API or the dashboard, the code and its use_count history stay for record keeping.",
              },
              { type: "h2", text: "Headers", id: "promo-deactivate-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              {
                type: "h2",
                text: "Path parameters",
                id: "promo-deactivate-path",
              },
              {
                type: "param",
                name: "promo_id",
                paramType: "uuid",
                required: true,
                description: "The promo code's ID",
              },
              {
                type: "h2",
                text: "Response",
                id: "promo-deactivate-response",
              },
              {
                type: "response",
                status: 200,
                description: "Promo code deactivated",
                body: `{ "data": { "id": "f16df6ab-...", "is_active": false }, "meta": { ... } }`,
              },
            ],
          },
        ],
      },
      {
        group: "Billing Health",
        items: [
          {
            id: "ref-health",
            label: "Portfolio health",
            icon: "ti-heartbeat",
            method: "GET",
            endpoint: "/v1/health",
            blocks: [
              {
                type: "p",
                text: "Returns real-time health scores and churn predictions for all active subscriptions.",
              },
              { type: "h2", text: "Headers", id: "health-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "health-response" },
              {
                type: "response",
                status: 200,
                description: "Health data returned",
                body: `{
  "data": {
    "average_score": 74,
    "healthy_count": 9, "at_risk_count": 2, "critical_count": 1, "churn_risk_count": 2,
    "subscriptions": [
      {
        "id": "f6ffcc85-...", "status": "DUNNING",
        "health": { "score": 28, "label": "At risk", "color": "#EA580C", "reason": "Payment failing. Retries in progress." },
        "churn": { "signal": "high", "score": 65, "reasons": ["Two failed attempts", "Period ends in 4 days"], "recommended_action": "Contact the customer immediately." }
      }
    ]
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "table",
                headers: ["Factor", "Deduction"],
                rows: [
                  ["DUNNING state", "-40"],
                  ["SUSPENDED state", "-60"],
                  ["PAST_DUE state", "-20"],
                  ["GRACE_PERIOD state", "-10"],
                  ["PAUSED state", "-10"],
                  ["Each dunning attempt", "-10 (capped at -40)"],
                  ["Subscription under 30 days", "-5"],
                  ["Previously recovered from dunning", "-10"],
                ],
              },
            ],
          },
          {
            id: "ref-health-forecast",
            label: "Revenue forecast",
            icon: "ti-chart-arrows-vertical",
            method: "GET",
            endpoint: "/v1/health/forecast",
            blocks: [
              {
                type: "p",
                text: "Next month's expected revenue in three estimates with confidence level.",
              },
              { type: "h2", text: "Headers", id: "forecast-headers" },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Response", id: "forecast-response" },
              {
                type: "response",
                status: 200,
                description: "Forecast returned",
                body: `{
  "data": {
    "period_label": "July 2026",
    "expected_low": 18740000, "expected_mid": 23420000, "expected_high": 24600000,
    "active_subscriptions": 12, "at_risk_revenue": 10040000,
    "recovery_rate_pct": 65, "confidence": "medium",
    "note": "Forecast includes dunning recovery estimate based on historical retry success rate."
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
            ],
          },
        ],
      },
      {
        group: "Finance",
        items: [
          {
            id: "ref-recovery-center",
            label: "Recovery Command Center",
            icon: "ti-refresh-alert",
            method: "GET",
            endpoint: "/v1/finance/recovery-center",
            blocks: [
              {
                type: "p",
                text: "One call that answers 'how much revenue is at risk right now, and how much have we gotten back'. Splits every non-healthy subscription into at risk, recovering, and recovered buckets.",
              },
              {
                type: "h2",
                text: "Headers",
                id: "recovery-center-headers",
              },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              {
                type: "h2",
                text: "Response",
                id: "recovery-center-response",
              },
              {
                type: "response",
                status: 200,
                description: "Recovery pipeline returned",
                body: `{
  "data": {
    "at_risk_kobo": 12500000,
    "recovered_kobo": 0,
    "recovery_rate_pct": 0,
    "at_risk_count": 5,
    "recovering_count": 2,
    "recovered_count": 0,
    "at_risk": [
      {
        "subscription_id": "aa860e3c-500f-4aeb-bd6b-d6725371fdd4",
        "customer_id": "e949b34d-0c87-4409-a2be-824cf90e2888",
        "customer_email": "chibueze@test.com",
        "status": "PAST_DUE",
        "amount_kobo": 500000,
        "recovery_rail": "card",
        "dunning_attempt": 0,
        "plan_name": "Starter"
      }
    ],
    "recovering": [
      {
        "subscription_id": "ae2723a6-a5f1-4b9b-acd2-5ce138afce56",
        "customer_id": "0a43124f-9b60-43f6-94ab-848641781b4c",
        "customer_email": "hauwa@food.ng",
        "status": "DUNNING",
        "amount_kobo": 5000000,
        "recovery_rail": "card",
        "dunning_attempt": 2,
        "next_retry_at": "2026-07-05T23:44:41.825Z",
        "plan_name": "Business"
      }
    ],
    "recovered": [],
    "currency": "NGN",
    "generated_at": "2026-07-05T00:23:26.428Z"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "table",
                headers: ["Bucket", "Meaning"],
                rows: [
                  ["at_risk", "GRACE_PERIOD or PAST_DUE. Not retrying on a schedule yet, or the first retry hasn't fired"],
                  ["recovering", "DUNNING. Actively retrying on the payday schedule"],
                  ["recovered", "Came back to ACTIVE from GRACE_PERIOD, PAST_DUE, or DUNNING within this reporting window"],
                ],
              },
              {
                type: "p",
                text: "recovery_rail on each item is card, mandate, or manual. It tells you where that subscription currently sits on the recovery ladder. See the Dunning and retries section for how the ladder escalates from one rail to the next.",
              },
            ],
          },
        ],
      },
      {
        group: "Settings",
        items: [
          {
            id: "ref-dunning-config",
            label: "Update dunning configuration",
            icon: "ti-adjustments",
            method: "PATCH",
            endpoint: "/v1/dunning-config",
            blocks: [
              {
                type: "p",
                text: "Override the default retry schedule and behaviour for your tenant. Applies to every subscription you own.",
              },
              {
                type: "h2",
                text: "Headers",
                id: "dunning-config-headers",
              },
              {
                type: "param",
                name: "Authorization",
                paramType: "string",
                required: true,
                description: "Bearer {access_token}",
              },
              { type: "h2", text: "Body", id: "dunning-config-body" },
              {
                type: "param",
                name: "retry_intervals_days",
                paramType: "array",
                required: true,
                description: "Days after failure to retry, for example [3, 7, 14, 21]",
              },
              {
                type: "param",
                name: "max_attempts",
                paramType: "integer",
                required: true,
                description: "1 to 10",
              },
              {
                type: "param",
                name: "suspension_action",
                paramType: "string",
                required: false,
                description: "suspend or cancel. What happens after retries are exhausted",
              },
              {
                type: "param",
                name: "notify_customer",
                paramType: "boolean",
                required: false,
                description: "Fire dunning webhooks the customer-facing product should show",
              },
              {
                type: "param",
                name: "notify_merchant",
                paramType: "boolean",
                required: false,
                description: "Fire dunning webhooks for internal alerting",
              },
              {
                type: "param",
                name: "smart_retry",
                paramType: "boolean",
                required: false,
                description: "Use Nigerian failure classification to skip retries on permanent declines",
              },
              { type: "h2", text: "Response", id: "dunning-config-response" },
              {
                type: "response",
                status: 200,
                description: "Config updated",
                body: `{
  "data": {
    "retry_intervals_days": [3, 7, 14, 21],
    "max_attempts": 4,
    "suspension_action": "suspend",
    "notify_customer": true,
    "notify_merchant": true,
    "smart_retry": true
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "response",
                status: 400,
                description: "Invalid config",
                body: `{ "error": { "code": "invalid_field", "message": "max_attempts must be between 1 and 10" }, "meta": { ... } }`,
              },
            ],
          },
        ],
      },
      {
        group: "System",
        items: [
          {
            id: "ref-health-check",
            label: "Health check",
            icon: "ti-activity",
            method: "GET",
            endpoint: "/v1/status",
            blocks: [
              {
                type: "p",
                text: "Returns the current status of the Tori API. No authentication required. Use this to verify the API is reachable from your server.",
              },
              { type: "h2", text: "Response", id: "healthcheck-response" },
              {
                type: "response",
                status: 200,
                description: "API is healthy",
                body: `{
  "data": {
    "status": "ok",
    "service": "tori-api",
    "version": "1.0.0",
    "timestamp": "2026-06-26T21:00:00Z",
    "checks": { "api": "ok", "nomba": "connected" }
  },
  "meta": { "request_id": "uuid", "api_version": "2026-06-01" }
}`,
              },
              {
                type: "callout",
                variant: "info",
                text: "Also available at GET /health (no version prefix). Both return identical responses.",
              },
            ],
          },
        ],
      },
    ],
  },
  // ═══════════════════════════════════════════════════════════
  // TAB 3  DEVELOPER RESOURCES
  // ═══════════════════════════════════════════════════════════
  {
    id: "developer-resources",
    label: "Developer Resources",
    groups: [
      {
        group: "Resources",
        items: [
          {
            id: "test-cards",
            label: "Nomba test cards",
            icon: "ti-credit-card",
            blocks: [
              {
                type: "p",
                text: "Use these Nomba sandbox test cards to exercise every billing scenario without real money.",
              },
              { type: "h2", text: "Test card numbers", id: "card-numbers" },
              {
                type: "table",
                headers: ["Card number", "Network", "Outcome", "OTP"],
                rows: [
                  [
                    "5434621074252808",
                    "Mastercard",
                    "OTP required  success path",
                    "9999 = approve, 1234 = timeout, 5464 = invalid",
                  ],
                  [
                    "4000000000002503",
                    "Visa",
                    "3DS authentication required",
                    "Handle 3DS redirect",
                  ],
                  [
                    "5484497218317651",
                    "Mastercard",
                    "Declined  do not honour",
                    "None  immediate decline",
                  ],
                ],
              },
              {
                type: "callout",
                variant: "info",
                text: "Card expiry, CVV, and PIN are not validated in the sandbox. Any values are accepted. Use PIN 1234 on the Nomba sandbox payment page.",
              },
              {
                type: "h2",
                text: "Testing the full dunning flow",
                id: "dunning-test",
              },
              {
                type: "list",
                items: [
                  "Create a checkout  subscription starts in TRIALING or ACTIVE",
                  "Complete checkout with card 5484497218317651  charge declines",
                  "Subscription enters GRACE_PERIOD (48-hour silent retry)",
                  "After 48 hours: grace retry fails → PAST_DUE → DUNNING",
                  "Worker schedules retries at Day 3, 7, 14, 21",
                  "To simulate recovery: next retry fires → use card 5434621074252808, OTP 9999",
                  "Watch dunning.recovered webhook fire → subscription returns to ACTIVE",
                ],
              },
            ],
          },
          {
            id: "errors",
            label: "Error reference",
            icon: "ti-alert-triangle",
            blocks: [
              {
                type: "table",
                headers: ["HTTP", "Code", "Meaning", "Fix"],
                rows: [
                  [
                    "400",
                    "invalid_body",
                    "Not valid JSON",
                    "Check body format",
                  ],
                  [
                    "400",
                    "missing_field",
                    "Required field missing",
                    "Add the field",
                  ],
                  [
                    "400",
                    "invalid_amount",
                    "Zero or negative",
                    "Positive kobo integer",
                  ],
                  [
                    "401",
                    "unauthorised",
                    "Invalid credentials",
                    "Check API key or JWT",
                  ],
                  [
                    "404",
                    "not_found",
                    "Resource doesn't exist",
                    "Check the ID",
                  ],
                  [
                    "409",
                    "email_taken",
                    "Customer already exists",
                    "Look up existing customer",
                  ],
                  [
                    "422",
                    "invalid_transition",
                    "State machine rejected",
                    "Check current state",
                  ],
                  [
                    "422",
                    "plan_inactive",
                    "Plan not accepting subs",
                    "Use active plan",
                  ],
                  [
                    "429",
                    "rate_limited",
                    "Too many requests",
                    "Back off until reset",
                  ],
                  [
                    "500",
                    "internal_error",
                    "Server error",
                    "Retry with backoff",
                  ],
                ],
              },
            ],
          },
          {
            id: "idempotency",
            label: "Idempotency",
            icon: "ti-copy-check",
            blocks: [
              {
                type: "p",
                text: "Always pass an idempotency_key when creating subscriptions. If your server retries due to a network timeout, the same key returns the original subscription instead of creating a duplicate.",
              },
              { type: "h2", text: "Good key patterns", id: "key-patterns" },
              {
                type: "list",
                items: [
                  "`signup_{user_id}`  user 12345 signing up",
                  "`signup_{user_id}_{plan_id}`  same user, specific plan",
                  "`upgrade_{subscription_id}_{new_plan_id}`  plan upgrade",
                ],
              },
              {
                type: "callout",
                variant: "success",
                text: "Nigerian mobile networks drop connections regularly. Idempotency keys on subscription creation ensure a timeout followed by a retry never results in double billing.",
              },
            ],
          },
          {
            id: "ratelimits",
            label: "Rate limits",
            icon: "ti-gauge",
            blocks: [
              {
                type: "table",
                headers: ["Auth type", "Limit"],
                rows: [
                  ["No auth (global IP)", "100 requests/minute per IP"],
                  ["JWT (Dashboard API)", "300 requests/minute per tenant"],
                  ["API key (Platform API)", "600 requests/minute per tenant"],
                ],
              },
              { type: "h2", text: "Rate limit headers", id: "headers" },
              {
                type: "code",
                lang: "bash",
                code: `X-Ratelimit-Limit: 300
X-Ratelimit-Remaining: 247
X-Ratelimit-Reset: 1782428400`,
              },
              {
                type: "p",
                text: "When you exceed the limit you receive 429 rate_limited. Wait until X-Ratelimit-Reset before retrying.",
              },
            ],
          },
        ],
      },
    ],
  },
  // ═══════════════════════════════════════════════════════════
  // TAB 4  CHANGELOG
  // ═══════════════════════════════════════════════════════════
  {
    id: "changelog",
    label: "Changelog",
    groups: [
      {
        group: "Releases",
        items: [
          {
            id: "changelog",
            label: "All releases",
            icon: "ti-history",
            blocks: [
              {
                type: "h2",
                text: "2026-07-05: Recovery ladder, team management, test mode, promo codes",
                id: "v1-6",
              },
              {
                type: "list",
                items: [
                  "Recovery ladder: failed payments escalate from card retry, to direct debit mandate (if one exists), to a manual pay link with a payment.action_required webhook",
                  "Recovery Command Center: GET /v1/finance/recovery-center shows at risk, recovering, and recovered subscriptions in one call, with retry-now and send-pay-link operator actions",
                  "Team management: members table with roles (owner, admin, developer, viewer), email invite flow with a 72-hour token, accept-invite page, audit log on every admin action",
                  "Test and live API key mode: a tori_test_ key routes Platform API traffic to Nomba sandbox, a tori_live_ key routes to Nomba production, chosen automatically by key prefix",
                  "Subscription transition audit trail: every state change is recorded with from_status, to_status, reason, actor, and a timestamp. New GET /v1/subscriptions/{id}/transitions endpoint",
                  "Security page with real active session tracking: session ID embedded in the JWT, Redis-backed session records with IP and user agent, instant revocation on any session including the one you are using right now",
                  "GET /v1/auth/sessions and DELETE /v1/auth/sessions/{id}. Two-factor authentication and passkeys are honest 'coming soon' placeholders, not fake flows",
                  "Promo codes: percentage or fixed discounts, plan-specific codes, use limits, expiry dates. Optional promo_code field on POST /v1/platform/checkout applies the discount and returns discount_kobo, original_amount_kobo, and final_amount_kobo",
                  "respond.InternalError now logs the underlying error and request ID via zerolog before returning the generic 500. Previously a 500 left no trace in the logs",
                  "Bug fix: customer portal cancel now uses cancel-at-period-end instead of an immediate cancel, matching how the dashboard cancel endpoint already worked",
                ],
              },
              {
                type: "h2",
                text: "2026-07-02 — Billing correctness and operator tools",
                id: "v1-5",
              },
              {
                type: "list",
                items: [
                  "Cancel at period end — customer cancellation keeps access until current_period_end, no immediate revoke",
                  "cancel_at_period_end job scheduled at period end to complete cancellation",
                  "Dunning retry skipped when cancel_at_period_end is set — no charge on cancelling subscription",
                  "Grace retry skipped when cancel_at_period_end is set",
                  "Manual recovery endpoint — POST /v1/subscriptions/{id}/recover moves SUSPENDED to ACTIVE",
                  "Recover button for SUSPENDED subscriptions in dashboard",
                  "Period advancement now uses plan interval — annual plans advance 1 year, custom uses interval_count days",
                  "retry_failed_payment job enqueued when subscription enters PAST_DUE from payment_failed webhook or abandoned checkout",
                  "Delivery log shows full timestamp with time not just date",
                  "Subscriptions page shows Cancels [date] badge when cancel_at_period_end is true",
                  "Cancel button hidden when cancellation already scheduled",
                  "Cursor pointer and hover effect on all subscription action buttons",
                  "GET /v1/nomba/webhook endpoint added for Nomba URL verification probe",
                  "Production proof — real Verve card charged, real Nomba webhook fired and processed end to end",
                  "Trial verification charge reduced from ₦50 to ₦1 — non-refundable, tokenises card since Nomba refund API does not support card transactions",
                  "Bank transfer payments now activate subscription instead of leaving customer stuck in PENDING_PAYMENT",
                  "Payment methods documented — card auto-renews, transfer requires re-payment at renewal via dunning flow",
                ],
              },
              {
                type: "h2",
                text: "2026-07-01 | Live production integration",
                id: "v1-4",
              },
              {
                type: "list",
                items: [
                  "Live Nomba production webhook delivery confirmed — real payment_success events firing",
                  "Real Verve card charged ₦100 end-to-end in production environment",
                  "GET /v1/nomba/webhook endpoint added for Nomba URL verification probe",
                  "PENDING_PAYMENT abandoned checkout window tightened to 1 hour from 24 hours",
                  "Period start now set to payment confirmation time, not checkout creation time",
                  "retry_failed_payment job enqueued when subscription enters PAST_DUE via webhook or abandoned checkout",
                  "Cancel at period end — customer cancellation keeps access until current_period_end",
                  "cancel_at_period_end job scheduled at current_period_end to complete cancellation",
                  "Billing health reason fixed — ACTIVE subscriptions show payment confirmed not unproven",
                  "Invoice modal with full details, PDF download via jsPDF, print support",
                  "Webhook retry now actually re-enqueues webhook_deliver job via dispatcher",
                  "Delivery log shows full timestamp with time not just date",
                  "Plan deactivation — confirm dialog, INACTIVE badge, greyed out card",
                  "Dunning config — PATCH /v1/dunning-config endpoint, settings page reads and saves live config",
                ],
              },
              {
                type: "h2",
                text: "2026-06-30 | PENDING_PAYMENT state and refund system",
                id: "v1-2",
              },
              {
                type: "list",
                items: [
                  "PENDING_PAYMENT subscription state — subscriptions start pending, activate only after payment_success webhook",
                  "Nomba webhook activates subscription, creates invoice, records ledger CHARGE entry",
                  "payment_failed webhook moves PENDING_PAYMENT to PAST_DUE",
                  "Abandoned checkout job — PENDING_PAYMENT subs with no tokenKey after 24 hours moved to PAST_DUE",
                  "POST /v1/checkout/refund — correct Nomba endpoint with transactionId from invoice",
                  "Trial verification charge reduced to ₦1 — non-refundable, tokenises card for recurring billing",
                  "Manual refund endpoint — REFUND CREDIT recorded in ledger",
                  "Nomba Success field handled as both bool and string",
                  "parseDateRange fixed — to date uses end of day so same-day entries included",
                  "subscription.activated and payment.succeeded webhooks dispatched after activation",
                  "PENDING_PAYMENT status pill and filter tab in subscriptions dashboard",
                  "Security hardening — CORS allowlist, HSTS, X-Frame-Options, PII masking in logs",
                  "9-state state machine unit tests updated — all transitions tested",
                ],
              },
              {
                type: "h2",
                text: "2026-06-30 | Nomba integration and ClassPay demo",
                id: "v1-1",
              },
              {
                type: "list",
                items: [
                  "Real Nomba HTTP client — OAuth2 with token caching, auto-refresh 5 minutes before expiry",
                  "POST /v1/checkout/order with tokenizeCard: true for all new subscriptions",
                  "POST /v1/checkout/tokenized-card-payment for all renewals and dunning retries",
                  "Inbound payment_success webhook — HMAC-SHA256 verification, Redis requestId dedup",
                  "tokenKey stored on subscription for recurring billing",
                  "Trial plans — ₦1 verification charge, tokenises card for recurring billing",
                  "Nightly reconciliation — Nomba transactions vs ledger, discrepancy detection, pagination loop protection",
                  "HMAC-SHA256 signed outbound webhooks with retry schedule (5min, 30min, 2hr, 6hr) and circuit breaker",
                  "Webhook delivery log with manual retry from dashboard",
                  "ClassPay demo integration — school management SaaS showing full developer flow",
                  "ClassPay webhook handler with HMAC verification",
                  "Portal token generation for customer self-service",
                  "Nomba failure code classification — permanent vs retriable, loaded from YAML",
                  "Sandbox environment switching via NOMBA_ENV",
                  "Two-column Nomba-style API reference docs with method badges and response tabs",
                ],
              },
              {
                type: "h2",
                text: "2026-06-28 | Tenant onboarding and observability",
                id: "v1-3",
              },
              {
                type: "list",
                items: [
                  "Email verification via Resend — 6-digit crypto/rand code, 15-minute expiry, single-use",
                  "POST /v1/auth/verify-email and POST /v1/auth/resend-verification endpoints",
                  "Welcome email sent after successful verification",
                  "2-step signup flow with OTP page — auto-advance, auto-submit, paste support, 60-second resend cooldown",
                  "Dashboard verification banner — Verify now button redirects to OTP page",
                  "Login response includes email_verified flag",
                  "Max 5 webhook endpoints per tenant enforced",
                  "Request latency middleware — every request logged with method, path, status, latency",
                  "Enhanced GET /v1/status — database pool stats, goroutine count, heap memory, queue depth",
                  "GET /v1/metrics — subscription counts by state, MRR, charge success rate, failed jobs",
                  "5-goroutine concurrent worker pool via RunPool — parallel job processing",
                  "Async webhook delivery — webhook_deliver job type, sync fallback on enqueue failure",
                  "Seed script creates and verifies tenant if missing — judges skip OTP flow",
                  "Migration 000009 — email_verifications table, email_verified on tenants",
                  "Migration 000010 — PENDING_PAYMENT added to subscriptions status check constraint",
                ],
              },
              {
                type: "h2",
                text: "2026-06-26 | Public beta launch",
                id: "v1",
              },
              {
                type: "list",
                items: [
                  "Nine-state subscription lifecycle with pure state machine and full unit test coverage",
                  "GRACE_PERIOD state — 48-hour silent retry before dunning begins",
                  "Nigerian dunning engine with payday-aligned retry schedule: Day 3, 7, 14, 21",
                  "Append-only double-entry ledger with 7 entry types — CHARGE, REFUND, PRORATION, CREDIT, TRIAL_START, TRIAL_END, ADMIN_OVERRIDE",
                  "MRR, ARR, churn rate, dunning recovery, net revenue from real ledger aggregations",
                  "PostgreSQL SKIP LOCKED job queue — exactly-once processing, stale lock recovery",
                  "Background worker — expire trial, retry failed payment, grace retry, suspend subscription",
                  "Invoice generation on every successful charge and dunning recovery",
                  "Customer self-service portal — pause, resume, cancel via portal token",
                  "Proration on mid-cycle plan changes",
                  "Billing health scoring (0-100) with churn prediction and revenue forecasting",
                  "Argon2id passwords, SHA-256 hashed API keys, Redis token revocation",
                  "Brute force protection: 5 attempts, 15-minute lockout",
                  "Per-tenant rate limiting: 300 req/min JWT, 600 req/min API key",
                  "Full responsive dashboard — overview, subscriptions, billing health, customers, plans, invoices, finance, webhooks, API keys, settings, docs",
                  "Railway deployment — 3 services, PostgreSQL 17, Redis 7",
                ],
              },
              {
                type: "h2",
                text: "2026-06-19 | Project Architecture and initial commit",
                id: "v0",
              },
              {
                type: "list",
                items: [
                  "Project architecture designed — modular monolith in Go 1.26 with PostgreSQL and sqlc",
                  "Database schema — 11 tables with tenant_id isolation on every row",
                  "Domain models and repository interfaces defined",
                  "State machine skeleton — pure Transition function with zero side effects",
                  "JWT auth, API key auth, and portal token system",
                  "Chi v5 router with middleware chain — request ID, rate limiting, body size limit",
                  "sqlc code generation configured",
                  "Docker Compose setup — API, worker, PostgreSQL 17, Redis 7",
                  "Go module and project structure established",
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

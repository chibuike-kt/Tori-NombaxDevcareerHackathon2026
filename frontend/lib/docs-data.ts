export type Field = { name: string; type: string; required?: boolean; description: string };

export type EndpointBlock = {
  type: "endpoint";
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  description: string;
  auth?: "apiKeyAuth" | "bearerAuth" | "portalToken" | "none";
  headers?: Field[];
  query?: Field[];
  body?: Field[];
  examples: { curl: string; javascript: string; go?: string; python?: string };
  responses: Record<string, string>;
};

export type WebhookEventBlock = {
  type: "webhookEvent";
  event: string;
  firesWhen: string;
  description: string;
  payload: Field[];
  example: string;
};

export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id: string }
  | { type: "h3"; text: string }
  | { type: "code"; lang?: string; code: string }
  | { type: "callout"; variant?: "info" | "warn" | "success"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; items: string[] }
  | { type: "param"; name: string; paramType: string; required?: boolean; description: string }
  | { type: "response"; status: number; description: string; body?: string }
  | EndpointBlock
  | WebhookEventBlock;

export type Section = {
  id: string; label: string; icon: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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
              {
                type: "h2",
                text: "How it works, end to end",
                id: "how-it-works",
              },
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
            id: "idempotency",
            label: "Idempotency keys",
            icon: "ti-refresh-alert",
            blocks: [
              {
                type: "p",
                text: "Networks fail. A request can time out after Tori has already processed it  you retry, and without protection you get a second customer, a second subscription, a second charge. Idempotency keys make any mutating Platform API request safe to retry.",
              },
              { type: "h2", text: "Why it matters", id: "idem-why" },
              {
                type: "p",
                text: "If your server sends POST /v1/platform/checkout and the connection drops before the response arrives, you don't know if the subscription was created. Retrying blind risks a duplicate. An idempotency key turns that retry into a safe no-op: Tori recognises the key and hands back the exact original response instead of running the operation again.",
              },
              { type: "h2", text: "How to use it", id: "idem-how" },
              {
                type: "p",
                text: "Generate a unique key (a UUID is fine) per logical operation and send it as the Idempotency-Key header. Reuse the same key only when retrying the same attempt  a new checkout for the same customer later should get a new key.",
              },
              {
                type: "code",
                lang: "bash",
                code: `curl ${BASE}/v1/platform/checkout \\
  -H "X-API-Key: tori_live_..." \\
  -H "Idempotency-Key: 3f29a1d2-8b7e-4c31-9e0a-6d5c4b3a2f10" \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "amaka@startup.ng", "plan_id": "plan_..." }'`,
              },
              {
                type: "callout",
                variant: "info",
                text: "The response echoes the header back as Idempotency-Key. On a replay it also sets Idempotency-Replayed: true, so you can tell in logs whether the operation actually ran again.",
              },
              { type: "h2", text: "What happens on replay", id: "idem-replay" },
              {
                type: "p",
                text: "Send the same key again  same status code, same response body, no new subscription or customer created, no second charge. This holds however many times you retry, as long as the key matches and hasn't expired.",
              },
              {
                type: "callout",
                variant: "warn",
                text: "Only successful responses (2xx) are cached against a key. If your first attempt failed validation (a 400, for example), retrying with the same key after fixing the request runs the operation for real  a failed attempt never permanently blocks that key.",
              },
              { type: "h2", text: "When you don't need it", id: "idem-skip" },
              {
                type: "list",
                items: [
                  "GET requests are already safe to retry  they don't change anything, so the header is ignored on them",
                  "One-shot scripts or manual curl calls where a duplicate is not a real risk",
                  "Calls you already dedupe another way  checkout already accepts its own idempotency_key body field, scoped to subscription creation specifically",
                ],
              },
              { type: "h2", text: "Scoping and expiry", id: "idem-scope" },
              {
                type: "list",
                items: [
                  "Keys are scoped per tenant  the same key value used by two different tenants never collides",
                  "Keys expire 24 hours after first use. After that, the same key on a new request is treated as a fresh operation",
                  "Storing a key against the wrong request (a different path or body) is your risk to manage  Tori replays whatever response it stored for that key, so don't reuse one key across genuinely different operations",
                ],
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
      // ═══════════════════════════════════════════════════════
      // QUICKSTART
      // ═══════════════════════════════════════════════════════
      {
        group: "Quickstart",
        items: [
          {
            id: "quickstart",
            label: "Quickstart",
            icon: "ti-bolt",
            blocks: [
              {
                type: "p",
                text: "The whole integration is one call: create a checkout, get back a URL, redirect the customer. Tori tokenises the card on that first payment and charges it automatically on every renewal from then on — no cron job, no retry logic, on your end.",
              },
              {
                type: "code",
                lang: "bash",
                code: `curl -X POST https://api-production-3847.up.railway.app/v1/platform/checkout \\
  -H "X-API-Key: tori_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "amaka@school.ng",
    "plan_id": "4436225d-2eef-4d7b-9fbc-1b299c0d1cac",
    "external_id": "school_001",
    "callback_url": "https://yourapp.ng/payment/success"
  }'`,
              },
              {
                type: "p",
                text: "The response includes checkout_url. Redirect the customer there — even during a free trial, so the card gets tokenised immediately.",
              },
              {
                type: "code",
                lang: "json",
                code: `{
  "data": {
    "subscription": { "id": "f6ffcc85-...", "status": "PENDING_PAYMENT" },
    "checkout_url": "https://pay.nomba.com/checkout/abc123",
    "customer_created": true
  }
}`,
              },
              {
                type: "callout",
                variant: "success",
                text: "That's it. Register a webhook endpoint (Section 3 below) to find out when the payment clears, and you're done — Tori owns renewals, retries, and recovery from here.",
              },
            ],
          },
        ],
      },
      // ═══════════════════════════════════════════════════════
      // PLATFORM API
      // ═══════════════════════════════════════════════════════
      {
        group: "Platform API",
        items: [
          {
            id: "ref-oauth-token",
            label: "Get access token",
            icon: "ti-key",
            method: "POST",
            endpoint: "/v1/oauth/token",
            blocks: [
              {
                type: "endpoint",
                method: "POST",
                path: "/v1/oauth/token",
                summary: "Get an OAuth access token",
                description: "Exchanges OAuth client credentials for a short-lived bearer token. This is one of two ways to authenticate Platform API calls — the simpler alternative is passing your API key directly in an X-API-Key header on every request, no token exchange needed. Use OAuth if you'd rather rotate a short-lived token than hold a long-lived secret in every request; use X-API-Key if you want the simplest possible integration.",
                auth: "none",
                body: [
                  { name: "grant_type", type: "string", required: true, description: "Must be client_credentials" },
                  { name: "client_id", type: "string", required: true, description: "From POST /v1/oauth/clients in the dashboard" },
                  { name: "client_secret", type: "string", required: true, description: "Shown once, at client creation" },
                ],
                examples: {
                  curl: `curl -X POST https://api-production-3847.up.railway.app/v1/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "client_credentials",
    "client_id": "oauth_client_9913c788057e1c1f0310cd79",
    "client_secret": "oauth_secret_a8f1454315f7bf5f204a90ad7ffe694c"
  }'`,
                  javascript: `const res = await fetch('https://api-production-3847.up.railway.app/v1/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'client_credentials',
    client_id: process.env.TORI_CLIENT_ID,
    client_secret: process.env.TORI_CLIENT_SECRET,
  }),
});
const { data } = await res.json();
// data.access_token — use as: Authorization: Bearer <access_token>`,
                  go: `resp, err := http.Post(
  "https://api-production-3847.up.railway.app/v1/oauth/token",
  "application/json",
  strings.NewReader(\`{
    "grant_type": "client_credentials",
    "client_id": "oauth_client_...",
    "client_secret": "oauth_secret_..."
  }\`),
)`,
                  python: `import requests, os

res = requests.post(
  "https://api-production-3847.up.railway.app/v1/oauth/token",
  json={
    "grant_type": "client_credentials",
    "client_id": os.environ["TORI_CLIENT_ID"],
    "client_secret": os.environ["TORI_CLIENT_SECRET"],
  },
)`,
                },
                responses: {
                  "200": `{
  "data": {
    "access_token": "tori_oauth_a8f1454315f7bf5f204a90ad7ffe694c34ff1c382b66edf061a6b96027ab92cd",
    "token_type": "Bearer",
    "expires_in": 1800,
    "mode": "live"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "401": `{
  "error": { "code": "unauthorized", "message": "invalid client credentials" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
              {
                type: "callout",
                variant: "info",
                text: "Tokens expire after 30 minutes. Either header works on every Platform API call below — pick one and stick with it: Authorization: Bearer <access_token>, or X-API-Key: tori_live_....",
              },
            ],
          },
          {
            id: "ref-platform-checkout",
            label: "Start a subscription",
            icon: "ti-shopping-cart",
            method: "POST",
            endpoint: "/v1/platform/checkout",
            blocks: [
              {
                type: "endpoint",
                method: "POST",
                path: "/v1/platform/checkout",
                summary: "Start a subscription",
                description: "Creates a subscription and returns a Nomba checkout URL. Finds or creates the customer by email, starts the subscription, opens a Nomba checkout session with card tokenisation on, and returns the URL to redirect to — all in one call. Idempotent via idempotency_key, so a network retry on your side returns the original subscription instead of creating a duplicate.",
                auth: "apiKeyAuth",
                headers: [
                  { name: "X-API-Key", type: "string", required: true, description: "Your live or test API key" },
                ],
                body: [
                  { name: "email", type: "string", required: true, description: "Customer email address" },
                  { name: "plan_id", type: "uuid", required: true, description: "The plan to subscribe to" },
                  { name: "name", type: "string", required: false, description: "Customer name — used if creating a new customer" },
                  { name: "external_id", type: "string", required: false, description: "Your internal customer ID" },
                  { name: "idempotency_key", type: "string", required: false, description: "Prevents duplicate subscriptions on network retries" },
                  { name: "callback_url", type: "string", required: false, description: "URL to redirect after payment" },
                  { name: "promo_code", type: "string", required: false, description: "Promo code to apply a discount to the first charge" },
                  { name: "metadata", type: "object", required: false, description: "Arbitrary key-value pairs stored on the subscription" },
                ],
                examples: {
                  curl: `curl -X POST https://api-production-3847.up.railway.app/v1/platform/checkout \\
  -H "X-API-Key: tori_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "amaka@school.ng",
    "plan_id": "4436225d-2eef-4d7b-9fbc-1b299c0d1cac",
    "external_id": "school_001",
    "callback_url": "https://yourapp.ng/payment/success"
  }'`,
                  javascript: `const res = await fetch('https://api-production-3847.up.railway.app/v1/platform/checkout', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.TORI_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'amaka@school.ng',
    plan_id: '4436225d-2eef-4d7b-9fbc-1b299c0d1cac',
    external_id: 'school_001',
    callback_url: 'https://yourapp.ng/payment/success',
  }),
});
const { data } = await res.json();
window.location.href = data.checkout_url;`,
                  go: `resp, err := http.Post(
  "https://api-production-3847.up.railway.app/v1/platform/checkout",
  "application/json",
  strings.NewReader(\`{
    "email": "amaka@school.ng",
    "plan_id": "4436225d-2eef-4d7b-9fbc-1b299c0d1cac",
    "external_id": "school_001"
  }\`),
)`,
                  python: `import requests, os

res = requests.post(
  "https://api-production-3847.up.railway.app/v1/platform/checkout",
  headers={"X-API-Key": os.environ["TORI_API_KEY"]},
  json={
    "email": "amaka@school.ng",
    "plan_id": "4436225d-2eef-4d7b-9fbc-1b299c0d1cac",
    "external_id": "school_001",
  },
)`,
                },
                responses: {
                  "201": `{
  "data": {
    "subscription": {
      "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
      "status": "PENDING_PAYMENT",
      "plan_name": "Basic Monthly",
      "plan_amount": 250000
    },
    "checkout_url": "https://pay.nomba.com/checkout/abc123",
    "tori_checkout_url": "https://frontend-production-e3be.up.railway.app/checkout/abc123",
    "customer_created": true,
    "promo_applied": false
  },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "400": `{
  "error": { "code": "missing_field", "message": "plan_id is required" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "401": `{
  "error": { "code": "unauthorized", "message": "invalid or missing API key" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "422": `{
  "error": { "code": "plan_inactive", "message": "this plan is no longer accepting new subscriptions" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
              {
                type: "callout",
                variant: "warn",
                text: "Always redirect the customer to checkout_url immediately — even during a free trial. This tokenises the card now so Tori can charge automatically at trial end.",
              },
            ],
          },
          {
            id: "ref-platform-subs-get",
            label: "Get subscription",
            icon: "ti-refresh",
            method: "GET",
            endpoint: "/v1/platform/subscriptions/{id}",
            blocks: [
              {
                type: "endpoint",
                method: "GET",
                path: "/v1/platform/subscriptions/{id}",
                summary: "Get subscription status",
                description: "Fetch a single subscription by ID — plan_name and plan_amount are denormalised onto the response so you don't need a second call to look up the plan.",
                auth: "apiKeyAuth",
                headers: [
                  { name: "X-API-Key", type: "string", required: true, description: "Your live or test API key" },
                ],
                examples: {
                  curl: `curl https://api-production-3847.up.railway.app/v1/platform/subscriptions/f6ffcc85-1642-46ef-9624-32fe545ea947 \\
  -H "X-API-Key: tori_live_..."`,
                  javascript: `const res = await fetch(
  \`https://api-production-3847.up.railway.app/v1/platform/subscriptions/\${subscriptionId}\`,
  { headers: { 'X-API-Key': process.env.TORI_API_KEY } },
);
const { data } = await res.json();`,
                  go: `req, _ := http.NewRequest("GET",
  "https://api-production-3847.up.railway.app/v1/platform/subscriptions/"+subscriptionID, nil)
req.Header.Set("X-API-Key", apiKey)
resp, err := http.DefaultClient.Do(req)`,
                  python: `res = requests.get(
  f"https://api-production-3847.up.railway.app/v1/platform/subscriptions/{subscription_id}",
  headers={"X-API-Key": os.environ["TORI_API_KEY"]},
)`,
                },
                responses: {
                  "200": `{
  "data": {
    "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
    "customer_id": "2c8e91c2-e848-43d2-888c-b680c6909453",
    "plan_id": "4436225d-2eef-4d7b-9fbc-1b299c0d1cac",
    "plan_name": "Basic Monthly",
    "plan_amount": 250000,
    "status": "DUNNING",
    "current_period_start": "2026-06-26T00:00:00Z",
    "current_period_end": "2026-07-26T00:00:00Z",
    "trial_end": null,
    "dunning_attempt": 2,
    "next_retry_at": "2026-07-03T00:00:00Z",
    "cancel_at_period_end": false,
    "recovery_rail": "card"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "401": `{
  "error": { "code": "unauthorized", "message": "invalid or missing API key" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "404": `{
  "error": { "code": "not_found", "message": "the requested resource does not exist" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
            ],
          },
          {
            id: "ref-platform-subs-list",
            label: "List subscriptions",
            icon: "ti-list",
            method: "GET",
            endpoint: "/v1/platform/subscriptions",
            blocks: [
              {
                type: "endpoint",
                method: "GET",
                path: "/v1/platform/subscriptions",
                summary: "List subscriptions",
                description: "Returns every subscription for your account, newest first. Filter by status to find everything in a specific billing state.",
                auth: "apiKeyAuth",
                headers: [
                  { name: "X-API-Key", type: "string", required: true, description: "Your live or test API key" },
                ],
                query: [
                  { name: "status", type: "string", required: false, description: "TRIALING | ACTIVE | GRACE_PERIOD | PAST_DUE | DUNNING | PAUSED | SUSPENDED | CANCELLED" },
                  { name: "limit", type: "integer", required: false, description: "Max results. Default 20" },
                  { name: "offset", type: "integer", required: false, description: "Results to skip. Default 0" },
                ],
                examples: {
                  curl: `curl "https://api-production-3847.up.railway.app/v1/platform/subscriptions?status=ACTIVE&limit=20" \\
  -H "X-API-Key: tori_live_..."`,
                  javascript: `const res = await fetch(
  'https://api-production-3847.up.railway.app/v1/platform/subscriptions?status=ACTIVE',
  { headers: { 'X-API-Key': process.env.TORI_API_KEY } },
);
const { data } = await res.json();`,
                  go: `req, _ := http.NewRequest("GET",
  "https://api-production-3847.up.railway.app/v1/platform/subscriptions?status=ACTIVE", nil)
req.Header.Set("X-API-Key", apiKey)`,
                  python: `res = requests.get(
  "https://api-production-3847.up.railway.app/v1/platform/subscriptions",
  headers={"X-API-Key": os.environ["TORI_API_KEY"]},
  params={"status": "ACTIVE"},
)`,
                },
                responses: {
                  "200": `{
  "data": [
    {
      "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
      "customer_id": "2c8e91c2-...",
      "plan_name": "Basic Monthly",
      "plan_amount": 250000,
      "status": "ACTIVE",
      "current_period_end": "2026-07-26T00:00:00Z",
      "cancel_at_period_end": false
    }
  ],
  "pagination": { "has_more": false, "total": 1 },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "401": `{
  "error": { "code": "unauthorized", "message": "invalid or missing API key" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
            ],
          },
          {
            id: "ref-platform-subs-cancel",
            label: "Cancel subscription",
            icon: "ti-x",
            method: "POST",
            endpoint: "/v1/platform/subscriptions/{id}/cancel",
            blocks: [
              {
                type: "endpoint",
                method: "POST",
                path: "/v1/platform/subscriptions/{id}/cancel",
                summary: "Cancel a subscription",
                description: "Cancels a subscription. Defaults to end-of-period — access continues until current_period_end. Pass immediate: true to cancel right now instead.",
                auth: "apiKeyAuth",
                headers: [
                  { name: "X-API-Key", type: "string", required: true, description: "Your live or test API key" },
                ],
                body: [
                  { name: "immediate", type: "boolean", required: false, description: "Cancel right now instead of at period end. Defaults to false" },
                ],
                examples: {
                  curl: `curl -X POST https://api-production-3847.up.railway.app/v1/platform/subscriptions/f6ffcc85-.../cancel \\
  -H "X-API-Key: tori_live_..."`,
                  javascript: `const res = await fetch(
  \`https://api-production-3847.up.railway.app/v1/platform/subscriptions/\${subscriptionId}/cancel\`,
  { method: 'POST', headers: { 'X-API-Key': process.env.TORI_API_KEY } },
);`,
                  go: `req, _ := http.NewRequest("POST",
  "https://api-production-3847.up.railway.app/v1/platform/subscriptions/"+subscriptionID+"/cancel", nil)
req.Header.Set("X-API-Key", apiKey)`,
                  python: `res = requests.post(
  f"https://api-production-3847.up.railway.app/v1/platform/subscriptions/{subscription_id}/cancel",
  headers={"X-API-Key": os.environ["TORI_API_KEY"]},
)`,
                },
                responses: {
                  "200": `{
  "data": { "id": "f6ffcc85-...", "status": "ACTIVE", "cancel_at_period_end": true },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "401": `{
  "error": { "code": "unauthorized", "message": "invalid or missing API key" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "404": `{
  "error": { "code": "not_found", "message": "the requested resource does not exist" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
            ],
          },
          {
            id: "ref-platform-customers-get",
            label: "Get customer",
            icon: "ti-user",
            method: "GET",
            endpoint: "/v1/platform/customers/{id}",
            blocks: [
              {
                type: "endpoint",
                method: "GET",
                path: "/v1/platform/customers/{id}",
                summary: "Get a customer",
                description: "Fetch a single customer by their Tori ID.",
                auth: "apiKeyAuth",
                headers: [
                  { name: "X-API-Key", type: "string", required: true, description: "Your live or test API key" },
                ],
                examples: {
                  curl: `curl https://api-production-3847.up.railway.app/v1/platform/customers/2c8e91c2-e848-43d2-888c-b680c6909453 \\
  -H "X-API-Key: tori_live_..."`,
                  javascript: `const res = await fetch(
  \`https://api-production-3847.up.railway.app/v1/platform/customers/\${customerId}\`,
  { headers: { 'X-API-Key': process.env.TORI_API_KEY } },
);
const { data } = await res.json();`,
                  go: `req, _ := http.NewRequest("GET",
  "https://api-production-3847.up.railway.app/v1/platform/customers/"+customerID, nil)
req.Header.Set("X-API-Key", apiKey)`,
                  python: `res = requests.get(
  f"https://api-production-3847.up.railway.app/v1/platform/customers/{customer_id}",
  headers={"X-API-Key": os.environ["TORI_API_KEY"]},
)`,
                },
                responses: {
                  "200": `{
  "data": {
    "id": "2c8e91c2-e848-43d2-888c-b680c6909453",
    "email": "amaka@school.ng",
    "name": "Amaka Obi",
    "external_id": "school_001",
    "created_at": "2026-06-26T00:00:00Z"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "401": `{
  "error": { "code": "unauthorized", "message": "invalid or missing API key" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "404": `{
  "error": { "code": "not_found", "message": "the requested resource does not exist" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
            ],
          },
          {
            id: "ref-platform-customers-list",
            label: "List customers",
            icon: "ti-users",
            method: "GET",
            endpoint: "/v1/platform/customers",
            blocks: [
              {
                type: "endpoint",
                method: "GET",
                path: "/v1/platform/customers",
                summary: "List customers",
                description: "Returns every customer for your account, newest first.",
                auth: "apiKeyAuth",
                headers: [
                  { name: "X-API-Key", type: "string", required: true, description: "Your live or test API key" },
                ],
                query: [
                  { name: "limit", type: "integer", required: false, description: "Max results per page. Default 50, max 100" },
                  { name: "offset", type: "integer", required: false, description: "Results to skip. Default 0" },
                  { name: "external_id", type: "string", required: false, description: "Filter by your own user ID" },
                ],
                examples: {
                  curl: `curl "https://api-production-3847.up.railway.app/v1/platform/customers?limit=50" \\
  -H "X-API-Key: tori_live_..."`,
                  javascript: `const res = await fetch(
  'https://api-production-3847.up.railway.app/v1/platform/customers?limit=50',
  { headers: { 'X-API-Key': process.env.TORI_API_KEY } },
);
const { data } = await res.json();`,
                  go: `req, _ := http.NewRequest("GET",
  "https://api-production-3847.up.railway.app/v1/platform/customers?limit=50", nil)
req.Header.Set("X-API-Key", apiKey)`,
                  python: `res = requests.get(
  "https://api-production-3847.up.railway.app/v1/platform/customers",
  headers={"X-API-Key": os.environ["TORI_API_KEY"]},
  params={"limit": 50},
)`,
                },
                responses: {
                  "200": `{
  "data": [
    { "id": "2c8e91c2-...", "email": "amaka@school.ng", "name": "Amaka Obi", "external_id": "school_001", "created_at": "2026-06-26T00:00:00Z" }
  ],
  "pagination": { "has_more": false, "total": 1 },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "401": `{
  "error": { "code": "unauthorized", "message": "invalid or missing API key" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
            ],
          },
          {
            id: "ref-platform-portal-token",
            label: "Generate portal token",
            icon: "ti-user-circle",
            method: "GET",
            endpoint: "/v1/platform/customers/{id}/portal-token",
            blocks: [
              {
                type: "endpoint",
                method: "GET",
                path: "/v1/platform/customers/{id}/portal-token",
                summary: "Generate a customer portal token",
                description: "Issues a one-hour scoped JWT that lets this specific customer view, pause, resume, or cancel their own subscription through /v1/portal/* — without a support ticket and without you building any of that UI yourself. Alternative to the OTP login flow in Section 4, for when you already have the customer logged into your own product and just want to embed the portal.",
                auth: "apiKeyAuth",
                headers: [
                  { name: "X-API-Key", type: "string", required: true, description: "Your live or test API key" },
                ],
                examples: {
                  curl: `curl https://api-production-3847.up.railway.app/v1/platform/customers/2c8e91c2-.../portal-token \\
  -H "X-API-Key: tori_live_..."`,
                  javascript: `const res = await fetch(
  \`https://api-production-3847.up.railway.app/v1/platform/customers/\${customerId}/portal-token\`,
  { headers: { 'X-API-Key': process.env.TORI_API_KEY } },
);
const { data } = await res.json();
// redirect to: https://yourapp.ng/billing?token=\${data.token}`,
                  go: `req, _ := http.NewRequest("GET",
  "https://api-production-3847.up.railway.app/v1/platform/customers/"+customerID+"/portal-token", nil)
req.Header.Set("X-API-Key", apiKey)`,
                  python: `res = requests.get(
  f"https://api-production-3847.up.railway.app/v1/platform/customers/{customer_id}/portal-token",
  headers={"X-API-Key": os.environ["TORI_API_KEY"]},
)`,
                },
                responses: {
                  "200": `{
  "data": { "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "expires_in": "3600" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "401": `{
  "error": { "code": "unauthorized", "message": "invalid or missing API key" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
              {
                type: "callout",
                variant: "warn",
                text: "Portal tokens expire after 1 hour. Generate a fresh one each time the customer visits your billing page — never store or reuse them.",
              },
            ],
          },
          {
            id: "ref-platform-plans-list",
            label: "List plans",
            icon: "ti-list",
            method: "GET",
            endpoint: "/v1/platform/plans",
            blocks: [
              {
                type: "endpoint",
                method: "GET",
                path: "/v1/platform/plans",
                summary: "List your plans",
                description: "Returns every pricing plan on your account. Create plans from the dashboard — plans are reusable, so you'll typically call this to populate a pricing page rather than creating them from your integration.",
                auth: "apiKeyAuth",
                headers: [
                  { name: "X-API-Key", type: "string", required: true, description: "Your live or test API key" },
                ],
                examples: {
                  curl: `curl https://api-production-3847.up.railway.app/v1/platform/plans \\
  -H "X-API-Key: tori_live_..."`,
                  javascript: `const res = await fetch('https://api-production-3847.up.railway.app/v1/platform/plans', {
  headers: { 'X-API-Key': process.env.TORI_API_KEY },
});
const { data } = await res.json();`,
                  go: `req, _ := http.NewRequest("GET",
  "https://api-production-3847.up.railway.app/v1/platform/plans", nil)
req.Header.Set("X-API-Key", apiKey)`,
                  python: `res = requests.get(
  "https://api-production-3847.up.railway.app/v1/platform/plans",
  headers={"X-API-Key": os.environ["TORI_API_KEY"]},
)`,
                },
                responses: {
                  "200": `{
  "data": [
    {
      "id": "4436225d-2eef-4d7b-9fbc-1b299c0d1cac",
      "name": "Basic Monthly",
      "amount": 250000,
      "currency": "NGN",
      "interval": "monthly",
      "trial_period_days": 0,
      "is_active": true
    }
  ],
  "pagination": { "has_more": false, "total": 1 },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "401": `{
  "error": { "code": "unauthorized", "message": "invalid or missing API key" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
            ],
          },
          {
            id: "ref-platform-plans-get",
            label: "Get a plan",
            icon: "ti-file-text",
            method: "GET",
            endpoint: "/v1/platform/plans/{id}",
            blocks: [
              {
                type: "endpoint",
                method: "GET",
                path: "/v1/platform/plans/{id}",
                summary: "Get a plan",
                description: "Fetch a single pricing plan by ID.",
                auth: "apiKeyAuth",
                headers: [
                  { name: "X-API-Key", type: "string", required: true, description: "Your live or test API key" },
                ],
                examples: {
                  curl: `curl https://api-production-3847.up.railway.app/v1/platform/plans/4436225d-2eef-4d7b-9fbc-1b299c0d1cac \\
  -H "X-API-Key: tori_live_..."`,
                  javascript: `const res = await fetch(
  \`https://api-production-3847.up.railway.app/v1/platform/plans/\${planId}\`,
  { headers: { 'X-API-Key': process.env.TORI_API_KEY } },
);
const { data } = await res.json();`,
                  go: `req, _ := http.NewRequest("GET",
  "https://api-production-3847.up.railway.app/v1/platform/plans/"+planID, nil)
req.Header.Set("X-API-Key", apiKey)`,
                  python: `res = requests.get(
  f"https://api-production-3847.up.railway.app/v1/platform/plans/{plan_id}",
  headers={"X-API-Key": os.environ["TORI_API_KEY"]},
)`,
                },
                responses: {
                  "200": `{
  "data": {
    "id": "4436225d-2eef-4d7b-9fbc-1b299c0d1cac",
    "name": "Basic Monthly",
    "amount": 250000,
    "currency": "NGN",
    "interval": "monthly",
    "trial_period_days": 0,
    "is_active": true
  },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "404": `{
  "error": { "code": "not_found", "message": "the requested resource does not exist" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
            ],
          },
          {
            id: "ref-platform-payment-link-checkout",
            label: "Collect a one-time payment",
            icon: "ti-link",
            method: "POST",
            endpoint: "/v1/platform/payment-links/{id}/checkout",
            blocks: [
              {
                type: "endpoint",
                method: "POST",
                path: "/v1/platform/payment-links/{id}/checkout",
                summary: "Collect a one-time payment via a payment link",
                description: "Starts a Nomba checkout for a payment link you created in the dashboard — no subscription or plan involved. Same shape as the subscription checkout above: get back a checkout_url, redirect the customer there. Payment links can also be shared as bare, unauthenticated URLs — see the Payment Links section in the docs for the public /v1/payment-links/{id}/pay endpoint, which needs no API key at all.",
                auth: "apiKeyAuth",
                headers: [
                  { name: "X-API-Key", type: "string", required: true, description: "Your live or test API key" },
                ],
                body: [
                  { name: "email", type: "string", required: false, description: "Customer email, prefilled on the Nomba checkout" },
                ],
                examples: {
                  curl: `curl -X POST https://api-production-3847.up.railway.app/v1/platform/payment-links/7ca2eaf5-.../checkout \\
  -H "X-API-Key: tori_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "amaka@school.ng" }'`,
                  javascript: `const res = await fetch(
  \`https://api-production-3847.up.railway.app/v1/platform/payment-links/\${linkId}/checkout\`,
  {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.TORI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: 'amaka@school.ng' }),
  },
);
const { data } = await res.json();
window.location.href = data.checkout_url;`,
                  go: `resp, err := http.Post(
  "https://api-production-3847.up.railway.app/v1/platform/payment-links/"+linkID+"/checkout",
  "application/json",
  strings.NewReader(\`{"email": "amaka@school.ng"}\`),
)`,
                  python: `res = requests.post(
  f"https://api-production-3847.up.railway.app/v1/platform/payment-links/{link_id}/checkout",
  headers={"X-API-Key": os.environ["TORI_API_KEY"]},
  json={"email": "amaka@school.ng"},
)`,
                },
                responses: {
                  "201": `{
  "data": {
    "checkout_url": "https://pay.nomba.com/sandbox/QMoj...",
    "tori_checkout_url": "https://frontend-production-e3be.up.railway.app/checkout/QMoj...",
    "reference": "pl_7ca2eaf5-a4cb-4852-8d7a-f389de2ef1d0_19ffb1f0656737ba",
    "title": "ClassPay Setup Fee",
    "amount_kobo": 500000,
    "merchant_name": "ClassPay"
  },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "401": `{
  "error": { "code": "unauthorized", "message": "invalid or missing API key" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "422": `{
  "error": { "code": "link_inactive", "message": "this payment link is no longer active" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
            ],
          },
        ],
      },
      // ═══════════════════════════════════════════════════════
      // WEBHOOKS
      // ═══════════════════════════════════════════════════════
      {
        group: "Webhooks",
        items: [
          {
            id: "webhooks-overview",
            label: "Overview & signature",
            icon: "ti-webhook",
            blocks: [
              {
                type: "p",
                text: "Register a URL in the dashboard (Webhooks → Add endpoint) and Tori POSTs a JSON payload to it for every billing event below. The payload shape is always the same envelope: an event_type string and a data object whose contents depend on the event.",
              },
              {
                type: "code",
                lang: "json",
                code: `{
  "event_type": "subscription.activated",
  "data": { "...": "..." }
}`,
              },
              { type: "h2", text: "Verify the signature", id: "webhook-sig" },
              {
                type: "p",
                text: "Every request carries an X-Tori-Signature header — HMAC-SHA256 over the raw request body, using the signing secret shown once when you registered the endpoint. Verify it before trusting the payload, using a timing-safe comparison, not ==.",
              },
              {
                type: "code",
                lang: "javascript",
                code: `app.post('/webhooks/tori', (req, res) => {
  const sig = req.headers['x-tori-signature'];
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.TORI_WEBHOOK_SECRET)
    .update(req.body) // raw body, not the parsed object
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    return res.status(401).send('Invalid signature');
  }

  const { event_type, data } = JSON.parse(req.body);
  // ... handle event_type
  res.status(200).send('ok'); // always 200 immediately, handle async
});`,
              },
              {
                type: "callout",
                variant: "warn",
                text: "Return 200 immediately, before doing any slow work. Tori retries failed deliveries at 5 minutes, 30 minutes, 2 hours, and 6 hours — after 10 consecutive failures in 24 hours the endpoint is auto-disabled, so a slow handler that times out looks identical to a dead one.",
              },
            ],
          },
          {
            id: "webhook-subscription-activated",
            label: "subscription.activated",
            icon: "ti-circle-check",
            blocks: [
              {
                type: "webhookEvent",
                event: "subscription.activated",
                firesWhen: "Trial ends and the first charge succeeds, or a no-trial checkout completes",
                description: "The customer has paid. Grant access now.",
                payload: [
                  { name: "id", type: "uuid", description: "Subscription ID" },
                  { name: "customer_id", type: "uuid", description: "The customer this subscription belongs to" },
                  { name: "plan_id", type: "uuid", description: "The plan being billed" },
                  { name: "status", type: "string", description: "Always ACTIVE for this event" },
                  { name: "current_period_start", type: "string", description: "ISO-8601 timestamp" },
                  { name: "current_period_end", type: "string", description: "ISO-8601 timestamp — when the next charge is due" },
                ],
                example: `{
  "event_type": "subscription.activated",
  "data": {
    "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
    "customer_id": "2c8e91c2-e848-43d2-888c-b680c6909453",
    "plan_id": "4436225d-2eef-4d7b-9fbc-1b299c0d1cac",
    "status": "ACTIVE",
    "current_period_start": "2026-07-08T00:00:00Z",
    "current_period_end": "2026-08-08T00:00:00Z"
  }
}`,
              },
            ],
          },
          {
            id: "webhook-payment-succeeded",
            label: "payment.succeeded",
            icon: "ti-cash",
            blocks: [
              {
                type: "webhookEvent",
                event: "payment.succeeded",
                firesWhen: "Any charge clears — a normal renewal, or a dunning recovery",
                description: "A renewal charge succeeded. Nothing for you to do beyond your own bookkeeping — access was already granted at subscription.activated and stays on.",
                payload: [
                  { name: "id", type: "uuid", description: "Subscription ID" },
                  { name: "customer_id", type: "uuid", description: "The customer that was charged" },
                  { name: "status", type: "string", description: "ACTIVE" },
                  { name: "current_period_end", type: "string", description: "The new period end after this charge" },
                ],
                example: `{
  "event_type": "payment.succeeded",
  "data": {
    "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
    "customer_id": "2c8e91c2-e848-43d2-888c-b680c6909453",
    "status": "ACTIVE",
    "current_period_end": "2026-09-08T00:00:00Z"
  }
}`,
              },
            ],
          },
          {
            id: "webhook-payment-failed",
            label: "payment.failed",
            icon: "ti-alert-circle",
            blocks: [
              {
                type: "webhookEvent",
                event: "payment.failed",
                firesWhen: "A charge attempt fails — first failure, or any retry",
                description: "A charge failed. Access should stay on for now — the first failure enters a silent 48-hour grace retry, so don't restrict access on the first payment.failed alone. Watch for dunning.exhausted to know when recovery has genuinely run out.",
                payload: [
                  { name: "id", type: "uuid", description: "Subscription ID" },
                  { name: "customer_id", type: "uuid", description: "The customer whose charge failed" },
                  { name: "status", type: "string", description: "GRACE_PERIOD, PAST_DUE, or DUNNING depending on attempt count" },
                  { name: "dunning_attempt", type: "integer", description: "How many retries have been attempted so far" },
                ],
                example: `{
  "event_type": "payment.failed",
  "data": {
    "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
    "customer_id": "2c8e91c2-e848-43d2-888c-b680c6909453",
    "status": "DUNNING",
    "dunning_attempt": 1
  }
}`,
              },
            ],
          },
          {
            id: "webhook-dunning-started",
            label: "dunning.started",
            icon: "ti-refresh-alert",
            blocks: [
              {
                type: "webhookEvent",
                event: "dunning.started",
                firesWhen: "The first scheduled dunning retry fires, after the silent grace-period retry has also failed",
                description: "Retries are underway on the payday-aligned schedule (Day 3, 7, 14, 21). Good moment to show the customer a payment-failed banner in your own product, if you want to.",
                payload: [
                  { name: "id", type: "uuid", description: "Subscription ID" },
                  { name: "customer_id", type: "uuid", description: "The customer being retried" },
                  { name: "status", type: "string", description: "DUNNING" },
                  { name: "next_retry_at", type: "string", description: "ISO-8601 timestamp of the next scheduled attempt" },
                ],
                example: `{
  "event_type": "dunning.started",
  "data": {
    "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
    "customer_id": "2c8e91c2-e848-43d2-888c-b680c6909453",
    "status": "DUNNING",
    "next_retry_at": "2026-07-11T00:00:00Z"
  }
}`,
              },
            ],
          },
          {
            id: "webhook-dunning-recovered",
            label: "dunning.recovered",
            icon: "ti-heart",
            blocks: [
              {
                type: "webhookEvent",
                event: "dunning.recovered",
                firesWhen: "A retry succeeds after at least one prior failure",
                description: "The customer paid on a retry. Restore full access if you restricted it on an earlier payment.failed or dunning.started.",
                payload: [
                  { name: "id", type: "uuid", description: "Subscription ID" },
                  { name: "customer_id", type: "uuid", description: "The customer that recovered" },
                  { name: "status", type: "string", description: "ACTIVE" },
                  { name: "recovery_rail", type: "string", description: "Which rail recovered the charge — wallet, card, mandate, or manual" },
                ],
                example: `{
  "event_type": "dunning.recovered",
  "data": {
    "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
    "customer_id": "2c8e91c2-e848-43d2-888c-b680c6909453",
    "status": "ACTIVE",
    "recovery_rail": "card"
  }
}`,
              },
            ],
          },
          {
            id: "webhook-dunning-exhausted",
            label: "dunning.exhausted",
            icon: "ti-circle-x",
            blocks: [
              {
                type: "webhookEvent",
                event: "dunning.exhausted",
                firesWhen: "Every configured retry attempt has failed — the subscription moves to SUSPENDED",
                description: "Recovery has genuinely run out on every automatic rail. Revoke access now.",
                payload: [
                  { name: "id", type: "uuid", description: "Subscription ID" },
                  { name: "customer_id", type: "uuid", description: "The customer to revoke access for" },
                  { name: "status", type: "string", description: "SUSPENDED" },
                  { name: "dunning_attempt", type: "integer", description: "Total retries attempted before giving up" },
                ],
                example: `{
  "event_type": "dunning.exhausted",
  "data": {
    "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
    "customer_id": "2c8e91c2-e848-43d2-888c-b680c6909453",
    "status": "SUSPENDED",
    "dunning_attempt": 4
  }
}`,
              },
            ],
          },
          {
            id: "webhook-payment-action-required",
            label: "payment.action_required",
            icon: "ti-hand-click",
            blocks: [
              {
                type: "webhookEvent",
                event: "payment.action_required",
                firesWhen: "Recovery escalates to the manual pay-link rail — card and mandate retries are both exhausted",
                description: "Automatic recovery has stopped. Email or message the customer the included checkout_url directly, or surface it in your product — this is the last rail before dunning.exhausted.",
                payload: [
                  { name: "id", type: "uuid", description: "Subscription ID" },
                  { name: "customer_id", type: "uuid", description: "The customer who needs to pay manually" },
                  { name: "status", type: "string", description: "DUNNING, recovery_rail is manual" },
                  { name: "checkout_url", type: "string", description: "A fresh Nomba checkout link for the customer to pay directly" },
                ],
                example: `{
  "event_type": "payment.action_required",
  "data": {
    "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
    "customer_id": "2c8e91c2-e848-43d2-888c-b680c6909453",
    "status": "DUNNING",
    "recovery_rail": "manual",
    "checkout_url": "https://pay.nomba.com/checkout/xyz789"
  }
}`,
              },
            ],
          },
          {
            id: "webhook-subscription-cancelled",
            label: "subscription.cancelled",
            icon: "ti-ban",
            blocks: [
              {
                type: "webhookEvent",
                event: "subscription.cancelled",
                firesWhen: "A cancellation completes — either immediately, or when a deferred end-of-period cancellation reaches its period end",
                description: "Access should end now — for an end-of-period cancellation, this fires exactly when the paid-for period runs out, not when the customer clicked cancel.",
                payload: [
                  { name: "id", type: "uuid", description: "Subscription ID" },
                  { name: "customer_id", type: "uuid", description: "The customer to offboard" },
                  { name: "status", type: "string", description: "CANCELLED" },
                  { name: "cancelled_at", type: "string", description: "ISO-8601 timestamp of the actual cancellation" },
                ],
                example: `{
  "event_type": "subscription.cancelled",
  "data": {
    "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
    "customer_id": "2c8e91c2-e848-43d2-888c-b680c6909453",
    "status": "CANCELLED",
    "cancelled_at": "2026-08-08T00:00:00Z"
  }
}`,
              },
            ],
          },
          {
            id: "webhook-subscription-paused",
            label: "subscription.paused",
            icon: "ti-player-pause",
            blocks: [
              {
                type: "webhookEvent",
                event: "subscription.paused",
                firesWhen: "A customer or operator pauses a subscription",
                description: "Billing has stopped. Whether to restrict access while paused is your call — Tori doesn't take a position on it.",
                payload: [
                  { name: "id", type: "uuid", description: "Subscription ID" },
                  { name: "customer_id", type: "uuid", description: "The customer whose subscription paused" },
                  { name: "status", type: "string", description: "PAUSED" },
                ],
                example: `{
  "event_type": "subscription.paused",
  "data": {
    "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
    "customer_id": "2c8e91c2-e848-43d2-888c-b680c6909453",
    "status": "PAUSED"
  }
}`,
              },
            ],
          },
          {
            id: "webhook-subscription-resumed",
            label: "subscription.resumed",
            icon: "ti-player-play",
            blocks: [
              {
                type: "webhookEvent",
                event: "subscription.resumed",
                firesWhen: "A paused subscription resumes",
                description: "Billing has restarted, on a fresh period starting now — resuming never back-bills the paused months. Restore access if you'd restricted it.",
                payload: [
                  { name: "id", type: "uuid", description: "Subscription ID" },
                  { name: "customer_id", type: "uuid", description: "The customer whose subscription resumed" },
                  { name: "status", type: "string", description: "ACTIVE" },
                  { name: "current_period_start", type: "string", description: "Always now — resuming fast-forwards to the current period" },
                ],
                example: `{
  "event_type": "subscription.resumed",
  "data": {
    "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
    "customer_id": "2c8e91c2-e848-43d2-888c-b680c6909453",
    "status": "ACTIVE",
    "current_period_start": "2026-07-08T00:00:00Z"
  }
}`,
              },
            ],
          },
          {
            id: "webhook-payout-completed",
            label: "payout.completed",
            icon: "ti-building-bank",
            blocks: [
              {
                type: "webhookEvent",
                event: "payout.completed",
                firesWhen: "A requested bank transfer withdrawal is confirmed by Nomba",
                description: "Your payout landed. Useful if you reconcile payouts against your own accounting system automatically.",
                payload: [
                  { name: "id", type: "uuid", description: "Payout ID" },
                  { name: "amount_kobo", type: "integer", description: "Amount transferred, in kobo" },
                  { name: "bank_name", type: "string", description: "Destination bank" },
                  { name: "status", type: "string", description: "completed" },
                  { name: "completed_at", type: "string", description: "ISO-8601 timestamp" },
                ],
                example: `{
  "event_type": "payout.completed",
  "data": {
    "id": "d1a2b3c4-5678-90ab-cdef-1234567890ab",
    "amount_kobo": 1000000,
    "bank_name": "Access Bank",
    "status": "completed",
    "completed_at": "2026-07-08T09:00:00Z"
  }
}`,
              },
            ],
          },
          {
            id: "webhook-payout-failed",
            label: "payout.failed",
            icon: "ti-alert-triangle",
            blocks: [
              {
                type: "webhookEvent",
                event: "payout.failed",
                firesWhen: "A requested bank transfer fails on Nomba's side",
                description: "The transfer didn't go through — check failure_reason and, if it's something fixable (wrong account details), let the operator retry from the dashboard.",
                payload: [
                  { name: "id", type: "uuid", description: "Payout ID" },
                  { name: "amount_kobo", type: "integer", description: "Amount that failed to transfer, in kobo" },
                  { name: "status", type: "string", description: "failed" },
                  { name: "failure_reason", type: "string", description: "Why Nomba rejected the transfer" },
                ],
                example: `{
  "event_type": "payout.failed",
  "data": {
    "id": "d1a2b3c4-5678-90ab-cdef-1234567890ab",
    "amount_kobo": 1000000,
    "status": "failed",
    "failure_reason": "invalid account number"
  }
}`,
              },
            ],
          },
          {
            id: "webhook-payment-link-paid",
            label: "payment_link.paid",
            icon: "ti-link",
            blocks: [
              {
                type: "webhookEvent",
                event: "payment_link.paid",
                firesWhen: "A customer pays a payment link — either through your own Platform API checkout call, or by paying the bare shareable link directly",
                description: "This is the only way to know a payment link was paid — a payment link isn't a subscription, so it never fires subscription.activated or payment.succeeded. If you're using payment links for something like a one-time onboarding fee, this is the event that tells you to unlock whatever that fee unlocks.",
                payload: [
                  { name: "payment_link_id", type: "uuid", description: "The payment link that was paid" },
                  { name: "title", type: "string", description: "The link's title, e.g. \"Setup Fee\"" },
                  { name: "amount_kobo", type: "integer", description: "Amount collected, in kobo" },
                  { name: "currency", type: "string", description: "NGN" },
                  { name: "reference", type: "string", description: "The Nomba order reference for this specific payment" },
                  { name: "paid_at", type: "string", description: "ISO-8601 timestamp" },
                ],
                example: `{
  "event_type": "payment_link.paid",
  "data": {
    "payment_link_id": "7ca2eaf5-a4cb-4852-8d7a-f389de2ef1d0",
    "title": "ClassPay Setup Fee",
    "amount_kobo": 500000,
    "currency": "NGN",
    "reference": "pl_7ca2eaf5-a4cb-4852-8d7a-f389de2ef1d0_19ffb1f0656737ba",
    "paid_at": "2026-07-08T10:15:00Z"
  }
}`,
              },
            ],
          },
        ],
      },
      // ═══════════════════════════════════════════════════════
      // CUSTOMER PORTAL
      // ═══════════════════════════════════════════════════════
      {
        group: "Customer Portal",
        items: [
          {
            id: "ref-portal-request-otp",
            label: "Request login code",
            icon: "ti-mail",
            method: "POST",
            endpoint: "/v1/portal/auth/request-otp",
            blocks: [
              {
                type: "endpoint",
                method: "POST",
                path: "/v1/portal/auth/request-otp",
                summary: "Let a customer authenticate themselves",
                description: "Public — no API key needed. Emails a 6-digit code to the customer's address on file, scoped to your tenant. Use this when the customer is arriving cold (an email link, a support conversation) with no existing session from your own product — if you already have the customer logged into your product, generating a portal token server-side (Platform API section above) is simpler and skips the email round-trip entirely.",
                auth: "none",
                body: [
                  { name: "email", type: "string", required: true, description: "The customer's email address" },
                  { name: "tenant_id", type: "uuid", required: true, description: "Your tenant ID" },
                ],
                examples: {
                  curl: `curl -X POST https://api-production-3847.up.railway.app/v1/portal/auth/request-otp \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "amaka@school.ng", "tenant_id": "2d9ff9ec-90db-41cf-9dd6-a5c92f054f97" }'`,
                  javascript: `const res = await fetch('https://api-production-3847.up.railway.app/v1/portal/auth/request-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'amaka@school.ng', tenant_id: TORI_TENANT_ID }),
});`,
                  go: `resp, err := http.Post(
  "https://api-production-3847.up.railway.app/v1/portal/auth/request-otp",
  "application/json",
  strings.NewReader(\`{"email": "amaka@school.ng", "tenant_id": "2d9ff9ec-..."}\`),
)`,
                  python: `res = requests.post(
  "https://api-production-3847.up.railway.app/v1/portal/auth/request-otp",
  json={"email": "amaka@school.ng", "tenant_id": TORI_TENANT_ID},
)`,
                },
                responses: {
                  "200": `{
  "data": { "status": "sent" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "404": `{
  "error": { "code": "not_found", "message": "no customer with this email" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
            ],
          },
          {
            id: "ref-portal-verify-otp",
            label: "Verify login code",
            icon: "ti-shield-check",
            method: "POST",
            endpoint: "/v1/portal/auth/verify-otp",
            blocks: [
              {
                type: "endpoint",
                method: "POST",
                path: "/v1/portal/auth/verify-otp",
                summary: "Verify the OTP and get a portal session",
                description: "Public — no API key needed. Exchanges a valid, unused, unexpired code for a portal session token, usable on every other /v1/portal/* endpoint below.",
                auth: "none",
                body: [
                  { name: "email", type: "string", required: true, description: "The customer's email address" },
                  { name: "tenant_id", type: "uuid", required: true, description: "Your tenant ID" },
                  { name: "code", type: "string", required: true, description: "The 6-digit code from the email" },
                ],
                examples: {
                  curl: `curl -X POST https://api-production-3847.up.railway.app/v1/portal/auth/verify-otp \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "amaka@school.ng", "tenant_id": "2d9ff9ec-...", "code": "482913" }'`,
                  javascript: `const res = await fetch('https://api-production-3847.up.railway.app/v1/portal/auth/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'amaka@school.ng', tenant_id: TORI_TENANT_ID, code: '482913' }),
});
const { data } = await res.json();
// data.token — pass as Authorization: Bearer <token> on every /v1/portal/* call`,
                  go: `resp, err := http.Post(
  "https://api-production-3847.up.railway.app/v1/portal/auth/verify-otp",
  "application/json",
  strings.NewReader(\`{"email": "amaka@school.ng", "tenant_id": "2d9ff9ec-...", "code": "482913"}\`),
)`,
                  python: `res = requests.post(
  "https://api-production-3847.up.railway.app/v1/portal/auth/verify-otp",
  json={"email": "amaka@school.ng", "tenant_id": TORI_TENANT_ID, "code": "482913"},
)`,
                },
                responses: {
                  "200": `{
  "data": { "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "400": `{
  "error": { "code": "invalid_code", "message": "code is incorrect, expired, or already used" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
            ],
          },
          {
            id: "ref-portal-subs-list",
            label: "List my subscriptions",
            icon: "ti-list",
            method: "GET",
            endpoint: "/v1/portal/subscriptions",
            blocks: [
              {
                type: "endpoint",
                method: "GET",
                path: "/v1/portal/subscriptions",
                summary: "The customer's own subscriptions",
                description: "Returns every subscription belonging to the authenticated customer.",
                auth: "portalToken",
                headers: [
                  { name: "Authorization", type: "string", required: true, description: "Bearer <portal_token>" },
                ],
                examples: {
                  curl: `curl https://api-production-3847.up.railway.app/v1/portal/subscriptions \\
  -H "Authorization: Bearer <portal_token>"`,
                  javascript: `const res = await fetch('https://api-production-3847.up.railway.app/v1/portal/subscriptions', {
  headers: { Authorization: \`Bearer \${portalToken}\` },
});
const { data } = await res.json();`,
                  go: `req, _ := http.NewRequest("GET",
  "https://api-production-3847.up.railway.app/v1/portal/subscriptions", nil)
req.Header.Set("Authorization", "Bearer "+portalToken)`,
                  python: `res = requests.get(
  "https://api-production-3847.up.railway.app/v1/portal/subscriptions",
  headers={"Authorization": f"Bearer {portal_token}"},
)`,
                },
                responses: {
                  "200": `{
  "data": [
    {
      "id": "f6ffcc85-1642-46ef-9624-32fe545ea947",
      "status": "ACTIVE",
      "plan_name": "Basic Monthly",
      "plan_amount": 250000,
      "current_period_end": "2026-08-08T00:00:00Z"
    }
  ],
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "401": `{
  "error": { "code": "unauthorized", "message": "invalid or expired portal token" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
            ],
          },
          {
            id: "ref-portal-subs-cancel",
            label: "Cancel my subscription",
            icon: "ti-x",
            method: "POST",
            endpoint: "/v1/portal/subscriptions/{id}/cancel",
            blocks: [
              {
                type: "endpoint",
                method: "POST",
                path: "/v1/portal/subscriptions/{id}/cancel",
                summary: "Customer self-service cancel",
                description: "Always cancels at period end — access continues until current_period_end, matching how customer-initiated cancellation works everywhere else in Tori. The subscription must belong to the customer in the token.",
                auth: "portalToken",
                headers: [
                  { name: "Authorization", type: "string", required: true, description: "Bearer <portal_token>" },
                ],
                examples: {
                  curl: `curl -X POST https://api-production-3847.up.railway.app/v1/portal/subscriptions/f6ffcc85-.../cancel \\
  -H "Authorization: Bearer <portal_token>"`,
                  javascript: `const res = await fetch(
  \`https://api-production-3847.up.railway.app/v1/portal/subscriptions/\${subscriptionId}/cancel\`,
  { method: 'POST', headers: { Authorization: \`Bearer \${portalToken}\` } },
);`,
                  go: `req, _ := http.NewRequest("POST",
  "https://api-production-3847.up.railway.app/v1/portal/subscriptions/"+subscriptionID+"/cancel", nil)
req.Header.Set("Authorization", "Bearer "+portalToken)`,
                  python: `res = requests.post(
  f"https://api-production-3847.up.railway.app/v1/portal/subscriptions/{subscription_id}/cancel",
  headers={"Authorization": f"Bearer {portal_token}"},
)`,
                },
                responses: {
                  "200": `{
  "data": { "id": "f6ffcc85-...", "status": "ACTIVE", "cancel_at_period_end": true },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "401": `{
  "error": { "code": "unauthorized", "message": "subscription does not belong to this customer" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
            ],
          },
          {
            id: "ref-portal-update-payment-method",
            label: "Update payment method",
            icon: "ti-credit-card",
            method: "POST",
            endpoint: "/v1/portal/subscriptions/{id}/update-payment-method",
            blocks: [
              {
                type: "endpoint",
                method: "POST",
                path: "/v1/portal/subscriptions/{id}/update-payment-method",
                summary: "Update the card on file",
                description: "Opens a fresh Nomba tokenization checkout for this subscription. Redirect the customer to checkout_url — raw card data never touches Tori or your servers.",
                auth: "portalToken",
                headers: [
                  { name: "Authorization", type: "string", required: true, description: "Bearer <portal_token>" },
                ],
                examples: {
                  curl: `curl -X POST https://api-production-3847.up.railway.app/v1/portal/subscriptions/f6ffcc85-.../update-payment-method \\
  -H "Authorization: Bearer <portal_token>"`,
                  javascript: `const res = await fetch(
  \`https://api-production-3847.up.railway.app/v1/portal/subscriptions/\${subscriptionId}/update-payment-method\`,
  { method: 'POST', headers: { Authorization: \`Bearer \${portalToken}\` } },
);
const { data } = await res.json();
window.location.href = data.checkout_url;`,
                  go: `req, _ := http.NewRequest("POST",
  "https://api-production-3847.up.railway.app/v1/portal/subscriptions/"+subscriptionID+"/update-payment-method", nil)
req.Header.Set("Authorization", "Bearer "+portalToken)`,
                  python: `res = requests.post(
  f"https://api-production-3847.up.railway.app/v1/portal/subscriptions/{subscription_id}/update-payment-method",
  headers={"Authorization": f"Bearer {portal_token}"},
)`,
                },
                responses: {
                  "200": `{
  "data": { "checkout_url": "https://pay.nomba.com/checkout/def456" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "401": `{
  "error": { "code": "unauthorized", "message": "invalid or expired portal token" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
            ],
          },
          {
            id: "ref-portal-invoices",
            label: "List my invoices",
            icon: "ti-receipt",
            method: "GET",
            endpoint: "/v1/portal/invoices",
            blocks: [
              {
                type: "endpoint",
                method: "GET",
                path: "/v1/portal/invoices",
                summary: "The customer's own invoices",
                description: "Returns every invoice belonging to the authenticated customer, newest first.",
                auth: "portalToken",
                headers: [
                  { name: "Authorization", type: "string", required: true, description: "Bearer <portal_token>" },
                ],
                examples: {
                  curl: `curl https://api-production-3847.up.railway.app/v1/portal/invoices \\
  -H "Authorization: Bearer <portal_token>"`,
                  javascript: `const res = await fetch('https://api-production-3847.up.railway.app/v1/portal/invoices', {
  headers: { Authorization: \`Bearer \${portalToken}\` },
});
const { data } = await res.json();`,
                  go: `req, _ := http.NewRequest("GET",
  "https://api-production-3847.up.railway.app/v1/portal/invoices", nil)
req.Header.Set("Authorization", "Bearer "+portalToken)`,
                  python: `res = requests.get(
  "https://api-production-3847.up.railway.app/v1/portal/invoices",
  headers={"Authorization": f"Bearer {portal_token}"},
)`,
                },
                responses: {
                  "200": `{
  "data": [
    {
      "id": "3ef83506-6d7d-42cb-bf8c-68cd1ca352df",
      "amount": 250000,
      "currency": "NGN",
      "status": "paid",
      "paid_at": "2026-07-08T00:00:00Z"
    }
  ],
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                  "401": `{
  "error": { "code": "unauthorized", "message": "invalid or expired portal token" },
  "meta": { "request_id": "uuid", "api_version": "2026-07-01" }
}`,
                },
              },
            ],
          },
        ],
      },
      // ═══════════════════════════════════════════════════════
      // DASHBOARD API (secondary)
      // ═══════════════════════════════════════════════════════
      {
        group: "Dashboard API",
        items: [
          {
            id: "dashboard-api-overview",
            label: "Dashboard-only endpoints",
            icon: "ti-layout-dashboard",
            blocks: [
              {
                type: "callout",
                variant: "info",
                text: "These endpoints power the Tori dashboard itself. You don't need them to integrate Tori into your product — they're documented here in case you want to build your own operator tooling on top of Tori instead of using the dashboard.",
              },
              { type: "h2", text: "Auth & account", id: "dash-auth" },
              {
                type: "table",
                headers: ["Method", "Path", "What it does"],
                rows: [
                  ["POST", "/v1/auth/register", "Create a tenant account"],
                  ["POST", "/v1/auth/login", "Log in, get a dashboard session"],
                  ["POST", "/v1/auth/refresh", "Refresh an access token"],
                  ["POST", "/v1/auth/logout", "Revoke the current session"],
                  ["POST", "/v1/auth/verify-email", "Verify account email with a 6-digit code"],
                  ["POST", "/v1/auth/resend-verification", "Resend the verification code"],
                  ["GET/DELETE", "/v1/auth/sessions", "List and revoke active login sessions"],
                  ["GET/PATCH", "/v1/me", "View or update your own tenant account"],
                ],
              },
              { type: "h2", text: "API keys & OAuth clients", id: "dash-keys" },
              {
                type: "table",
                headers: ["Method", "Path", "What it does"],
                rows: [
                  ["GET", "/v1/api-keys", "Get hints for your live/test keys"],
                  ["POST", "/v1/api-keys", "Generate or rotate the live key"],
                  ["POST", "/v1/api-keys/test", "Generate or rotate the test key"],
                  ["POST", "/v1/api-keys/rotate", "Rotate the live key"],
                  ["DELETE", "/v1/api-keys/{mode}", "Revoke a key"],
                  ["POST/GET/DELETE", "/v1/oauth/clients", "Manage OAuth clients — creating one is a Platform API concern, covered above"],
                ],
              },
              { type: "h2", text: "Catalog & customers", id: "dash-catalog" },
              {
                type: "table",
                headers: ["Method", "Path", "What it does"],
                rows: [
                  ["POST/PATCH/DELETE", "/v1/plans", "Create, update, deactivate plans"],
                  ["POST/PATCH", "/v1/customers", "Create or update customers from the dashboard"],
                  ["POST", "/v1/customers/{id}/archive", "Archive a customer record"],
                  ["POST/GET/DELETE", "/v1/promo-codes", "Create, list, deactivate promo codes"],
                ],
              },
              { type: "h2", text: "Subscriptions (operator actions)", id: "dash-subs" },
              {
                type: "table",
                headers: ["Method", "Path", "What it does"],
                rows: [
                  ["POST", "/v1/checkout", "Dashboard-side checkout — same handler as the Platform API's checkout"],
                  ["POST", "/v1/subscriptions/{id}/checkout", "Regenerate a checkout URL"],
                  ["PATCH", "/v1/subscriptions/{id}/plan", "Change plan with proration"],
                  ["GET", "/v1/subscriptions/{id}/transitions", "Full status-change audit trail"],
                  ["POST", "/v1/subscriptions/{id}/retry-now", "Operator: force an immediate retry"],
                  ["POST", "/v1/subscriptions/{id}/send-pay-link", "Operator: jump straight to the manual pay-link rail"],
                  ["POST", "/v1/subscriptions/{id}/recover", "Operator: manually mark a suspended subscription recovered"],
                  ["POST", "/v1/subscriptions/{id}/refund", "Issue a refund"],
                ],
              },
              { type: "h2", text: "Invoices & ledger", id: "dash-ledger" },
              {
                type: "table",
                headers: ["Method", "Path", "What it does"],
                rows: [
                  ["GET", "/v1/invoices", "List invoices — operators use this; customers use /v1/portal/invoices"],
                  ["GET", "/v1/invoices/{id}", "Get one invoice"],
                  ["GET", "/v1/ledger", "List raw ledger entries"],
                  ["GET", "/v1/ledger/{id}", "Get one ledger entry"],
                  ["GET", "/v1/ledger/monthly", "Monthly revenue breakdown"],
                  ["GET", "/v1/ledger/summary", "Aggregate totals for a date range"],
                ],
              },
              { type: "h2", text: "Webhook management", id: "dash-webhooks" },
              {
                type: "table",
                headers: ["Method", "Path", "What it does"],
                rows: [
                  ["POST/GET/PATCH/DELETE", "/v1/webhooks/endpoints", "Register, list, update, delete webhook endpoints"],
                  ["GET", "/v1/webhooks/logs", "Delivery log — payload, response, status, attempt count"],
                  ["POST", "/v1/webhooks/logs/{id}/retry", "Manually retry a failed delivery"],
                ],
              },
              { type: "h2", text: "Team & audit", id: "dash-team" },
              {
                type: "table",
                headers: ["Method", "Path", "What it does"],
                rows: [
                  ["GET", "/v1/team/members", "List team members"],
                  ["POST", "/v1/team/members/invite", "Invite a teammate"],
                  ["PATCH/DELETE", "/v1/team/members/{id}", "Change role / remove a member"],
                  ["DELETE", "/v1/team/invitations/{id}", "Revoke a pending invite"],
                  ["POST", "/v1/team/invitations/accept", "Accept an invite (public)"],
                  ["GET", "/v1/team/audit-log", "Every administrative action, with actor and IP"],
                ],
              },
              { type: "h2", text: "Email templates", id: "dash-email" },
              {
                type: "table",
                headers: ["Method", "Path", "What it does"],
                rows: [
                  ["GET", "/v1/email-templates", "List all 7 billing email templates"],
                  ["PUT", "/v1/email-templates/{event_type}", "Configure one template"],
                  ["POST", "/v1/email-templates/{event_type}/test", "Send a test email to yourself"],
                ],
              },
              { type: "h2", text: "Finance & billing health", id: "dash-finance" },
              {
                type: "table",
                headers: ["Method", "Path", "What it does"],
                rows: [
                  ["GET", "/v1/finance/mrr", "Monthly recurring revenue"],
                  ["GET", "/v1/finance/arr", "Annual recurring revenue"],
                  ["GET", "/v1/finance/churn", "Churn rate"],
                  ["GET", "/v1/finance/dunning-recovery", "Recovery rate from dunning"],
                  ["GET", "/v1/finance/revenue-report", "Full revenue breakdown"],
                  ["GET", "/v1/finance/recovery-center", "At-risk / recovering / recovered subscriptions"],
                  ["GET", "/v1/finance/balance", "Settled vs. pending (T+1) balance"],
                  ["GET", "/v1/health", "Billing health score"],
                  ["GET", "/v1/health/forecast", "Churn and revenue forecast"],
                ],
              },
              { type: "h2", text: "Payouts", id: "dash-payouts" },
              {
                type: "table",
                headers: ["Method", "Path", "What it does"],
                rows: [
                  ["GET/POST", "/v1/payouts", "List or request a bank transfer withdrawal"],
                  ["GET", "/v1/payouts/{id}", "Get one payout"],
                  ["GET", "/v1/payouts/banks", "Supported bank list"],
                  ["GET", "/v1/payouts/resolve-account", "Resolve an account holder's name"],
                ],
              },
              { type: "h2", text: "Payment links (management)", id: "dash-paylinks" },
              {
                type: "table",
                headers: ["Method", "Path", "What it does"],
                rows: [
                  ["GET/POST", "/v1/payment-links", "List or create payment links — collecting a payment is the Platform API concern covered above"],
                  ["GET/DELETE", "/v1/payment-links/{id}", "Get or deactivate a payment link"],
                ],
              },
              { type: "h2", text: "Settings & system", id: "dash-settings" },
              {
                type: "table",
                headers: ["Method", "Path", "What it does"],
                rows: [
                  ["PATCH", "/v1/dunning-config", "Configure retry days, max attempts, suspension action"],
                  ["GET", "/v1/events", "Tenant activity feed — OAuth, payout, payment-link lifecycle"],
                  ["GET", "/v1/status", "Unauthenticated liveness check"],
                  ["GET", "/v1/metrics", "Operational snapshot: subscriptions, MRR, queue health"],
                ],
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
                text: "2026-07-07 — Portal upgrade, payouts, payment links, OAuth",
                id: "v1-8",
              },
              {
                type: "list",
                items: [
                  "Full customer portal — email OTP authentication, customers self-authenticate without operator involvement",
                  "Portal invoice viewing — customers see all invoices across subscriptions with PDF download",
                  "Portal payment method update — generates fresh Nomba checkout for customers to re-enter card details",
                  "Portal subscription history timeline — every state change shown in customer-friendly language",
                  "Portal cancel with reason — churn reason stored in subscription metadata for operator analysis",
                  "Async payouts — operators request NGN bank transfers, processed via Nomba transfer API, completion webhooks",
                  "Payout history dashboard — pending/processing/completed/failed status tracking",
                  "Payment links — standalone one-time payment links with public checkout page, max uses, expiry, pay_link.paid webhook",
                  "OAuth 2.0 client credentials — POST /v1/oauth/token, operators exchange client_id/client_secret for Bearer tokens",
                  "OAuth clients dashboard page — create, list, revoke OAuth clients with reveal-once secret modal",
                  "Platform API accepts both X-API-Key and OAuth Bearer token authentication",
                  "Tori-branded checkout shell — /checkout/[token] embeds Nomba iframe, tori_checkout_url in platform checkout response",
                  "Subscription pause with proration credit — pause issues CREDIT ledger entry for unused days, resume applies credit to next charge",
                  "Resume-forward billing — lapsed subscriptions settle one invoice and fast-forward to current period, no back-billing",
                  "ChargeWaterfall recovery — wallet balance checked before card on every dunning retry, wallet rail tracked per subscription",
                  "Merchant balance with T+1 settlement — available vs pending split on Finance page",
                  "Subscription list response embeds plan_name/plan_amount/plan_interval — eliminates client-side join failures",
                  "Plan/subscription mode validation at checkout — rejects cross-mode plan references with plan_mode_mismatch error",
                  "Customer external_id properly threaded through checkout and seeding",
                  "Smoke test expanded to 37 checks including OAuth and payment link flows",
                ],
              },
              {
                type: "h2",
                text: "2026-07-06 — Financial audit, test/live isolation, security, events",
                id: "v1-7",
              },
              {
                type: "list",
                items: [
                  "Financial correctness audit — 19 issues identified and fixed across billing engine, ledger, finops, and proration",
                  "Critical: double ledger entry bug fixed — trial conversions and dunning recoveries were silently recording revenue twice",
                  "Critical: RegenerateCheckout argument swap fixed — endpoint was 500ing on every call",
                  "Critical: invoice amounts now use actual transaction amount from Nomba webhook, not plan amount — discounted invoices now correct",
                  "Critical: GetDunningRecovery rewritten to compute real at-risk, recovered, and lost amounts from actual subscription data",
                  "MRR/ARR normalized for annual plans — one renewal no longer spikes a month's MRR by a full year's revenue",
                  "Churn rate uses subscriptions active at period start, not current snapshot count",
                  "RevenueReport.BreakdownByPlan now implemented — was always returning null",
                  "Proration uses math.Round instead of math.Ceil — eliminates systematic overcharge on upgrades",
                  "Network errors distinguished from card declines — infra failures retry without burning dunning attempts",
                  "Full test/live mode data isolation — mode column on all resource tables, X-Tori-Mode header on dashboard requests",
                  "Test subscriptions/customers/invoices/plans completely separate from live data — toggle switches datasets instantly",
                  "Mode switching without page refresh — queryClient.clear() on toggle, data updates immediately",
                  "Role-based access control — JWT carries role claim, RequireRole middleware on all mutating routes",
                  "Four roles enforced at API and UI layer — owner, admin, developer, viewer",
                  "Active session tracking in Redis with instant revocation — Security page shows all active sessions",
                  "Session revokes immediately on logout or manual revoke — not after JWT expiry",
                  "Keyset cursor pagination on all list endpoints — O(1) per page regardless of dataset size",
                  "Events activity feed — every meaningful operation writes to events table, GET /v1/events activity timeline",
                ],
              },
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
                  "Role-based access control: JWT carries role claim, RequireRole middleware enforces permissions server-side, frontend gates all mutating buttons via permissions.ts",
                  "Role badge shown in dashboard header for all members",
                  "Viewers cannot access Webhooks or API Keys pages",
                ],
              },
              {
                type: "h2",
                text: "2026-07-02: Billing correctness and operator tools",
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
                text: "2026-07-01: Live production integration",
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
                text: "2026-06-30: PENDING_PAYMENT state and refund system",
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
                text: "2026-06-30: Nomba integration and ClassPay demo",
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
                text: "2026-06-28: Tenant onboarding and observability",
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
                text: "2026-06-26: Public beta launch",
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
                text: "2026-06-19: Project Architecture and initial commit",
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

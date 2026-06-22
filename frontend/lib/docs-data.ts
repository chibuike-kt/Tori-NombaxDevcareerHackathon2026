export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id: string }
  | { type: "h3"; text: string }
  | { type: "code"; lang?: string; code: string }
  | { type: "callout"; variant?: "info" | "warn" | "success"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; items: string[] };

export type Section = { id: string; label: string; icon: string; blocks: Block[] };
export type Group = { group: string; items: Section[] };
export type Tab = { id: string; label: string; groups: Group[] };

const BASE = "https://api.tori.ng";

export const TABS: Tab[] = [
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
                text: "Tori is a subscription billing engine built natively on Nomba's payment infrastructure. It solves one specific problem: every Nigerian SaaS, edtech, and creator platform that charges customers on a recurring basis has had to build the same billing system from scratch. Subscriptions, payment retries, access control, revenue reporting all of it, rebuilt by every team, every time.",
              },
              {
                type: "p",
                text: "Tori is that system. Built once, running on Nomba's rails, available to every business that needs it.",
              },
              {
                type: "callout",
                variant: "success",
                text: "You can test the full API right now with no account. Try creating a plan, customer, and subscription in the sandbox without signing up.",
              },
              { type: "h2", text: "What Tori does", id: "what" },
              {
                type: "p",
                text: "When you integrate Tori, three things happen. You make three API calls to set up a subscription. After that, Tori handles everything else automatically for as long as the subscription is active.",
              },
              {
                type: "list",
                items: [
                  "Tori charges the customer through Nomba on each billing cycle monthly, annual, or a custom interval you define",
                  "When a charge fails, Tori classifies the reason and decides whether to retry, and when",
                  "Every attempt, success, failure, refund, and credit is written to an immutable ledger you can audit at any time",
                  "Your product receives a webhook event for every billing action so you can react suspend access, send a receipt, restore service",
                  "Your dashboard shows MRR, churn rate, dunning recovery, and net revenue computed from real data",
                ],
              },
              { type: "h2", text: "What Tori does not do", id: "what-not" },
              {
                type: "p",
                text: "Tori is not a payment processor. It does not move money directly. Nomba moves the money. Tori is the orchestration layer that decides when to charge, what to do when it fails, and how to record what happened. Think of Nomba as the engine and Tori as the transmission you interact with Tori, and Tori talks to Nomba on your behalf.",
              },
              { type: "h2", text: "The three objects", id: "objects" },
              {
                type: "p",
                text: "Everything in Tori is built around three core objects. Once you understand these three things, the entire system makes sense.",
              },
              {
                type: "table",
                headers: ["Object", "What it represents", "Example"],
                rows: [
                  [
                    "Plan",
                    "A pricing template what you charge and how often",
                    "₦15,000/month with a 14-day free trial",
                  ],
                  [
                    "Customer",
                    "A person or business that pays you",
                    "amaka@startup.ng, mapped to your own user ID",
                  ],
                  [
                    "Subscription",
                    "The live billing relationship between a customer and a plan",
                    "Amaka on the Pro plan, currently ACTIVE",
                  ],
                ],
              },
              {
                type: "p",
                text: "You create a plan once. You create a customer when someone signs up. You create a subscription to link the two. That is the entire setup. Everything else charging, retrying, reporting happens automatically.",
              },
            ],
          },
        ],
      },
      {
        group: "Why Tori",
        items: [
          {
            id: "vs-Other payment processors",
            label: "Tori vs Other payment processors subscriptions",
            icon: "ti-arrows-diff",
            blocks: [
              {
                type: "p",
                text: "Other payment processors has subscriptions and recurring charges. So why does Tori exist? Because those tools solve a different problem. They are payment processors that added subscription features. Tori is a subscription engine built on top of a payment processor. The distinction matters more than it sounds.",
              },
              { type: "h2", text: "One call vs three calls", id: "one-call" },
              {
                type: "p",
                text: "On Other payment processors, subscribing a customer requires: an existing transaction on your integration (so Other payment processors has a card authorisation to charge), a customer object, and then a subscription creation call. If the customer is new, they must complete a checkout first. You cannot create a subscription for someone who has never paid you.",
              },
              {
                type: "p",
                text: "On Tori, you pass an email and a plan ID. Tori finds or creates the customer automatically and starts the subscription in the same call. One endpoint, one network round trip, no prior state required.",
              },
              {
                type: "code",
                lang: "bash",
                code: `# Tori: one call, no prior customer needed
                POST /v1/platform/checkout
                {
                  "email": "amaka@startup.ng",
                  "plan_id": "plan_...",
                  "external_id": "your-user-123"
                }

                # Response: customer object + subscription object + customer_created flag
                # If amaka already exists, Tori finds her. If not, Tori creates her.
                # Either way, the subscription starts.`,
              },
              {
                type: "h2",
                text: "Nigerian failure classification",
                id: "failure-classification",
              },
              {
                type: "p",
                text: "When a Other payment processors subscription charge fails, Other payment processors retries on a fixed schedule. It does not know or care why the charge failed. A GTB card blocked for online transactions gets retried the same number of times as a card with temporarily insufficient funds. Both waste retry slots. Both generate failed transaction fees.",
              },
              {
                type: "p",
                text: "Tori reads the failure code returned by Nomba and classifies it before deciding what to do next. Blocked cards, expired cards, and do-not-honour responses are classified as permanent and not retried. Insufficient funds, bank outages, and timeouts are classified as retriable and scheduled across payday windows.",
              },
              {
                type: "table",
                headers: [
                  "Failure type",
                  "Other payment processors behaviour",
                  "Tori behaviour",
                ],
                rows: [
                  [
                    "Card blocked for online transactions",
                    "Retries on fixed schedule (wastes 4 attempts)",
                    "Classified permanent, stops immediately",
                  ],
                  [
                    "Insufficient funds",
                    "Retries on fixed schedule",
                    "Classified retriable, retries on payday windows: Day 3, 7, 14, 21",
                  ],
                  [
                    "Bank system outage",
                    "Retries on fixed schedule",
                    "Classified retriable, short retry window",
                  ],
                  [
                    "Card expired",
                    "Retries on fixed schedule",
                    "Classified permanent, stops immediately",
                  ],
                ],
              },
              { type: "h2", text: "Proration", id: "proration" },
              {
                type: "p",
                text: "Other payment processors has no proration. If a customer on a ₦10,000/month plan upgrades to ₦20,000/month on day 15, you either charge them the full ₦20,000 immediately (overcharging by half a month) or wait until their next billing cycle (giving them the upgrade for free for two weeks). Neither is correct.",
              },
              {
                type: "p",
                text: "Tori computes the exact credit for unused days on the old plan and the exact charge for remaining days on the new plan. The net adjustment is written to the ledger as a PRORATION entry. The customer pays exactly what they owe, to the kobo.",
              },
              {
                type: "h2",
                text: "The ledger vs a transaction list",
                id: "ledger-vs-transactions",
              },
              {
                type: "p",
                text: "Other payment processors gives you a list of transactions. Each transaction is a payment event. There is no concept of a financial ledger, no MRR computation, no churn tracking, no dunning recovery rate. You get the raw data and build the reporting yourself.",
              },
              {
                type: "p",
                text: "Tori maintains an append-only ledger behind every subscription. Every charge, refund, credit, and adjustment writes one immutable row. From that ledger, Tori computes MRR, ARR, churn rate, and dunning recovery automatically. You query one endpoint and get the number, with full traceability back to the individual entries behind it.",
              },
              { type: "h2", text: "Webhook replay", id: "webhook-replay" },
              {
                type: "p",
                text: "Other payment processors delivers webhooks on a best-effort basis. If your server is down, the event is lost. There is no dashboard to see what was delivered, no way to replay a missed event without contacting support.",
              },
              {
                type: "p",
                text: "Tori logs every webhook delivery attempt with the full payload, response status, and timestamp. If a delivery fails, Tori retries on a schedule. If you need to replay a specific event, you call one endpoint. Every delivery is inspectable from the dashboard.",
              },
              {
                type: "h2",
                text: "Subscription states",
                id: "states-comparison",
              },
              {
                type: "p",
                text: "Other payment processors subscriptions have two meaningful states: active and cancelled. There is no paused state, no dunning state, no suspended state. If a customer wants to pause their subscription, you have to cancel it and create a new one when they come back.",
              },
              {
                type: "p",
                text: "Tori has seven states enforced by a pure state machine: TRIALING, ACTIVE, PAST_DUE, DUNNING, PAUSED, SUSPENDED, and CANCELLED. Each transition is validated before it happens. A paused subscription can be resumed. A dunning subscription recovers automatically when a retry succeeds. A cancelled subscription is terminal. The state model reflects how subscriptions actually behave in the real world.",
              },
              {
                type: "callout",
                variant: "success",
                text: "None of this means Other payment processors is bad. Other payment processors is excellent at what it does: moving money. Tori is built on top of Nomba's payment rails to handle the subscription lifecycle layer that payment processors do not provide. If you are building a recurring revenue business in Nigeria, you need both: a payment processor to move the money, and Tori to manage the relationship.",
              },
            ],
          },
          {
            id: "when-to-use",
            label: "When to use Tori",
            icon: "ti-target",
            blocks: [
              {
                type: "p",
                text: "Tori is the right choice when your business has recurring revenue relationships with customers, not just one-off payments. The signal is whether you think in terms of subscribers and churn rather than transactions and revenue.",
              },
              { type: "h2", text: "Use Tori if", id: "use-tori" },
              {
                type: "list",
                items: [
                  "You charge customers on a recurring schedule: monthly, annual, termly, or any other interval",
                  "You need to handle payment failures intelligently without building retry logic yourself",
                  "You want MRR, churn, and revenue metrics without building a reporting layer",
                  "You need customers to be able to pause, resume, or cancel their own subscriptions",
                  "You want an auditable financial record of every naira that has moved through your billing system",
                  "You are building on Nomba's payment infrastructure and want the subscription layer to match",
                ],
              },
              { type: "h2", text: "Do not use Tori if", id: "dont-use" },
              {
                type: "list",
                items: [
                  "You only need one-off payments with no recurring component",
                  "You already have a mature billing system and are not looking to migrate",
                  "Your billing intervals are so irregular that no subscription model fits (use direct charges instead)",
                ],
              },
              {
                type: "h2",
                text: "Tori and Nomba together",
                id: "tori-and-nomba",
              },
              {
                type: "p",
                text: "Tori does not replace Nomba. Nomba moves the money. Tori manages the subscription relationship and tells Nomba when to charge, how much, and for whom. Think of the stack as: your product talks to Tori, Tori talks to Nomba, Nomba moves the naira.",
              },
              {
                type: "code",
                lang: "bash",
                code: `Your product
    |
    | POST /v1/platform/checkout
    v
  Tori (subscription engine)
    |
    | ChargeToken request
    v
  Nomba (payment processor)
    |
    | Naira moves
    v
  Customer's bank account`,
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
            label: "SaaS: ClassPay walkthrough",
            icon: "ti-building-store",
            blocks: [
              {
                type: "p",
                text: "This guide walks through a complete, real integration. The product is ClassPay, a Nigerian edtech platform that charges schools ₦25,000/month for Basic and ₦75,000/month for Pro. The backend is Laravel. The goal is recurring billing with zero custom billing logic.",
              },
              {
                type: "p",
                text: "The same pattern applies to any Nigerian SaaS, membership platform, creator tool, or API business. The product changes. The integration is identical every time.",
              },
              {
                type: "h2",
                text: "Step 1: Create your plans",
                id: "guide-plans",
              },
              {
                type: "p",
                text: "Log into the Tori dashboard, go to Plans, and create one plan for each pricing tier. ClassPay creates two:",
              },
              {
                type: "code",
                lang: "json",
                code: `// Basic plan
{
  "name": "Basic",
  "amount": 2500000,
  "interval": "monthly",
  "trial_period_days": 14
}

// Pro plan
{
  "name": "Pro",
  "amount": 7500000,
  "interval": "monthly",
  "trial_period_days": 14
}`,
              },
              {
                type: "p",
                text: "Copy the plan IDs from the response and store them in your environment config alongside your API key and webhook secret:",
              },
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
                text: "Step 2: Create your API key",
                id: "guide-apikey",
              },
              {
                type: "p",
                text: "Go to API Keys in the dashboard, click Create key, name it something meaningful like Production server, and copy the key immediately. It is shown once. Store it in your secret manager or environment config. Never put it in client-side code.",
              },
              {
                type: "h2",
                text: "Step 3: Wire signup into Tori",
                id: "guide-signup",
              },
              {
                type: "p",
                text: "When a school completes registration and picks a plan, your backend makes one call to Tori. Pass the school's email, the plan ID, and your own database ID as the external_id. Tori finds or creates the customer and starts the subscription automatically.",
              },
              {
                type: "code",
                lang: "php",
                code: `// SchoolRegistrationController.php

public function complete(Request $request)
{
    // Create the school in your own database
    $school = School::create([
        'name'  => $request->name,
        'email' => $request->email,
        'plan'  => $request->plan,
    ]);

    // Start their Tori subscription in one call
    $planId = $request->plan === 'pro'
        ? env('TORI_PLAN_PRO')
        : env('TORI_PLAN_BASIC');

    $response = Http::withHeaders([
        'X-API-Key'    => env('TORI_API_KEY'),
        'Content-Type' => 'application/json',
    ])->post('https://api.tori.ng/v1/platform/checkout', [
        'email'           => $school->email,
        'plan_id'         => $planId,
        'name'            => $school->name,
        'external_id'     => (string) $school->id,
        'idempotency_key' => 'signup_' . $school->id,
    ]);

    // Store Tori subscription ID for later reference
    $school->update([
        'tori_subscription_id' => $response['data']['subscription']['id'],
    ]);

    // Grant trial access
    $school->update(['access' => 'trial']);

    return redirect()->route('dashboard');
}`,
              },
              {
                type: "callout",
                variant: "info",
                text: "The idempotency_key prevents duplicate subscriptions if your server retries the request due to a timeout. Use a value that is unique per signup attempt, such as your own user ID prefixed with the action name.",
              },
              {
                type: "h2",
                text: "Step 4: Listen for webhooks",
                id: "guide-webhooks",
              },
              {
                type: "p",
                text: "Register your webhook URL in the Tori dashboard under Webhooks. Tori sends a signed POST request to your server every time a billing event happens. Your handler verifies the signature and updates your local state accordingly.",
              },
              {
                type: "p",
                text: "The key insight is that you never call Tori on every request to check subscription status. You store the state locally when Tori sends the webhook, and read from your own database on every request. Fast, no external dependency on the hot path.",
              },
              {
                type: "code",
                lang: "php",
                code: `// ToriWebhookController.php

public function handle(Request $request)
{
    // Always verify the signature first
    $signature = $request->header('X-Tori-Signature');
    $payload   = $request->getContent();
    $expected  = 'sha256=' . hash_hmac(
        'sha256',
        $payload,
        env('TORI_WEBHOOK_SECRET')
    );

    if (!hash_equals($expected, $signature)) {
        return response('Invalid signature', 401);
    }

    $event  = $request->json()->all();
    $school = School::where(
        'tori_subscription_id',
        $event['data']['id']
    )->first();

    if (!$school) {
        return response('ok', 200);
    }

    switch ($event['event_type']) {

        case 'subscription.activated':
            // Trial ended, first payment succeeded
            $school->update([
                'access'              => 'full',
                'subscription_status' => 'active',
                'payment_warning'     => false,
            ]);
            break;

        case 'payment.failed':
            // Charge failed, Tori will retry
            $school->update(['payment_warning' => true]);
            break;

        case 'dunning.started':
            // Retries underway, soft restriction
            $school->update(['access' => 'restricted']);
            break;

        case 'dunning.recovered':
            // Retry succeeded, restore full access
            $school->update([
                'access'          => 'full',
                'payment_warning' => false,
            ]);
            break;

        case 'dunning.exhausted':
            // All retries failed, suspend access
            $school->update([
                'access'              => 'suspended',
                'subscription_status' => 'suspended',
            ]);
            break;

        case 'subscription.cancelled':
            $school->update([
                'access'              => 'none',
                'subscription_status' => 'cancelled',
            ]);
            break;

        case 'subscription.paused':
            $school->update(['access' => 'paused']);
            break;

        case 'subscription.resumed':
            $school->update(['access' => 'full']);
            break;
    }

    // Always return 200 immediately
    // Do heavy work (emails, etc.) asynchronously
    return response('ok', 200);
}`,
              },
              {
                type: "h2",
                text: "Step 5: Access control",
                id: "guide-access",
              },
              {
                type: "p",
                text: "Every route that requires an active subscription checks one field in your database. You stored it when the webhook arrived. No API call on the hot path.",
              },
              {
                type: "code",
                lang: "php",
                code: `// Middleware: CheckSubscriptionAccess.php

public function handle(Request $request, Closure $next)
{
    $school = auth()->user()->school;

    match ($school->access) {
        'suspended' => redirect()->route('billing.suspended'),
        'none'      => redirect()->route('billing.cancelled'),
        'restricted' => tap($next($request), function () {
            session(['billing_warning' => true]);
        }),
        default     => $next($request),
    };
}`,
              },
              {
                type: "h2",
                text: "Step 6: Let customers manage their subscription",
                id: "guide-selfserve",
              },
              {
                type: "p",
                text: "When a school admin wants to pause or cancel, your backend calls Tori. Tori fires the webhook. Your webhook handler updates local state. The school sees the change immediately on their next page load.",
              },
              {
                type: "code",
                lang: "php",
                code: `// BillingController.php

public function pause(Request $request)
{
    $school = auth()->user()->school;

    Http::withHeaders(['X-API-Key' => env('TORI_API_KEY')])
        ->post(
            "https://api.tori.ng/v1/platform/subscriptions"
            . "/{$school->tori_subscription_id}/pause"
        );

    // Tori fires subscription.paused
    // Your webhook handler updates access to 'paused'
    return back()->with('message', 'Subscription paused.');
}

public function cancel(Request $request)
{
    $school = auth()->user()->school;

    Http::withHeaders(['X-API-Key' => env('TORI_API_KEY')])
        ->post(
            "https://api.tori.ng/v1/platform/subscriptions"
            . "/{$school->tori_subscription_id}/cancel"
        );

    return back()->with('message', 'Subscription cancelled.');
}`,
              },
              {
                type: "h2",
                text: "What Tori handles automatically from this point",
                id: "guide-auto",
              },
              {
                type: "list",
                items: [
                  "Charges the school every month via Nomba on the correct date with correct month-end handling",
                  "When a charge fails, classifies the reason: blocked card stops immediately, insufficient funds retries on Day 3, 7, 14, and 21",
                  "Fires webhooks to your server for every state change so ClassPay reacts without polling",
                  "Writes every charge, refund, and adjustment to the immutable ledger",
                  "Computes MRR, churn rate, and dunning recovery rate visible on your Tori dashboard",
                  "Transitions the subscription through the full lifecycle: TRIALING to ACTIVE to DUNNING to SUSPENDED or back to ACTIVE on recovery",
                ],
              },
              {
                type: "h2",
                text: "What you never had to build",
                id: "guide-never",
              },
              {
                type: "list",
                items: [
                  "No cron job for monthly charges",
                  "No retry logic for failed payments",
                  "No Nigerian card failure classification",
                  "No dunning schedule or payday-aware retry timing",
                  "No revenue reporting or MRR calculation",
                  "No immutable ledger or audit trail",
                  "No webhook delivery system",
                ],
              },
              {
                type: "callout",
                variant: "success",
                text: "You built ClassPay. Tori handled billing. The same four-step pattern (create plans, wire signup, handle webhooks, control access) works for any Nigerian product charging recurring revenue.",
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
                text: "The same integration pattern in Node.js with Express. One checkout call at signup, one webhook handler for all billing events.",
              },
              { type: "h2", text: "Signup", id: "node-signup" },
              {
                type: "code",
                lang: "js",
                code: `// routes/auth.js

router.post('/register', async (req, res) => {
  const { name, email, plan } = req.body;

  // Create user in your database
  const user = await db.users.create({ name, email, plan });

  const planId = plan === 'pro'
    ? process.env.TORI_PLAN_PRO
    : process.env.TORI_PLAN_BASIC;

  // Start subscription in one call
  const toriRes = await fetch(
    'https://api.tori.ng/v1/platform/checkout',
    {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.TORI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        plan_id: planId,
        name,
        external_id: String(user.id),
        idempotency_key: \`signup_\${user.id}\`,
      }),
    }
  );

  const { data } = await toriRes.json();

  await db.users.update(user.id, {
    tori_subscription_id: data.subscription.id,
    access: 'trial',
  });

  res.json({ success: true });
});`,
              },
              { type: "h2", text: "Webhook handler", id: "node-webhooks" },
              {
                type: "code",
                lang: "js",
                code: `// routes/webhooks.js
const crypto = require('crypto');

router.post('/tori', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-tori-signature'];
  const expected  = 'sha256=' + crypto
    .createHmac('sha256', process.env.TORI_WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  )) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(req.body);
  const user  = await db.users.findBy({
    tori_subscription_id: event.data.id
  });

  if (!user) return res.status(200).send('ok');

  const accessMap = {
    'subscription.activated': 'full',
    'dunning.recovered':      'full',
    'subscription.resumed':   'full',
    'dunning.started':        'restricted',
    'subscription.paused':    'paused',
    'dunning.exhausted':      'suspended',
    'subscription.cancelled': 'none',
  };

  if (accessMap[event.event_type]) {
    await db.users.update(user.id, {
      access: accessMap[event.event_type],
    });
  }

  if (event.event_type === 'payment.failed') {
    await db.users.update(user.id, { payment_warning: true });
  }

  // Always 200 immediately
  res.status(200).send('ok');
});`,
              },
              {
                type: "callout",
                variant: "warn",
                text: "Pass the raw request body to the HMAC function, not the parsed JSON. Express parses the body before your handler runs. Use express.raw() on the webhook route specifically, or store the raw body in a middleware before parsing.",
              },
            ],
          },
          {
            id: "guide-checklist",
            label: "Integration checklist",
            icon: "ti-checklist",
            blocks: [
              {
                type: "p",
                text: "Use this checklist before going live with a Tori integration.",
              },
              { type: "h2", text: "Setup", id: "checklist-setup" },
              {
                type: "list",
                items: [
                  "API key created from the dashboard and stored in secret manager, not in source code",
                  "Webhook endpoint registered in the Tori dashboard with the correct URL",
                  "Webhook secret stored in environment config",
                  "Plan IDs stored in environment config",
                  "Tori subscription ID stored against each user or account in your database",
                ],
              },
              { type: "h2", text: "Signup flow", id: "checklist-signup" },
              {
                type: "list",
                items: [
                  "Checkout call made server-side, never from the browser",
                  "Idempotency key passed on every checkout call",
                  "external_id set to your own user or account ID",
                  "Tori subscription ID saved to your database after checkout",
                  "Initial access state set to trial if plan has a trial period",
                ],
              },
              { type: "h2", text: "Webhook handler", id: "checklist-webhooks" },
              {
                type: "list",
                items: [
                  "Signature verified on every incoming webhook before processing",
                  "Handler returns 200 immediately and processes events asynchronously",
                  "Handler is idempotent: processing the same event twice produces the same result",
                  "All relevant event types handled: activated, failed, dunning started, dunning recovered, dunning exhausted, paused, resumed, cancelled",
                  "Local access state updated in your database on each event",
                ],
              },
              { type: "h2", text: "Access control", id: "checklist-access" },
              {
                type: "list",
                items: [
                  "Subscription status read from your own database, not from Tori API on every request",
                  "Suspended and cancelled states block access to paid features",
                  "Restricted state shows a payment warning without fully blocking access",
                  "Trial state shows remaining trial days",
                ],
              },
              { type: "h2", text: "Before go-live", id: "checklist-golive" },
              {
                type: "list",
                items: [
                  "Test the full dunning flow using test cards in the sandbox",
                  "Verify webhook signature verification rejects tampered payloads",
                  "Confirm idempotency: calling checkout twice with the same key returns the same subscription",
                  "Confirm access is suspended when dunning exhausted fires",
                  "Confirm access is restored when dunning recovered fires",
                  "Check that cancelled subscriptions cannot be reactivated",
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
                text: "Every call to the Platform API must include your secret API key. This key is how Tori knows which account is making the request and which customers and plans belong to that account.",
              },
              {
                type: "p",
                text: "You receive your key automatically when you create a Tori account. It is shown exactly once on the screen immediately after signup. If you miss it, you will need to rotate the key and get a new one.",
              },
              {
                type: "callout",
                variant: "warn",
                text: "Your API key is shown only once. Copy it into a password manager or secret storage system immediately. Tori stores only a hash of the key and cannot show it to you again. If you lose it, rotate it from the dashboard the old key stops working immediately.",
              },
              { type: "h2", text: "What the key looks like", id: "format" },
              {
                type: "p",
                text: "Live keys always start with `tori_live_` followed by a UUID. This prefix makes it easy to identify and helps you avoid accidentally committing keys to source control.",
              },
              {
                type: "code",
                lang: "bash",
                code: "tori_live_3f9a2c71-8b4e-4d2a-9c1f-7e5d8a0b6c34",
              },
              { type: "h2", text: "How to use it", id: "using" },
              {
                type: "p",
                text: "Add your key to every Platform API request in the `X-API-Key` header. There is no OAuth flow, no token exchange just the key in the header, and the request authenticates.",
              },
              {
                type: "code",
                lang: "bash",
                code: `curl ${BASE}/v1/platform/plans \\\n  -H "X-API-Key: tori_live_..." \\\n  -H "Content-Type: application/json"`,
              },
              { type: "h2", text: "Keeping it secret", id: "secret" },
              {
                type: "p",
                text: "Your API key should only exist in two places: your secret manager, and your backend server's environment variables. It should never be in your frontend code, your mobile app, a public GitHub repository, or sent to a user's browser. Anyone who has your key can create subscriptions, access customer data, and read your financial records.",
              },
              {
                type: "callout",
                variant: "info",
                text: "The dashboard uses a separate JWT-based authentication system precisely so your secret API key never has to touch a browser. The Platform API key is for your server. The dashboard is for your team.",
              },
              { type: "h2", text: "Rotating your key", id: "rotating" },
              {
                type: "p",
                text: "If you suspect your key has been compromised, rotate it immediately from the dashboard under API Keys. When you rotate, Tori generates a new key and the old one stops working at that exact moment. Deploy the new key to your server before rotating if you want to avoid any downtime.",
              },
            ],
          },
          {
            id: "auth",
            label: "Authenticate",
            icon: "ti-lock",
            blocks: [
              {
                type: "p",
                text: "Tori has two separate authentication systems. They exist for different purposes and you will use both one for your server code, one for your team's dashboard access.",
              },
              {
                type: "h2",
                text: "Platform API for your server",
                id: "platform-auth",
              },
              {
                type: "p",
                text: "Your backend code uses the secret API key in the `X-API-Key` header. This is the authentication method for creating customers, starting subscriptions, and reading billing data programmatically. It is a simple, stateless header no sessions, no tokens, no expiry.",
              },
              {
                type: "code",
                lang: "bash",
                code: `curl ${BASE}/v1/platform/subscriptions \\\n  -H "X-API-Key: tori_live_..." \\\n  -d '{ "customer_id": "cus_...", "plan_id": "plan_..." }'`,
              },
              {
                type: "h2",
                text: "Dashboard API for your team",
                id: "dashboard-auth",
              },
              {
                type: "p",
                text: "When you log into the Tori dashboard, you receive a short-lived JWT access token. This token is used for dashboard API calls viewing subscriptions, reading metrics, managing webhooks. It expires after 15 minutes, at which point it is exchanged for a new one using the refresh token.",
              },
              {
                type: "code",
                lang: "bash",
                code: `POST ${BASE}/v1/auth/login\n{ "email": "you@business.ng", "password": "your-password" }\n\n# Response\n{\n  "data": {\n    "access_token": "eyJ...",\n    "refresh_token": "eyJ...",\n    "token_type": "Bearer"\n  }\n}`,
              },
              {
                type: "p",
                text: "Pass the access token in the `Authorization: Bearer` header on dashboard API calls.",
              },
              {
                type: "table",
                headers: ["Auth method", "Header", "Where to use", "Expires"],
                rows: [
                  [
                    "API key",
                    "X-API-Key: tori_live_...",
                    "Your server backend",
                    "Never (until rotated)",
                  ],
                  [
                    "JWT access token",
                    "Authorization: Bearer eyJ...",
                    "Dashboard API calls",
                    "15 minutes",
                  ],
                  [
                    "Refresh token",
                    "POST /v1/auth/refresh",
                    "Get a new access token",
                    "7 days",
                  ],
                ],
              },
              {
                type: "callout",
                variant: "warn",
                text: "Never use the JWT access token from your server code, and never put the secret API key in browser code. The separation exists deliberately your API key has full account access and must stay server-side only.",
              },
            ],
          },
          {
            id: "first",
            label: "First integration",
            icon: "ti-rocket",
            blocks: [
              {
                type: "p",
                text: "This page walks through the complete happy path from nothing to a live, billing subscription with every request and response shown. Follow these steps in order and you will have working recurring billing in under an hour.",
              },
              {
                type: "callout",
                variant: "info",
                text: "All amounts in Tori are in kobo the smallest unit of the Naira. ₦15,000 is 1500000 kobo. This eliminates floating point errors in financial calculations. Always send and receive amounts in kobo.",
              },
              { type: "h2", text: "Step 1 Create a plan", id: "step-1" },
              {
                type: "p",
                text: "A plan defines what you charge and how often. Create one plan for each pricing tier you offer. Plans are reusable one plan can have thousands of subscribers.",
              },
              {
                type: "code",
                lang: "bash",
                code: `curl ${BASE}/v1/platform/plans \\\n  -H "X-API-Key: tori_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Pro",\n    "amount": 1500000,\n    "interval": "monthly",\n    "trial_period_days": 14\n  }'`,
              },
              {
                type: "code",
                lang: "json",
                code: `{\n  "data": {\n    "id": "plan_8f3a2c71-...",\n    "name": "Pro",\n    "amount": 1500000,\n    "currency": "NGN",\n    "interval": "monthly",\n    "interval_count": 1,\n    "trial_period_days": 14,\n    "is_active": true\n  }\n}`,
              },
              {
                type: "p",
                text: "Save the `id` from the response. You will use it when creating subscriptions.",
              },
              { type: "h2", text: "Step 2 Create a customer", id: "step-2" },
              {
                type: "p",
                text: "When a user signs up on your product, create a matching customer in Tori. The `external_id` field is your own identifier for this user typically your database user ID. Tori keeps it so you can always find the right customer without storing Tori's IDs in your database.",
              },
              {
                type: "code",
                lang: "bash",
                code: `curl ${BASE}/v1/platform/customers \\\n  -H "X-API-Key: tori_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "email": "amaka@startup.ng",\n    "name": "Amaka Obi",\n    "external_id": "user_12345"\n  }'`,
              },
              {
                type: "code",
                lang: "json",
                code: `{\n  "data": {\n    "id": "cus_9b4e7d21-...",\n    "email": "amaka@startup.ng",\n    "name": "Amaka Obi",\n    "external_id": "user_12345"\n  }\n}`,
              },
              { type: "h2", text: "Step 3 Start a subscription", id: "step-3" },
              {
                type: "p",
                text: "Link the customer to the plan. This single call starts the billing relationship. If the plan has a trial period, the subscription starts in TRIALING state and no charge is attempted until the trial ends. If there is no trial, the subscription starts ACTIVE and the first charge happens immediately.",
              },
              {
                type: "code",
                lang: "bash",
                code: `curl ${BASE}/v1/platform/subscriptions \\\n  -H "X-API-Key: tori_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "customer_id": "cus_9b4e7d21-...",\n    "plan_id": "plan_8f3a2c71-...",\n    "idempotency_key": "signup_user_12345"\n  }'`,
              },
              {
                type: "code",
                lang: "json",
                code: `{\n  "data": {\n    "id": "sub_2b71c4e9-...",\n    "status": "TRIALING",\n    "current_period_start": "2026-06-20T00:00:00Z",\n    "current_period_end": "2026-07-04T00:00:00Z"\n  }\n}`,
              },
              {
                type: "callout",
                variant: "success",
                text: "That is the complete setup. Tori now manages this customer's billing indefinitely. The next charge attempts automatically when the trial ends. You do not need to do anything else unless you want to cancel, pause, or change the subscription.",
              },
              { type: "h2", text: "Step 4 Listen for webhooks", id: "step-4" },
              {
                type: "p",
                text: "Register a webhook endpoint so Tori can notify your product when billing events happen. Your product listens for these events and reacts for example, by unlocking access when a subscription activates, or restricting access when a payment fails.",
              },
              {
                type: "code",
                lang: "bash",
                code: `curl ${BASE}/v1/webhooks/endpoints \\\n  -H "Authorization: Bearer eyJ..." \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "url": "https://yourapp.ng/webhooks/tori",\n    "events": ["*"]\n  }'`,
              },
              {
                type: "p",
                text: "The response includes a `secret`. Save it immediately it is never shown again. You use it to verify that webhook deliveries are genuinely from Tori and not from a third party.",
              },
              {
                type: "h2",
                text: "Step 5 React to events in your product",
                id: "step-5",
              },
              {
                type: "p",
                text: "Your webhook handler receives events and updates your product accordingly. Here is what a minimal handler looks like:",
              },
              {
                type: "code",
                lang: "js",
                code: `app.post('/webhooks/tori', (req, res) => {\n  // Always verify the signature first\n  const sig = req.headers['tori-signature'];\n  if (!verifySignature(req.body, sig, process.env.TORI_WEBHOOK_SECRET)) {\n    return res.status(401).send('Invalid signature');\n  }\n\n  const event = req.body;\n\n  switch (event.type) {\n    case 'subscription.activated':\n      // Unlock full access for this customer\n      await db.users.update({ toriCustomerId: event.customer_id }, { access: 'full' });\n      break;\n\n    case 'payment.failed':\n      // Show payment warning, restrict some features\n      await db.users.update({ toriCustomerId: event.customer_id }, { access: 'restricted' });\n      break;\n\n    case 'dunning.recovered':\n      // Payment came through on a retry restore access\n      await db.users.update({ toriCustomerId: event.customer_id }, { access: 'full' });\n      break;\n\n    case 'subscription.cancelled':\n      // Customer cancelled offboard gracefully\n      await offboardCustomer(event.customer_id);\n      break;\n  }\n\n  // Always respond 200 quickly, do work asynchronously\n  res.status(200).send('ok');\n});`,
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
            label: "Plans & pricing",
            icon: "ti-file-text",
            blocks: [
              {
                type: "p",
                text: "A plan is a pricing template. It defines three things: how much you charge, how often you charge it, and whether new subscribers get a free trial. Plans are reusable you create a plan once and any number of customers can subscribe to it.",
              },
              {
                type: "p",
                text: "Plans are separate from subscriptions deliberately. If you change the price on a plan, existing subscribers are not affected they stay on what they signed up for. New subscribers get the new price. This is the correct behaviour for subscription businesses: you honour the price your customer agreed to.",
              },
              { type: "h2", text: "Billing intervals", id: "intervals" },
              {
                type: "p",
                text: "Tori supports three billing intervals. Monthly and annual are self-explanatory. Custom is for anything else school fees charged every 120 days, quarterly retainers, bimonthly memberships.",
              },
              {
                type: "table",
                headers: [
                  "Interval",
                  "When the customer is charged",
                  "When to use it",
                ],
                rows: [
                  [
                    "monthly",
                    "Once per calendar month",
                    "Most SaaS products, memberships, subscriptions",
                  ],
                  [
                    "annual",
                    "Once per year",
                    "Annual plans with a discount vs monthly",
                  ],
                  [
                    "custom",
                    "Every N days you specify",
                    "Termly fees, quarterly billing, non-standard cycles",
                  ],
                ],
              },
              {
                type: "callout",
                variant: "info",
                text: "Month-end billing is handled correctly. A subscription that starts on January 31 renews on February 28 (or 29 in a leap year), then March 31. It never skips a month or drift to an earlier date over time. This is a surprisingly common bug in custom billing implementations.",
              },
              { type: "h2", text: "Trial periods", id: "trials" },
              {
                type: "p",
                text: "Set `trial_period_days` to give new subscribers a free trial. During the trial, the subscription is in `TRIALING` state and no charge is attempted. When the trial ends, Tori automatically transitions the subscription to `ACTIVE` and runs the first charge.",
              },
              {
                type: "p",
                text: "Trial boundaries are recorded in the ledger as `TRIAL_START` and `TRIAL_END` entries, so your reporting clearly shows which revenue came from converted trials.",
              },
              { type: "h2", text: "Full plan object", id: "object" },
              {
                type: "code",
                lang: "json",
                code: `{\n  "id": "plan_8f3a2c71-...",\n  "name": "Pro",\n  "amount": 1500000,\n  "currency": "NGN",\n  "interval": "monthly",\n  "interval_count": 1,\n  "trial_period_days": 14,\n  "is_active": true,\n  "created_at": "2026-06-01T00:00:00Z"\n}`,
              },
              { type: "h2", text: "Deactivating a plan", id: "deactivate" },
              {
                type: "p",
                text: "Deactivating a plan stops new subscriptions from using it. Existing subscribers on that plan keep billing normally deactivation does not cancel any subscriptions. Use this when you retire an old pricing tier.",
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
                text: "A subscription is the live billing relationship between one customer and one plan. It is the central object in Tori everything else exists to support it. A subscription has a status that changes over time based on payment outcomes and deliberate actions.",
              },
              {
                type: "h2",
                text: "The subscription lifecycle",
                id: "lifecycle",
              },
              {
                type: "p",
                text: "When you create a subscription, it starts in one of two states depending on whether the plan has a trial: `TRIALING` if there is a trial period, `ACTIVE` immediately if not. From there, the status changes automatically based on what happens with payments, or deliberately when you or the customer takes an action.",
              },
              { type: "h2", text: "Reading a subscription", id: "reading" },
              {
                type: "code",
                lang: "json",
                code: `{\n  "id": "sub_2b71c4e9-...",\n  "customer_id": "cus_9b4e7d21-...",\n  "plan_id": "plan_8f3a2c71-...",\n  "status": "DUNNING",\n  "current_period_start": "2026-06-01T00:00:00Z",\n  "current_period_end": "2026-07-01T00:00:00Z",\n  "dunning_attempt": 2,\n  "next_retry_at": "2026-06-27T00:00:00Z"\n}`,
              },
              {
                type: "p",
                text: "`dunning_attempt` tells you how many retries have been made on the current failed cycle. If it is 0, the subscription is current. If it is greater than 0, a payment failed and retries are in progress. `next_retry_at` tells you when the next retry will be attempted.",
              },
              {
                type: "h2",
                text: "Taking actions on a subscription",
                id: "actions",
              },
              {
                type: "p",
                text: "You can take three deliberate actions on a subscription: pause, resume, or cancel. Each is a simple POST request.",
              },
              {
                type: "table",
                headers: ["Action", "What it does", "Can it be undone?"],
                rows: [
                  [
                    "Pause",
                    "Stops billing temporarily. The subscription record is kept. The customer retains access if your product allows it.",
                    "Yes resume restarts billing",
                  ],
                  [
                    "Resume",
                    "Restarts billing from a paused state. The next charge happens on the next normal billing cycle.",
                    "N/A",
                  ],
                  [
                    "Cancel",
                    "Permanently ends the subscription. No more charges. The record remains for auditing.",
                    "No cancellation is final",
                  ],
                ],
              },
              {
                type: "callout",
                variant: "warn",
                text: "Cancellation is permanent and enforced at the state machine level. A cancelled subscription cannot be reactivated. If a customer wants to come back after cancelling, create a new subscription for them. This prevents accidental reactivations and keeps your billing history clean.",
              },
              { type: "h2", text: "Idempotent creation", id: "idempotent" },
              {
                type: "p",
                text: "Always pass an `idempotency_key` when creating subscriptions. If your server retries the request due to a network timeout, the same key returns the original subscription instead of creating a duplicate. Use something unique per signup attempt for example, your own user ID combined with the plan ID.",
              },
              {
                type: "code",
                lang: "json",
                code: `{\n  "customer_id": "cus_...",\n  "plan_id": "plan_...",\n  "idempotency_key": "sub_user_12345_pro_plan"\n}`,
              },
            ],
          },
          {
            id: "states",
            label: "The state machine",
            icon: "ti-arrows-shuffle",
            blocks: [
              {
                type: "p",
                text: "Every subscription is always in exactly one of seven states. Tori enforces this with a pure state machine before any status change happens, the machine checks whether that transition is valid. If it is not, the request returns an error and nothing changes. This makes the system predictable: you can never end up in an impossible or inconsistent state.",
              },
              { type: "h2", text: "The seven states", id: "seven-states" },
              {
                type: "table",
                headers: ["State", "What it means", "Billing happening?"],
                rows: [
                  [
                    "TRIALING",
                    "The customer is in a free trial. No charge has been attempted yet.",
                    "No",
                  ],
                  [
                    "ACTIVE",
                    "The subscription is healthy. The customer is being charged on each cycle.",
                    "Yes",
                  ],
                  [
                    "PAST_DUE",
                    "A charge failed. The subscription is in a short grace period before dunning begins.",
                    "Paused",
                  ],
                  [
                    "DUNNING",
                    "Tori is actively retrying a failed payment on a schedule.",
                    "Retrying",
                  ],
                  [
                    "PAUSED",
                    "Billing has been deliberately suspended by you or the customer.",
                    "No",
                  ],
                  [
                    "SUSPENDED",
                    "All dunning retries were exhausted and the payment was never recovered.",
                    "No",
                  ],
                  [
                    "CANCELLED",
                    "The subscription has been permanently ended.",
                    "No",
                  ],
                ],
              },
              { type: "h2", text: "How states change", id: "transitions" },
              {
                type: "p",
                text: "Most state changes happen automatically based on payment outcomes. A few are triggered by deliberate actions.",
              },
              {
                type: "table",
                headers: [
                  "From state",
                  "What triggers the change",
                  "New state",
                ],
                rows: [
                  ["TRIALING", "Trial period ends", "ACTIVE"],
                  ["ACTIVE", "A charge fails", "PAST_DUE"],
                  ["PAST_DUE", "Grace period ends", "DUNNING"],
                  ["DUNNING", "A retry succeeds", "ACTIVE"],
                  ["DUNNING", "All retries exhausted", "SUSPENDED"],
                  ["ACTIVE", "You or customer calls /pause", "PAUSED"],
                  ["PAUSED", "You or customer calls /resume", "ACTIVE"],
                  [
                    "Any (except CANCELLED)",
                    "You or customer calls /cancel",
                    "CANCELLED",
                  ],
                ],
              },
              {
                type: "callout",
                variant: "success",
                text: "Because the state machine validates every transition, you will never accidentally charge a cancelled subscription, resume a subscription that was never paused, or end up in a state that does not make logical sense. The 28 unit tests covering the state machine ensure this behaviour is correct.",
              },
              {
                type: "h2",
                text: "What to do in your product for each state",
                id: "product-states",
              },
              {
                type: "table",
                headers: ["State", "Recommended product behaviour"],
                rows: [
                  ["TRIALING", "Full access. Show how many trial days remain."],
                  ["ACTIVE", "Full access. Nothing special needed."],
                  [
                    "PAST_DUE",
                    "Full access or soft restriction. Show a gentle payment warning.",
                  ],
                  [
                    "DUNNING",
                    "Restricted access. Show a clear payment failure message with a way to update the card.",
                  ],
                  [
                    "PAUSED",
                    "Restricted or suspended access depending on your product.",
                  ],
                  [
                    "SUSPENDED",
                    "Suspend access. Offer the customer a way to restart their subscription.",
                  ],
                  [
                    "CANCELLED",
                    "Revoke access. Offer a way to create a new subscription if they want to return.",
                  ],
                ],
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
                text: "Dunning is the process of recovering failed payments. When a subscription charge fails, Tori does not immediately give up. It classifies the failure, decides whether retrying makes sense, and schedules retries at the right times.",
              },
              {
                type: "p",
                text: "This matters enormously in Nigeria. A significant percentage of recurring payment failures are not because the customer cannot or will not pay. Cards get blocked for online transactions. Banks have outages. Salaries arrive on the 25th. A naive billing system that retries immediately and then gives up loses all of that recoverable revenue.",
              },
              {
                type: "h2",
                text: "How failure classification works",
                id: "classification",
              },
              {
                type: "p",
                text: "When a charge fails, Tori reads the failure code returned by Nomba and classifies it as either retriable or permanent.",
              },
              {
                type: "table",
                headers: ["Failure type", "Examples", "What Tori does"],
                rows: [
                  [
                    "Retriable",
                    "insufficient_funds, issuer_unavailable, transaction_timeout",
                    "Schedules a retry according to the dunning schedule",
                  ],
                  [
                    "Permanent",
                    "card_expired, card_blocked, do_not_honour",
                    "Stops retrying immediately and moves to notifying the customer",
                  ],
                ],
              },
              {
                type: "callout",
                variant: "info",
                text: "Nigerian-specific: many cards are issued with online transactions blocked by default. The bank returns a code that looks like a temporary failure but will never succeed. Tori treats these as permanent so you do not burn four retry slots and four Nomba transaction fees on a charge that has no chance of going through.",
              },
              { type: "h2", text: "The retry schedule", id: "retry-schedule" },
              {
                type: "p",
                text: "For retriable failures, Tori spaces retries to maximise recovery. The default schedule retries on Day 3, Day 7, Day 14, and Day 21 after the first failure. This spacing is deliberate it covers multiple payday windows for customers paid weekly, biweekly, or at month-end.",
              },
              {
                type: "table",
                headers: [
                  "Attempt",
                  "Days after first failure",
                  "Why this timing",
                ],
                rows: [
                  [
                    "Attempt 1",
                    "Day 3",
                    "Early retry catches short-term issues like temporary bank outages",
                  ],
                  ["Attempt 2", "Day 7", "Covers customers paid weekly"],
                  ["Attempt 3", "Day 14", "Covers biweekly salary cycles"],
                  [
                    "Attempt 4",
                    "Day 21",
                    "Final attempt before suspension, covers late-month salaries",
                  ],
                ],
              },
              {
                type: "p",
                text: "After the fourth attempt, if the payment has still not succeeded, the subscription moves to `SUSPENDED`. The customer retains their data but loses access until they update their payment method and restart the subscription.",
              },
              {
                type: "h2",
                text: "What dunning recovery means in money",
                id: "money",
              },
              {
                type: "p",
                text: "If your product has 500 active subscribers at ₦10,000/month, and 8% of charges fail in a given month, that is ₦400,000 at risk. Without intelligent dunning, much of that is lost. With Tori's payday-aware retry schedule and Nigerian failure classification, a substantial share of those failures resolve on their own often because funds simply became available after payday.",
              },
              { type: "h2", text: "Dunning configuration", id: "config" },
              {
                type: "p",
                text: "The dunning schedule, maximum retry count, and what happens after retries are exhausted (suspend vs cancel) are all configurable per tenant in your settings. You can also configure whether Tori sends email notifications to the customer or just to you when dunning starts.",
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
                text: "The Tori ledger is an append-only record of every financial event in your billing account. Every charge, refund, credit, proration, and adjustment writes one immutable row. Nothing is ever edited or deleted.",
              },
              {
                type: "p",
                text: "This is not an accounting approximation. It is the authoritative source of truth for every naira that has ever moved through your billing system. Your MRR, churn, and revenue numbers are computed directly from this ledger.",
              },
              { type: "h2", text: "Why append-only matters", id: "why" },
              {
                type: "p",
                text: "Most billing systems store a balance or a summary that gets updated whenever something changes. The problem is that if a bug causes a wrong update, you have no way to know what the correct number should be the history is gone. The Tori ledger never updates existing rows. Every correction writes a new row. This means you can always reconstruct the full history of how any number was arrived at.",
              },
              {
                type: "callout",
                variant: "success",
                text: "When an investor asks 'where does this ₦4.2M MRR number come from?', you can show them the exact 847 charge entries behind it, each with a timestamp, customer, and subscription reference. That is auditable financial history.",
              },
              { type: "h2", text: "Entry types", id: "entries" },
              {
                type: "table",
                headers: ["Entry type", "When it's written", "Direction"],
                rows: [
                  [
                    "CHARGE",
                    "A successful subscription charge went through",
                    "DEBIT (money in)",
                  ],
                  [
                    "REFUND",
                    "A refund was issued to a customer",
                    "CREDIT (money out)",
                  ],
                  [
                    "CREDIT",
                    "A manual credit was applied to a customer's account",
                    "CREDIT",
                  ],
                  [
                    "PRORATION",
                    "A mid-cycle plan change created a charge or credit",
                    "DEBIT or CREDIT",
                  ],
                  [
                    "TRIAL_START",
                    "A customer's trial period began",
                    "Audit marker, zero amount",
                  ],
                  [
                    "TRIAL_END",
                    "A customer's trial period ended",
                    "Audit marker, zero amount",
                  ],
                  [
                    "OVERRIDE",
                    "An admin made a manual correction, with a required reason",
                    "DEBIT or CREDIT",
                  ],
                ],
              },
              { type: "h2", text: "Reading the ledger", id: "reading" },
              {
                type: "p",
                text: "You can query the ledger by date range, by customer, or by subscription. The summary endpoint gives you totals for any period.",
              },
              {
                type: "code",
                lang: "bash",
                code: `GET ${BASE}/v1/ledger/summary?from=2026-06-01&to=2026-06-30\n\n{\n  "data": {\n    "total_charged": 42000000,\n    "total_refunded": 1500000,\n    "net_revenue": 40500000,\n    "entry_count": 312,\n    "currency": "NGN"\n  }\n}`,
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
                text: "Webhooks are how Tori tells your product what happened. When a subscription activates, a payment fails, a retry recovers a payment, or a customer cancels Tori sends an HTTP POST request to your server with the event details. Your server processes the event and updates your product accordingly.",
              },
              {
                type: "p",
                text: "Think of webhooks as the real-time communication channel between Tori and your product. Without webhooks, your product has no way to know when billing events happen unless it polls the API constantly. Webhooks are push-based Tori notifies you the moment something happens.",
              },
              { type: "h2", text: "The complete event list", id: "events" },
              {
                type: "table",
                headers: [
                  "Event",
                  "When it fires",
                  "What your product should do",
                ],
                rows: [
                  [
                    "subscription.activated",
                    "Trial ends and first charge succeeds, or subscription starts with no trial",
                    "Unlock full access",
                  ],
                  [
                    "subscription.paused",
                    "You or the customer paused the subscription",
                    "Restrict access as appropriate",
                  ],
                  [
                    "subscription.resumed",
                    "You or the customer resumed a paused subscription",
                    "Restore access",
                  ],
                  [
                    "subscription.cancelled",
                    "The subscription was permanently cancelled",
                    "Offboard the customer gracefully",
                  ],
                  [
                    "subscription.suspended",
                    "All dunning retries were exhausted",
                    "Suspend access, prompt the customer to update payment",
                  ],
                  [
                    "payment.succeeded",
                    "A charge went through successfully",
                    "Send a receipt, log the payment",
                  ],
                  [
                    "payment.failed",
                    "A charge failed",
                    "Show the customer a payment failure message",
                  ],
                  [
                    "payment.retrying",
                    "A retry is scheduled after a failure",
                    "Optionally notify the customer that you are retrying",
                  ],
                  [
                    "dunning.started",
                    "The first retry has been scheduled",
                    "Show a soft warning in your product",
                  ],
                  [
                    "dunning.recovered",
                    "A retry charge succeeded after one or more failures",
                    "Restore full access, send confirmation",
                  ],
                  [
                    "dunning.exhausted",
                    "All retries failed, subscription moving to SUSPENDED",
                    "Suspend access, send urgent notification",
                  ],
                ],
              },
              { type: "h2", text: "Verifying signatures", id: "verify" },
              {
                type: "p",
                text: "Every webhook delivery includes a `Tori-Signature` header containing an HMAC-SHA256 signature of the request body. Always verify this signature before processing the event. This ensures the request genuinely came from Tori and was not tampered with.",
              },
              {
                type: "code",
                lang: "js",
                code: `const crypto = require('crypto');\n\nfunction verifySignature(rawBody, signature, secret) {\n  const expected = crypto\n    .createHmac('sha256', secret)\n    .update(rawBody)  // use the raw request body bytes\n    .digest('hex');\n\n  // Use timing-safe comparison to prevent timing attacks\n  return crypto.timingSafeEqual(\n    Buffer.from(expected),\n    Buffer.from(signature)\n  );\n}`,
              },
              {
                type: "callout",
                variant: "warn",
                text: "Always respond with 200 immediately and process the event asynchronously. If your handler takes too long to respond, Tori treats it as a failure and schedules a retry. Duplicate events are possible design your handler to be idempotent.",
              },
            ],
          },
        ],
      },
      {
        group: "Dashboard Guide",
        items: [
          {
            id: "dashboard-overview",
            label: "Overview page",
            icon: "ti-layout-dashboard",
            blocks: [
              {
                type: "p",
                text: "The Overview page is the first thing you see after logging in. It gives you the full picture of your billing operation in one screen.",
              },
              {
                type: "h2",
                text: "Getting started checklist",
                id: "checklist",
              },
              {
                type: "p",
                text: "If you are new to Tori, the overview shows a four-step checklist: create a plan, subscribe a customer, add a webhook endpoint, and create an API key. Each step links directly to the relevant page. The checklist disappears once all four steps are complete.",
              },
              { type: "h2", text: "Metrics row", id: "metrics" },
              {
                type: "p",
                text: "The top row shows four live metrics: MRR (monthly recurring revenue from real ledger data), active subscription count, churn rate, and total revenue recovered by the dunning engine. These update in real time from your actual data.",
              },
              { type: "h2", text: "Revenue summary", id: "revenue-summary" },
              {
                type: "p",
                text: "Shows gross revenue, refunds, and net revenue for all time, computed directly from the immutable ledger. The entry count shows how many individual financial records exist in the system.",
              },
              { type: "h2", text: "Subscription states", id: "sub-states" },
              {
                type: "p",
                text: "A breakdown of all subscriptions by state: ACTIVE, TRIALING, DUNNING, PAUSED, CANCELLED. The bar chart shows the proportion visually. If you see a large DUNNING bar, check the Billing Health page immediately.",
              },
              {
                type: "h2",
                text: "Billing health widget",
                id: "health-widget",
              },
              {
                type: "p",
                text: "A score ring showing your portfolio health (0-100) alongside healthy, at-risk, and critical counts. Click View all to go to the full Billing Health page with per-subscription scores and churn predictions.",
              },
              { type: "h2", text: "Attention banner", id: "attention" },
              {
                type: "p",
                text: "If any subscriptions are in DUNNING, PAST_DUE, or showing high churn signals, a yellow banner appears at the top of the page. It tells you how many need attention and links directly to the Billing Health page.",
              },
              { type: "h2", text: "Recent subscriptions", id: "recent-subs" },
              {
                type: "p",
                text: "The last 8 subscriptions created, with customer email, plan, amount, status, and next billing date. If a subscription is in dunning, it shows the retry attempt number instead of the billing date.",
              },
            ],
          },
          {
            id: "dashboard-subscriptions",
            label: "Subscriptions page",
            icon: "ti-refresh",
            blocks: [
              {
                type: "p",
                text: "The Subscriptions page is where you manage all billing relationships. Every subscription that exists in Tori appears here.",
              },
              { type: "h2", text: "Filters", id: "sub-filters" },
              {
                type: "p",
                text: "Filter by state using the tab buttons at the top: ALL, ACTIVE, TRIALING, DUNNING, PAUSED, SUSPENDED, CANCELLED. Each tab shows the count. The search box filters by customer email or plan name.",
              },
              { type: "h2", text: "Creating a subscription", id: "sub-create" },
              {
                type: "p",
                text: "Click New subscription. Enter a customer email and select a plan. If the customer does not exist yet, Tori creates them automatically using the checkout endpoint. The External ID field is optional but useful if you want to link the Tori customer to your own database record.",
              },
              {
                type: "p",
                text: "After creation, a success banner confirms whether the customer was newly created or an existing customer was matched by email.",
              },
              { type: "h2", text: "Subscription actions", id: "sub-actions" },
              {
                type: "p",
                text: "Each row has action buttons based on the current state. ACTIVE subscriptions can be paused or cancelled. PAUSED subscriptions can be resumed. DUNNING subscriptions can be cancelled. All actions are validated against the state machine before executing.",
              },
              {
                type: "h2",
                text: "Dunning indicator",
                id: "dunning-indicator",
              },
              {
                type: "p",
                text: "The Dunning column shows the current retry attempt number for subscriptions in DUNNING state. Attempt 1 means one payment failure. Attempt 4 means the subscription is about to be suspended. Subscriptions with no payment issues show None.",
              },
            ],
          },
          {
            id: "dashboard-health",
            label: "Billing health page",
            icon: "ti-heartbeat",
            blocks: [
              {
                type: "p",
                text: "The Billing Health page gives you intelligence that no standard billing tool provides: a real-time health score for every active subscription, plus churn prediction signals before customers actually cancel.",
              },
              { type: "h2", text: "Portfolio score", id: "portfolio-score" },
              {
                type: "p",
                text: "The large score ring shows the average health score across all active subscriptions (0-100). Below 70 means your portfolio needs attention. Below 50 is a serious signal.",
              },
              {
                type: "h2",
                text: "How the score is computed",
                id: "score-calc",
              },
              {
                type: "list",
                items: [
                  "Starts at 100 for every subscription",
                  "DUNNING state: -40",
                  "SUSPENDED state: -60",
                  "PAST_DUE state: -20",
                  "PAUSED state: -10",
                  "Each dunning attempt adds additional deductions (-10, -20, -30, -40)",
                  "Subscription under 30 days old: -5 (unproven payment relationship)",
                  "Recovered from dunning but now active: -10 (history of failure)",
                  "Floor is 0, ceiling is 100",
                ],
              },
              { type: "h2", text: "Churn prediction", id: "churn-pred" },
              {
                type: "p",
                text: "The churn prediction panel shows subscriptions with HIGH or CRITICAL churn signals. For each at-risk subscription, Tori shows the specific reasons driving the signal and a recommended action.",
              },
              {
                type: "table",
                headers: ["Signal", "Meaning", "Recommended action"],
                rows: [
                  ["None", "No risk indicators detected", "No action needed"],
                  [
                    "Low",
                    "Minor signal, low probability of churn",
                    "Monitor next billing cycle",
                  ],
                  [
                    "Medium",
                    "Payment issues or history of failures",
                    "Send payment reminder",
                  ],
                  [
                    "High",
                    "Multiple risk factors active",
                    "Proactive outreach with payment help",
                  ],
                  [
                    "Critical",
                    "Subscription likely to churn",
                    "Contact customer immediately",
                  ],
                ],
              },
              { type: "h2", text: "Attention banner", id: "health-attention" },
              {
                type: "p",
                text: "The yellow banner at the top lists every subscription needing attention with customer chips showing email and churn signal. If more than 5 need attention, the banner shows the first 5 and a count of the rest.",
              },
              { type: "h2", text: "Full table", id: "health-table" },
              {
                type: "p",
                text: "The table shows all active subscriptions sorted by health score, lowest first. Columns: health score ring, customer email, plan name, state badge, churn risk badge, reason text, and period end date.",
              },
            ],
          },
          {
            id: "dashboard-customers",
            label: "Customers page",
            icon: "ti-users",
            blocks: [
              {
                type: "p",
                text: "The Customers page lists every customer in your Tori account. Customers are created automatically when you use the checkout endpoint, or manually from this page.",
              },
              {
                type: "h2",
                text: "Adding a customer manually",
                id: "add-customer",
              },
              {
                type: "p",
                text: "Click Add customer. Enter an email (required), name (optional), and External ID (optional). The External ID is your own database user ID. Store it so you can look up the Tori customer from your own system using GET /v1/platform/customers?external_id=your-id.",
              },
              {
                type: "callout",
                variant: "info",
                text: "Adding a customer here does not start a subscription. Go to Subscriptions and click New subscription to subscribe them to a plan, or use the checkout endpoint from your backend.",
              },
              {
                type: "h2",
                text: "Customer detail page",
                id: "customer-detail",
              },
              {
                type: "p",
                text: "Click any customer row to see their full detail page. Shows their subscriptions, plan values, active MRR, and dunning state. The Copy portal link button at the top right generates a 1-hour portal token and copies the full URL to your clipboard.",
              },
              { type: "h2", text: "Portal link", id: "portal-link" },
              {
                type: "p",
                text: "The portal link is a URL you send to your customer. When they open it, they see their subscription details and can pause, resume, or cancel without contacting you. In production, your backend generates this link automatically and either redirects the customer or emails it to them.",
              },
            ],
          },
          {
            id: "dashboard-plans",
            label: "Plans page",
            icon: "ti-file-text",
            blocks: [
              {
                type: "p",
                text: "Plans are pricing templates. You create a plan once and any number of customers can subscribe to it.",
              },
              { type: "h2", text: "Creating a plan", id: "create-plan" },
              {
                type: "p",
                text: "Click Create plan. Set the name, amount in naira (Tori converts to kobo automatically), billing interval, and trial period in days. Set trial days to 0 for no trial.",
              },
              {
                type: "callout",
                variant: "info",
                text: "Amounts are entered in naira on the dashboard but stored in kobo. ₦15,000 entered on the form is stored as 1500000 kobo. The API always works in kobo.",
              },
              { type: "h2", text: "Plan ID", id: "plan-id" },
              {
                type: "p",
                text: "Each plan card shows the plan ID with a Copy button. This is the ID you put in your server's environment config as TORI_PLAN_PRO or similar. You reference this ID in every checkout call.",
              },
              { type: "h2", text: "Billing intervals", id: "plan-intervals" },
              {
                type: "list",
                items: [
                  "Monthly: charge every calendar month with correct month-end handling (Jan 31 + 1 month = Feb 28, always)",
                  "Annual: charge every 12 months",
                  "Custom: charge every N days — for school fees, quarterly retainers, bimonthly memberships",
                ],
              },
              {
                type: "h2",
                text: "Deactivating a plan",
                id: "deactivate-plan",
              },
              {
                type: "p",
                text: "Deactivating a plan prevents new subscriptions from using it. Existing subscribers on that plan keep billing normally. Use this when retiring an old pricing tier.",
              },
            ],
          },
          {
            id: "dashboard-finance",
            label: "Finance page",
            icon: "ti-chart-bar",
            blocks: [
              {
                type: "p",
                text: "The Finance page shows your revenue, churn, and dunning recovery metrics across a selected time range. All numbers come from the immutable ledger.",
              },
              { type: "h2", text: "Date range selector", id: "date-range" },
              {
                type: "p",
                text: "The 7D / 30D / 90D / 1Y buttons at the top right control the time window for all metrics. MRR uses the current period. Churn, dunning recovery, and the ledger summary use the selected from/to range.",
              },
              { type: "h2", text: "Revenue forecast", id: "forecast" },
              {
                type: "p",
                text: "The forecast card projects next month's expected revenue in three estimates: low, mid, and high. The mid estimate is based on current active subscriptions plus expected dunning recovery. The confidence level (HIGH, MEDIUM, LOW) reflects how much historical data is available.",
              },
              {
                type: "table",
                headers: ["Estimate", "How computed"],
                rows: [
                  [
                    "Low",
                    "Base revenue minus expected losses from unresolved dunning",
                  ],
                  [
                    "Mid",
                    "Base revenue plus expected dunning recovery at historical rate",
                  ],
                  ["High", "Mid estimate plus 5% variance band"],
                ],
              },
              { type: "h2", text: "Ledger breakdown", id: "ledger-breakdown" },
              {
                type: "p",
                text: "Shows total charges, refunds, credits applied, and net revenue for the selected period. Every number traces back to individual immutable ledger entries.",
              },
            ],
          },
          {
            id: "dashboard-webhooks",
            label: "Webhooks page",
            icon: "ti-webhook",
            blocks: [
              {
                type: "p",
                text: "Webhooks are how Tori tells your product what happened. Register an endpoint URL and Tori sends a signed POST request for every billing event.",
              },
              { type: "h2", text: "Adding an endpoint", id: "add-endpoint" },
              {
                type: "p",
                text: "Click Add endpoint. Enter your server URL and give it a name. Tori returns a webhook secret — save it immediately, it is shown once. Use it to verify every delivery with HMAC-SHA256.",
              },
              { type: "h2", text: "Delivery logs", id: "delivery-logs" },
              {
                type: "p",
                text: "Every delivery attempt is logged with the event type, payload, response status, and timestamp. If a delivery fails, Tori retries on a schedule: 5 minutes, 30 minutes, 2 hours, 6 hours.",
              },
              { type: "h2", text: "Circuit breaker", id: "circuit-breaker" },
              {
                type: "p",
                text: "If an endpoint fails 10 or more times in 24 hours, Tori disables it automatically to prevent continued failed deliveries. The endpoint shows a DISABLED badge. Fix the issue on your server and re-enable from the dashboard.",
              },
              { type: "h2", text: "Replaying a delivery", id: "replay" },
              {
                type: "p",
                text: "Click Retry on any failed delivery to immediately re-attempt it. Useful when your server was temporarily down and you need to reprocess missed events.",
              },
            ],
          },
          {
            id: "dashboard-apikeys",
            label: "API Keys page",
            icon: "ti-key",
            blocks: [
              {
                type: "p",
                text: "API keys authenticate your server-to-server calls to the Platform API. Keep your key on your server. Never put it in browser code or mobile apps.",
              },
              { type: "h2", text: "Creating a key", id: "create-key" },
              {
                type: "p",
                text: "Click Create key. Give it a name so you know what it is for (Production server, Staging, etc). The full key is shown exactly once. Copy it into your secret manager immediately. Tori stores only a hash and cannot show it again.",
              },
              { type: "h2", text: "The hint", id: "key-hint" },
              {
                type: "p",
                text: "After creation, the page shows a hint in the format tori_live_xxxx...yyyy. This lets you identify which key is active without revealing the full key. The hint persists across page refreshes.",
              },
              { type: "h2", text: "Rotating a key", id: "rotate-key" },
              {
                type: "p",
                text: "Click Rotate key to generate a new key. The old key stops working immediately. Deploy the new key to your server before rotating. After rotation, the new key is shown once.",
              },
              {
                type: "callout",
                variant: "warn",
                text: "Rotating a key will break any server that is still using the old key. Make sure you update all your environments before or immediately after rotating.",
              },
            ],
          },
          {
            id: "dashboard-settings",
            label: "Settings page",
            icon: "ti-settings",
            blocks: [
              {
                type: "p",
                text: "The Settings page manages your account details, dunning configuration, and Nomba integration status.",
              },
              { type: "h2", text: "Account details", id: "account-details" },
              {
                type: "p",
                text: "Update your business name and email. Changes take effect immediately.",
              },
              {
                type: "h2",
                text: "Dunning configuration",
                id: "dunning-config",
              },
              {
                type: "p",
                text: "Shows your current retry schedule and maximum attempts. The default configuration (4 attempts on Day 3, 7, 14, 21) is tuned for Nigerian payday cycles and is the recommended setting for most businesses.",
              },
              {
                type: "h2",
                text: "Nomba integration",
                id: "nomba-integration",
              },
              {
                type: "p",
                text: "Shows the current status of your Nomba payment integration. When Nomba API credentials are connected, this section will allow you to configure your Nomba account ID and verify the connection.",
              },
            ],
          },
        ],
      },
      {
        group: "Security & Infrastructure",
        items: [
          {
            id: "security-model",
            label: "Security model",
            icon: "ti-shield-lock",
            blocks: [
              {
                type: "p",
                text: "Tori is built for fintech. Every layer of the system is designed with the assumption that it handles real money and real customer data.",
              },
              { type: "h2", text: "Password security", id: "passwords" },
              {
                type: "p",
                text: "Passwords are hashed with argon2id using a unique random 16-byte salt per password. The salt is stored alongside the hash in the format argon2id$salt_hex$hash_hex. Two users with the same password produce different hashes. Rainbow table attacks are computationally infeasible.",
              },
              { type: "h2", text: "API key security", id: "api-key-security" },
              {
                type: "p",
                text: "API keys are never stored. When you create a key, Tori computes SHA-256(key) and stores only the hash. When you make an API call, Tori hashes the key from the header and compares it to the stored hash. The raw key exists only in your possession.",
              },
              { type: "h2", text: "JWT security", id: "jwt-security" },
              {
                type: "p",
                text: "Dashboard sessions use HS256 JWTs with 15-minute access tokens and 7-day refresh tokens. The JWT secret must be at least 32 characters — Tori refuses to start if it is shorter. On logout, the access token is added to a Redis denylist and rejected on all future requests until it would have naturally expired.",
              },
              { type: "h2", text: "Brute force protection", id: "brute-force" },
              {
                type: "p",
                text: "After 5 failed login attempts for any email address, that account is locked for 15 minutes. The counter is stored in Redis and resets on successful login. Failed attempts are recorded even for non-existent accounts to prevent email enumeration.",
              },
              {
                type: "h2",
                text: "Webhook verification",
                id: "webhook-verify",
              },
              {
                type: "p",
                text: "Every webhook delivery is signed with HMAC-SHA256 using your endpoint secret. The signature is in the X-Tori-Signature header as sha256=hex_digest. Your server must verify this before processing any event. Timing-safe comparison is required — use hmac.Equal in Go, crypto.timingSafeEqual in Node.js, hash_equals in PHP.",
              },
              { type: "h2", text: "Rate limiting", id: "rate-limits" },
              {
                type: "p",
                text: "Three layers of rate limiting: 100 requests per minute per IP globally, 300 requests per minute per tenant on the Dashboard API, 600 requests per minute per tenant on the Platform API. Authenticated tenants cannot starve each other even if they share an IP.",
              },
              { type: "h2", text: "Request size limits", id: "request-size" },
              {
                type: "p",
                text: "All request bodies are limited to 1MB. Requests larger than 1MB are rejected with 413 before any processing occurs.",
              },
            ],
          },
          {
            id: "infrastructure",
            label: "Infrastructure",
            icon: "ti-server",
            blocks: [
              {
                type: "p",
                text: "Tori runs as five Docker services. Each has a specific role and can be scaled independently.",
              },
              { type: "h2", text: "Service architecture", id: "services" },
              {
                type: "table",
                headers: ["Service", "Role", "Port"],
                rows: [
                  [
                    "api",
                    "HTTP API server — handles all incoming requests",
                    "8080",
                  ],
                  [
                    "worker",
                    "Job queue worker — processes scheduled billing jobs",
                    "internal",
                  ],
                  [
                    "postgres",
                    "Primary database — all persistent state",
                    "5432",
                  ],
                  ["redis", "Token denylist and login rate limiting", "6379"],
                  ["frontend", "Next.js dashboard", "3000"],
                ],
              },
              { type: "h2", text: "The job queue", id: "job-queue" },
              {
                type: "p",
                text: "Tori uses a PostgreSQL-backed job queue with SELECT FOR UPDATE SKIP LOCKED for concurrent worker safety. When a billing cycle ends, the scheduler enqueues jobs for trial expiry, payment retry, and subscription suspension. The worker polls every 10 seconds, claims one job at a time, and processes it.",
              },
              {
                type: "p",
                text: "If a job fails, it is retried according to its max_attempts. If all attempts are exhausted, the job is marked failed and a DEAD LETTER log entry is written at ERROR level with the full payload for manual inspection.",
              },
              { type: "h2", text: "Stale lock recovery", id: "stale-locks" },
              {
                type: "p",
                text: "If the worker crashes mid-job, the job remains claimed but unfinished. Every 5 minutes, the worker runs a stale lock recovery that finds jobs claimed more than 10 minutes ago and requeues them. This ensures no billing job is permanently lost due to a worker crash.",
              },
              { type: "h2", text: "Webhook dispatcher", id: "dispatcher" },
              {
                type: "p",
                text: "The webhook dispatcher is called asynchronously after every subscription state change. It fetches all active endpoints for the tenant, creates a delivery record, signs the payload, and sends the HTTP request. Failures are retried on a schedule. After 10 failures in 24 hours, the endpoint is disabled automatically.",
              },
              { type: "h2", text: "Connection pool", id: "pool" },
              {
                type: "p",
                text: "The PostgreSQL connection pool is configured with a maximum of 20 connections, a 5-second connect timeout, and a 30-minute connection lifetime. Under load, new requests fail fast rather than blocking indefinitely when the pool is exhausted.",
              },
              { type: "h2", text: "Scaling path", id: "scaling" },
              {
                type: "table",
                headers: ["Scale", "What changes"],
                rows: [
                  ["1K subscribers", "Current architecture, no changes needed"],
                  [
                    "10K subscribers",
                    "Add PostgreSQL read replica, cache plans and customers in Redis",
                  ],
                  [
                    "100K subscribers",
                    "Partition ledger table by month, run multiple worker instances",
                  ],
                  [
                    "1M subscribers",
                    "Migrate job queue to dedicated broker, add tenant-level database sharding",
                  ],
                ],
              },
            ],
          },
          {
            id: "multi-tenancy",
            label: "Multi-tenancy",
            icon: "ti-building",
            blocks: [
              {
                type: "p",
                text: "Every resource in Tori belongs to exactly one tenant. Cross-tenant data access is impossible by design.",
              },
              { type: "h2", text: "How isolation works", id: "isolation" },
              {
                type: "p",
                text: "Every database query that reads or writes tenant data includes a WHERE tenant_id = $1 clause. The tenant ID comes from the authenticated request context — either from the JWT (dashboard) or from the API key lookup (platform). It is never taken from the request body.",
              },
              {
                type: "callout",
                variant: "warn",
                text: "Never pass tenant_id in a request body to the Platform API. Tori ignores it. The tenant is always resolved from the authenticated API key. If you pass a wrong tenant_id in the body, Tori uses the correct one from the key.",
              },
              { type: "h2", text: "What is isolated", id: "what-isolated" },
              {
                type: "list",
                items: [
                  "Plans: only visible to the tenant that created them",
                  "Customers: scoped to tenant, cannot be looked up across tenants",
                  "Subscriptions: scoped to tenant at creation and on every read",
                  "Ledger entries: tenant-scoped, no cross-tenant aggregation",
                  "Webhooks: endpoints and deliveries are tenant-scoped",
                  "API keys: each key belongs to exactly one tenant",
                  "Dunning jobs: jobs carry tenant context in their payload",
                ],
              },
              {
                type: "h2",
                text: "Portal token exception",
                id: "portal-exception",
              },
              {
                type: "p",
                text: "Portal tokens are scoped to a customer ID, not a tenant ID. This is by design — the customer does not know or care which tenant they belong to. The portal handler looks up the customer without a tenant ID, then uses the tenant ID from the customer record to scope all subsequent operations.",
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
                text: "Nigerian card failures are different from card failures in Europe or the US. Most billing tools treat all failures the same. Tori does not.",
              },
              {
                type: "h2",
                text: "Why Nigerian cards fail differently",
                id: "why-different",
              },
              {
                type: "list",
                items: [
                  "Many Nigerian cards are issued with online transactions blocked by default. The bank returns a decline code that looks temporary but will never succeed.",
                  "Insufficient funds is the most common retriable failure. Nigerian salaries often arrive on specific dates, making payday-aligned retries effective.",
                  "Bank system outages are more frequent than in other markets. A failed transaction during an outage should be retried, not treated as a card problem.",
                  "International transaction limits are common. Cards with online transactions enabled may still have limits that prevent certain charges.",
                ],
              },
              {
                type: "h2",
                text: "How Tori classifies failures",
                id: "classification-detail",
              },
              {
                type: "p",
                text: "When a charge fails, Tori reads the failure code from Nomba and looks it up in config/failure_codes.yaml. Each code is classified as RETRIABLE or NON_RETRIABLE.",
              },
              {
                type: "table",
                headers: ["Failure type", "Classification", "Reason"],
                rows: [
                  [
                    "card_blocked_international",
                    "NON_RETRIABLE",
                    "Card will never succeed for online transactions",
                  ],
                  [
                    "card_blocked",
                    "NON_RETRIABLE",
                    "Card is blocked, retry is pointless",
                  ],
                  [
                    "card_expired",
                    "NON_RETRIABLE",
                    "Card is past its expiry date",
                  ],
                  [
                    "fraud_suspected",
                    "NON_RETRIABLE",
                    "Issuer flagged the transaction",
                  ],
                  ["insufficient_funds", "RETRIABLE", "May clear after payday"],
                  [
                    "issuer_unavailable",
                    "RETRIABLE",
                    "Bank outage, retry when available",
                  ],
                  [
                    "transaction_timeout",
                    "RETRIABLE",
                    "Network issue, retry after delay",
                  ],
                  [
                    "do_not_honour_temporary",
                    "RETRIABLE",
                    "Soft decline, may approve on retry",
                  ],
                ],
              },
              {
                type: "h2",
                text: "The payday retry schedule",
                id: "payday-schedule",
              },
              {
                type: "p",
                text: "For retriable failures, Tori schedules retries on Day 3, Day 7, Day 14, and Day 21 after the first failure. This spacing covers multiple payday windows for customers paid weekly, biweekly, or at month-end.",
              },
              {
                type: "p",
                text: "The result: a card with insufficient funds on the 5th of the month gets retried on the 8th (before typical mid-month salaries), the 12th, the 19th, and the 26th (after typical month-end salaries). This maximises recovery without annoying the customer with daily attempts.",
              },
              {
                type: "h2",
                text: "What this means for revenue",
                id: "revenue-impact",
              },
              {
                type: "p",
                text: "If you have 500 active subscribers at ₦10,000/month and 8% of charges fail each month, that is ₦400,000 at risk per cycle. Without intelligent dunning, most of it is lost. With Tori's Nigerian-tuned classification and retry schedule, a substantial portion recovers automatically.",
              },
            ],
          },
          {
            id: "nigerian-use-cases",
            label: "Nigerian use cases",
            icon: "ti-building-store",
            blocks: [
              {
                type: "p",
                text: "Tori is built specifically for Nigerian recurring revenue businesses. Here are three concrete use cases.",
              },
              {
                type: "h2",
                text: "SaaS: school management platform",
                id: "saas-use-case",
              },
              {
                type: "p",
                text: "A school management SaaS charges ₦25,000/month per school. They have 200 schools on the platform. Every month, roughly 16 schools fail their charge. Without Tori, each failure requires manual follow-up. With Tori, failures are classified immediately, retriable ones are retried on payday windows, and the platform receives a webhook for each outcome. The team does not touch billing.",
              },
              {
                type: "h2",
                text: "Creator: membership platform",
                id: "creator-use-case",
              },
              {
                type: "p",
                text: "A Nigerian creator sells ₦2,500/month memberships to 2,000 subscribers. At 8% failure rate, 160 charges fail every month. At ₦2,500 each, that is ₦400,000 at risk. Tori's dunning engine recovers a significant share automatically. The creator also uses the portal token feature to give each subscriber a self-service link for pausing or cancelling, eliminating support tickets.",
              },
              {
                type: "h2",
                text: "Edtech: termly billing",
                id: "edtech-use-case",
              },
              {
                type: "p",
                text: "An edtech platform charges school fees every 120 days. Monthly billing does not fit. Annual billing requires ₦150,000 upfront. Tori's custom interval handles exactly this: set interval to custom and interval_days to 120. Every 120 days, Tori charges automatically. Failures around school resumption are retried across payday windows for the next few weeks.",
              },
            ],
          },
        ],
      },
      {
        group: "Nigerian Use Cases",
        items: [
          {
            id: "saas",
            label: "SaaS billing",
            icon: "ti-building-store",
            blocks: [
              {
                type: "p",
                text: "A Lagos SaaS startup charges ₦15,000/month for its Pro tier and ₦5,000/month for Starter. They have 300 customers and their engineering team has better things to do than maintain a billing system.",
              },
              { type: "h2", text: "The setup", id: "saas-setup" },
              {
                type: "p",
                text: "They create two plans once. Every new user who completes signup gets a customer created in Tori and a subscription started automatically by their backend. New customers start on a 14-day trial. Tori handles the rest.",
              },
              {
                type: "code",
                lang: "json",
                code: `// Create the Pro plan\n{ "name": "Pro", "amount": 1500000, "interval": "monthly", "trial_period_days": 14 }\n\n// Create the Starter plan\n{ "name": "Starter", "amount": 500000, "interval": "monthly", "trial_period_days": 7 }`,
              },
              {
                type: "h2",
                text: "The webhook integration",
                id: "saas-webhooks",
              },
              {
                type: "p",
                text: "Their product listens for three events. `subscription.activated` unlocks the full product after the trial. `payment.failed` shows a banner and restricts certain features. `subscription.suspended` locks the account with a prompt to update their payment method.",
              },
              {
                type: "p",
                text: "That is the entire billing integration. Their engineering team spent two days on it and have not touched it since.",
              },
            ],
          },
          {
            id: "edtech",
            label: "Edtech termly fees",
            icon: "ti-school",
            blocks: [
              {
                type: "p",
                text: "An edtech platform charges school fees once per term roughly every 120 days. Monthly billing does not match their business model. Annual billing would require parents to pay ₦150,000 upfront. They need termly billing.",
              },
              {
                type: "h2",
                text: "The custom interval",
                id: "edtech-interval",
              },
              {
                type: "p",
                text: "Tori's `custom` interval handles this exactly. They create a plan with `interval: custom` and `interval_days: 120`. Every 120 days, Tori attempts the charge. If it fails as it often does around school resumption the dunning schedule gives them multiple retry windows aligned to when parents typically have funds.",
              },
              {
                type: "code",
                lang: "json",
                code: `{\n  "name": "Term fees SS2",\n  "amount": 5000000,\n  "interval": "custom",\n  "interval_days": 120\n}`,
              },
              {
                type: "p",
                text: "The ledger gives the platform a clean record of every term's payment for every student, which they use for their own finance reconciliation at the end of each academic year.",
              },
            ],
          },
          {
            id: "creator",
            label: "Creator subscriptions",
            icon: "ti-microphone",
            blocks: [
              {
                type: "p",
                text: "A creator sells a ₦2,500/month membership to 2,000 subscribers exclusive content, early access, a private community. At this volume, the numbers are relentless: 160 failed charges every month if 8% fail, which at ₦2,500 each is ₦400,000 at risk.",
              },
              {
                type: "h2",
                text: "Why dunning recovery matters here",
                id: "creator-dunning",
              },
              {
                type: "p",
                text: "At ₦2,500/charge, no creator is going to manually chase down 160 failed payments. They need the system to do it automatically. Tori's dunning engine retries each failed charge four times across a three-week window. For a creator audience, a significant portion of those failures clear after payday.",
              },
              {
                type: "code",
                lang: "json",
                code: `{ "name": "Membership", "amount": 250000, "interval": "monthly" }`,
              },
              {
                type: "p",
                text: "The customer portal is also important here. Creators handle a lot of billing support questions 'I want to pause', 'I want to cancel', 'can I change my card'. Tori's portal token lets the creator's platform generate a self-service link for each member so they can manage their own subscription without contacting support.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "api-reference",
    label: "API Reference",
    groups: [
      {
        group: "Reference",
        items: [
          {
            id: "ref-conventions",
            label: "Conventions",
            icon: "ti-adjustments",
            blocks: [
              {
                type: "p",
                text: "Tori's API follows consistent patterns across every endpoint. Learn them once and they apply everywhere.",
              },
              { type: "h2", text: "Base URL", id: "base-url" },
              { type: "code", lang: "bash", code: `${BASE}` },
              { type: "h2", text: "Response envelope", id: "envelope" },
              {
                type: "p",
                text: "Every response is wrapped in the same envelope structure. Success responses have a `data` field. List responses add `pagination`. Every response has a `meta` field with a request ID and the API version.",
              },
              {
                type: "code",
                lang: "json",
                code: `// Single object\n{\n  "data": { "id": "...", "...": "..." },\n  "meta": { "request_id": "01J...", "api_version": "2026-06-01" }\n}\n\n// List\n{\n  "data": [ { "id": "..." }, { "id": "..." } ],\n  "pagination": { "has_more": false, "total": 18 },\n  "meta": { "request_id": "01J...", "api_version": "2026-06-01" }\n}\n\n// Error\n{\n  "error": { "code": "not_found", "message": "the requested resource does not exist" },\n  "meta": { "request_id": "01J...", "api_version": "2026-06-01" }\n}`,
              },
              { type: "h2", text: "Money is always in kobo", id: "money" },
              {
                type: "p",
                text: "Every amount field in the API is an integer representing kobo the smallest unit of the Nigerian Naira. ₦15,000 is `1500000`. ₦2,500 is `250000`. There are no decimal amounts anywhere. This eliminates floating point rounding errors in financial calculations.",
              },
              { type: "h2", text: "Dates are ISO 8601", id: "dates" },
              {
                type: "p",
                text: "All timestamps are in ISO 8601 format in UTC. `2026-06-20T00:00:00Z`. When filtering by date range, pass dates in `YYYY-MM-DD` format: `?from=2026-06-01&to=2026-06-30`.",
              },
              { type: "h2", text: "Pagination", id: "pagination" },
              {
                type: "p",
                text: "List endpoints accept `limit` (max results per page, default 20) and `offset` (number of results to skip). The response includes `pagination.has_more` to tell you whether another page exists.",
              },
              {
                type: "code",
                lang: "bash",
                code: `GET /v1/customers?limit=50&offset=100`,
              },
              { type: "h2", text: "Request ID", id: "request-id" },
              {
                type: "p",
                text: "Every response includes `meta.request_id` a unique identifier for that specific API call. Log this alongside your own application logs. When something goes wrong, quote the request ID in a support ticket and Tori can trace the exact call in the system logs.",
              },
            ],
          },
          {
            id: "ref-plans",
            label: "Plans",
            icon: "ti-file-text",
            blocks: [
              { type: "h2", text: "Create a plan", id: "create" },
              {
                type: "code",
                lang: "bash",
                code: `POST /v1/platform/plans\n\n{\n  "name": "Pro",               // required\n  "amount": 1500000,           // required, in kobo\n  "currency": "NGN",           // optional, defaults to NGN\n  "interval": "monthly",       // optional: monthly, annual, custom. default monthly\n  "interval_count": 1,         // optional, for custom intervals\n  "trial_period_days": 14      // optional, 0 means no trial\n}`,
              },
              { type: "h2", text: "List plans", id: "list" },
              { type: "code", lang: "bash", code: `GET /v1/plans` },
              { type: "h2", text: "Get a single plan", id: "get" },
              { type: "code", lang: "bash", code: `GET /v1/plans/{id}` },
              { type: "h2", text: "Update a plan", id: "update" },
              {
                type: "p",
                text: "You can update a plan's name, description, and amount. Updating the amount does not change what existing subscribers pay it only affects new subscribers.",
              },
              {
                type: "code",
                lang: "bash",
                code: `PATCH /v1/plans/{id}\n\n{\n  "name": "Pro (updated)",\n  "amount": 1800000\n}`,
              },
              { type: "h2", text: "Deactivate a plan", id: "deactivate" },
              {
                type: "p",
                text: "Deactivating stops new subscriptions from using the plan. Existing subscriptions are unaffected.",
              },
              { type: "code", lang: "bash", code: `DELETE /v1/plans/{id}` },
            ],
          },
          {
            id: "ref-customers",
            label: "Customers",
            icon: "ti-users",
            blocks: [
              { type: "h2", text: "Create a customer", id: "create" },
              {
                type: "code",
                lang: "bash",
                code: `POST /v1/platform/customers\n\n{\n  "email": "amaka@startup.ng",  // required\n  "name": "Amaka Obi",          // optional\n  "external_id": "user_12345"   // optional but recommended\n}`,
              },
              {
                type: "p",
                text: "Pass `external_id` as your own identifier for this user. It lets you look up Tori customers by your own ID without storing Tori IDs in your database.",
              },
              { type: "h2", text: "Look up by your own ID", id: "by-external" },
              {
                type: "code",
                lang: "bash",
                code: `GET /v1/customers?external_id=user_12345`,
              },
              { type: "h2", text: "List customers", id: "list" },
              {
                type: "code",
                lang: "bash",
                code: `GET /v1/customers?limit=20&offset=0`,
              },
              { type: "h2", text: "Update a customer", id: "update" },
              {
                type: "code",
                lang: "bash",
                code: `PATCH /v1/customers/{id}\n\n{ "name": "Amaka Obi-Johnson", "email": "new@startup.ng" }`,
              },
              { type: "h2", text: "Archive a customer", id: "archive" },
              {
                type: "p",
                text: "Customers are never hard-deleted. Archiving soft-deletes them while preserving their full billing history in the ledger.",
              },
              {
                type: "code",
                lang: "bash",
                code: `POST /v1/customers/{id}/archive`,
              },
              { type: "h2", text: "Generate a portal token", id: "portal" },
              {
                type: "p",
                text: "Mint a short-lived token that lets the customer manage their own subscription in the self-service portal. Embed this link in your product so customers can cancel, pause, and view their invoices without contacting you.",
              },
              {
                type: "code",
                lang: "bash",
                code: `GET /v1/platform/customers/{id}/portal-token\n\n{\n  "data": { "token": "eyJ...", "expires_in": "3600" }\n}`,
              },
            ],
          },
          {
            id: "ref-subs",
            label: "Subscriptions",
            icon: "ti-refresh",
            blocks: [
              { type: "h2", text: "Create a subscription", id: "create" },
              {
                type: "code",
                lang: "bash",
                code: `POST /v1/platform/subscriptions\n\n{\n  "customer_id": "cus_...",             // required\n  "plan_id": "plan_...",               // required\n  "idempotency_key": "sub_user_12345"  // strongly recommended\n}`,
              },
              { type: "h2", text: "List subscriptions", id: "list" },
              {
                type: "p",
                text: "Filter by status to see all subscriptions in a particular state useful for finding everything in dunning or everything that needs attention.",
              },
              {
                type: "code",
                lang: "bash",
                code: `GET /v1/subscriptions\nGET /v1/subscriptions?status=DUNNING\nGET /v1/subscriptions?status=ACTIVE&limit=50`,
              },
              { type: "h2", text: "Get a single subscription", id: "get" },
              {
                type: "code",
                lang: "bash",
                code: `GET /v1/platform/subscriptions/{id}`,
              },
              { type: "h2", text: "Cancel a subscription", id: "cancel" },
              {
                type: "code",
                lang: "bash",
                code: `POST /v1/platform/subscriptions/{id}/cancel`,
              },
              { type: "h2", text: "Pause a subscription", id: "pause" },
              {
                type: "code",
                lang: "bash",
                code: `POST /v1/platform/subscriptions/{id}/pause`,
              },
              { type: "h2", text: "Resume a subscription", id: "resume" },
              {
                type: "code",
                lang: "bash",
                code: `POST /v1/platform/subscriptions/{id}/resume`,
              },
              {
                type: "callout",
                variant: "info",
                text: "Every lifecycle action is validated against the state machine. If the action is not valid from the current state for example, trying to pause a cancelled subscription you receive 422 invalid_transition and nothing changes.",
              },
            ],
          },
          {
            id: "ref-ledger",
            label: "Ledger",
            icon: "ti-book",
            blocks: [
              { type: "h2", text: "List ledger entries", id: "list" },
              {
                type: "p",
                text: "Returns all entries for your tenant in a date range, newest first.",
              },
              {
                type: "code",
                lang: "bash",
                code: `GET /v1/ledger?from=2026-06-01&to=2026-06-30&limit=50`,
              },
              { type: "h2", text: "Ledger summary", id: "summary" },
              {
                type: "p",
                text: "Returns aggregated totals for a period. This is the source of your revenue dashboard numbers.",
              },
              {
                type: "code",
                lang: "bash",
                code: `GET /v1/ledger/summary?from=2026-06-01&to=2026-06-30`,
              },
              {
                type: "code",
                lang: "json",
                code: `{\n  "data": {\n    "total_charged": 91500000,\n    "total_refunded": 500000,\n    "net_revenue": 91000000,\n    "entry_count": 44,\n    "currency": "NGN"\n  }\n}`,
              },
            ],
          },
          {
            id: "ref-finance",
            label: "Finance & metrics",
            icon: "ti-chart-bar",
            blocks: [
              {
                type: "p",
                text: "Finance endpoints compute business metrics from the ledger. They are read-only and always derived from immutable historical data.",
              },
              {
                type: "table",
                headers: ["Endpoint", "What it returns", "Key field"],
                rows: [
                  [
                    "GET /v1/finance/mrr",
                    "Monthly recurring revenue for a given period",
                    "mrr_kobo",
                  ],
                  [
                    "GET /v1/finance/arr",
                    "Annualised recurring revenue (MRR × 12)",
                    "arr_kobo",
                  ],
                  [
                    "GET /v1/finance/churn",
                    "Churn rate and cancelled subscription count",
                    "churn_rate_pct",
                  ],
                  [
                    "GET /v1/finance/dunning-recovery",
                    "Revenue recovered through dunning retries",
                    "recovered_kobo",
                  ],
                  [
                    "GET /v1/finance/revenue-report",
                    "Gross, refunds, and net revenue for a period",
                    "net_revenue",
                  ],
                ],
              },
              {
                type: "code",
                lang: "bash",
                code: `GET /v1/finance/mrr?period=2026-06\n\n{\n  "data": {\n    "mrr_kobo": 4200000,\n    "currency": "NGN",\n    "period": "2026-06"\n  }\n}`,
              },
            ],
          },
          {
            id: "ref-webhooks",
            label: "Webhooks",
            icon: "ti-webhook",
            blocks: [
              { type: "h2", text: "Register an endpoint", id: "register" },
              {
                type: "code",
                lang: "bash",
                code: `POST /v1/webhooks/endpoints\n\n{\n  "url": "https://yourapp.ng/webhooks/tori",\n  "events": ["*"]  // "*" subscribes to all events\n}`,
              },
              {
                type: "p",
                text: "The response includes a one-time `secret`. Save it it is used to verify every delivery and is never shown again.",
              },
              { type: "h2", text: "List endpoints", id: "list" },
              {
                type: "code",
                lang: "bash",
                code: `GET /v1/webhooks/endpoints`,
              },
              { type: "h2", text: "View delivery logs", id: "logs" },
              { type: "code", lang: "bash", code: `GET /v1/webhooks/logs` },
              { type: "h2", text: "Retry a delivery", id: "retry" },
              {
                type: "code",
                lang: "bash",
                code: `POST /v1/webhooks/logs/{id}/retry`,
              },
              { type: "h2", text: "Signature verification", id: "verify" },
              {
                type: "code",
                lang: "js",
                code: `const crypto = require('crypto');\n\nconst sig = crypto\n  .createHmac('sha256', process.env.TORI_WEBHOOK_SECRET)\n  .update(rawBody)\n  .digest('hex');\n\nconst trusted = crypto.timingSafeEqual(\n  Buffer.from(sig),\n  Buffer.from(req.headers['tori-signature'])\n);`,
              },
              {
                type: "h2",
                text: "Retry schedule for failed deliveries",
                id: "retries",
              },
              {
                type: "p",
                text: "If your server does not return 2xx, Tori retries delivery at 5 minutes, 30 minutes, 2 hours, then 6 hours. Every attempt is logged and replayable from the dashboard.",
              },
              {
                type: "callout",
                variant: "warn",
                text: "Respond 200 immediately and process asynchronously. If processing takes more than a few seconds, Tori may time out and schedule an unnecessary retry. Duplicate events are possible make your webhook handler idempotent by checking whether you have already processed an event ID before acting on it.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "developer-resources",
    label: "Developer Resources",
    groups: [
      {
        group: "Resources",
        items: [
          {
            id: "test-cards",
            label: "Test cards",
            icon: "ti-credit-card",
            blocks: [
              {
                type: "p",
                text: "Use these card outcomes in the sandbox to exercise every billing scenario without real money. Each maps to a real failure classification so you can verify your webhook handling and product logic end to end before going live.",
              },
              {
                type: "table",
                headers: [
                  "Scenario",
                  "Failure code",
                  "Classification",
                  "Resulting state",
                ],
                rows: [
                  ["Successful charge", "approved", "—", "ACTIVE"],
                  [
                    "Not enough money",
                    "insufficient_funds",
                    "Retriable",
                    "DUNNING",
                  ],
                  [
                    "Bank system down",
                    "issuer_unavailable",
                    "Retriable",
                    "DUNNING",
                  ],
                  [
                    "Request timed out",
                    "transaction_timeout",
                    "Retriable",
                    "DUNNING",
                  ],
                  [
                    "Card expired",
                    "card_expired",
                    "Permanent",
                    "SUSPENDED (immediate)",
                  ],
                  [
                    "Card blocked for online",
                    "card_blocked",
                    "Permanent",
                    "SUSPENDED (immediate)",
                  ],
                  [
                    "Bank declined definitively",
                    "do_not_honour",
                    "Permanent",
                    "SUSPENDED (immediate)",
                  ],
                ],
              },
              {
                type: "callout",
                variant: "info",
                text: "Try this sequence: start a subscription with an insufficient_funds card so it enters DUNNING. Then switch the card to approved and trigger a manual retry. Watch dunning.recovered fire and the subscription return to ACTIVE. This is the full dunning lifecycle in one test.",
              },
            ],
          },
          {
            id: "errors",
            label: "Error codes",
            icon: "ti-alert-triangle",
            blocks: [
              {
                type: "p",
                text: "Errors always follow the same envelope with a stable machine-readable `code` and a human-readable `message`. Always branch your error handling on `code`, never on `message` messages may change in wording, codes will not.",
              },
              {
                type: "table",
                headers: [
                  "HTTP status",
                  "Error code",
                  "What it means",
                  "What to do",
                ],
                rows: [
                  [
                    "400",
                    "invalid_body",
                    "The request body was not valid JSON",
                    "Check your request body format",
                  ],
                  [
                    "400",
                    "missing_field",
                    "A required field was not included",
                    "Add the missing field",
                  ],
                  [
                    "400",
                    "invalid_amount",
                    "The amount is zero or negative",
                    "Send a positive integer in kobo",
                  ],
                  [
                    "401",
                    "unauthorised",
                    "Missing or invalid API key or JWT",
                    "Check your credentials",
                  ],
                  [
                    "404",
                    "not_found",
                    "The resource does not exist for this tenant",
                    "Check the ID is correct",
                  ],
                  [
                    "409",
                    "email_taken",
                    "A customer with that email already exists",
                    "Look up the existing customer instead",
                  ],
                  [
                    "422",
                    "invalid_transition",
                    "The state machine rejected the action",
                    "Check the current state allows this action",
                  ],
                  [
                    "429",
                    "rate_limited",
                    "Too many requests per minute",
                    "Back off until X-Ratelimit-Reset",
                  ],
                  [
                    "500",
                    "internal_error",
                    "Something went wrong on Tori's side",
                    "Retry with exponential backoff, contact support if persistent",
                  ],
                ],
              },
            ],
          },
          {
            id: "ratelimits",
            label: "Rate limits",
            icon: "ti-gauge",
            blocks: [
              {
                type: "p",
                text: "The API allows 100 requests per minute per IP address. Every response includes rate limit headers so you can track your usage and throttle proactively.",
              },
              {
                type: "code",
                lang: "bash",
                code: `X-Ratelimit-Limit: 100        # max requests per window\nX-Ratelimit-Remaining: 73     # how many you have left\nX-Ratelimit-Reset: 1781870000 # Unix timestamp when the window resets`,
              },
              {
                type: "p",
                text: "When you exceed the limit, you receive a 429 response. Do not retry immediately wait until the reset timestamp before making another request.",
              },
              {
                type: "callout",
                variant: "warn",
                text: "If you are bulk-creating customers or subscriptions, stagger your requests to stay under the limit. For large batch operations importing thousands of customers at once contact us for an elevated rate limit.",
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
                text: "Idempotency means that making the same request multiple times produces the same result as making it once. This is critical for billing you never want to accidentally charge a customer twice or create duplicate subscriptions because a network request timed out and your server retried.",
              },
              { type: "h2", text: "How it works", id: "how" },
              {
                type: "p",
                text: "Pass an `idempotency_key` in the request body when creating a subscription. If Tori has already processed a request with that key, it returns the original result without creating anything new. The key is tied to your tenant, so keys from different accounts never collide.",
              },
              {
                type: "code",
                lang: "json",
                code: `{\n  "customer_id": "cus_...",\n  "plan_id": "plan_...",\n  "idempotency_key": "sub_user_12345_pro_2026"\n}`,
              },
              { type: "h2", text: "Choosing a good key", id: "choosing" },
              {
                type: "p",
                text: "A good idempotency key is stable for the specific operation but unique across different operations. A common pattern is to combine your user ID with the operation type:",
              },
              {
                type: "list",
                items: [
                  "`sub_user_12345_pro` user 12345 subscribing to the Pro plan",
                  "`sub_user_12345_pro_upgrade_2026-06` same user upgrading in June",
                  "A UUID you generate when the user clicks Subscribe, stored in your session",
                ],
              },
              {
                type: "callout",
                variant: "success",
                text: "Nigerian mobile networks drop connections regularly. Always use idempotency keys on subscription creation so a timeout followed by a retry never results in double billing.",
              },
            ],
          },
          {
            id: "postman",
            label: "Postman collection",
            icon: "ti-package",
            blocks: [
              {
                type: "p",
                text: "The Tori Postman collection covers every endpoint with example request bodies, environment variables for your API key, and chained requests that pass IDs between steps automatically.",
              },
              { type: "h2", text: "Getting started", id: "getting-started" },
              {
                type: "list",
                items: [
                  "Import the collection into Postman",
                  "Create a Tori environment with `api_key` set to your `tori_live_...` key",
                  "Set `base_url` to `https://api.tori.ng`",
                  "Run the Getting Started folder top to bottom it creates a plan, customer, and subscription in sequence",
                ],
              },
              {
                type: "p",
                text: "The collection uses Postman's test scripts to extract IDs from responses and store them as environment variables. When you create a plan, its ID is automatically saved and used in the subscription creation request. No manual copying required.",
              },
              {
                type: "callout",
                variant: "info",
                text: "The collection includes pre-request scripts that verify your API key is set and your environment is configured correctly before each request runs.",
              },
            ],
          },
        ],
      },
    ],
  },
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
              { type: "h2", text: "2026-06-20 Public beta launch", id: "v1" },
              {
                type: "p",
                text: "The first public release of Tori, available to all businesses building on Nomba.",
              },
              {
                type: "list",
                items: [
                  "Plans with monthly, annual, and custom intervals termly billing, quarterly retainers, any cadence",
                  "Subscriptions with a fully validated seven-state lifecycle enforced by a pure state machine",
                  "Nigerian-aware dunning with card failure classification retriable vs permanent and payday-tuned retry schedule",
                  "Append-only financial ledger every charge, refund, credit, and adjustment recorded immutably",
                  "MRR, ARR, churn rate, and dunning recovery metrics computed from real ledger history",
                  "HMAC-SHA256 signed, replayable webhooks covering the full billing event surface",
                  "Self-service customer portal tokens for pause, resume, and cancellation without support tickets",
                  "Per-IP rate limiting with budget headers on every response",
                  "Idempotent subscription creation for safe retries over unreliable networks",
                  "Full dashboard: subscription management, customer directory, plan builder, finance charts, webhook logs, API key management",
                ],
              },
              { type: "h2", text: "2026-05-15 Private preview", id: "v0" },
              {
                type: "p",
                text: "Internal testing with a small group of Nigerian SaaS founders.",
              },
              {
                type: "list",
                items: [
                  "Core billing engine with correct month-end date clamping January 31 + 1 month = February 28, always",
                  "Proration engine for mid-cycle plan changes",
                  "Initial Platform API surface plans, customers, subscriptions",
                  "Idempotency key support on subscription creation",
                  "PostgreSQL-backed job queue for scheduling retry events",
                ],
              },
              {
                type: "callout",
                variant: "info",
                text: "Tori is in public beta. The API surface is stable and will not have breaking changes within the 2026-06-01 version. Feedback from early integrators directly shapes the roadmap.",
              },
            ],
          },
        ],
      },
    ],
  },
];

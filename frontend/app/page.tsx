"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>

      {/* Nav */}
      <nav className="border-b" style={{ borderColor: "#F0F0F0" }}>
        <div className="flex items-center px-6 py-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mr-auto lg:mr-10">
            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: "#0F1728" }}>
              <svg viewBox="0 0 14 14" className="w-4 h-4"><path d="M7 1L11.5 3.75V8.25L7 11L2.5 8.25V3.75L7 1Z" fill="#00B37E" /></svg>
            </div>
            <span className="text-2xl font-extrabold tracking-tight" style={{ color: "#0F1728" }}>Tori</span>
          </div>
          <div className="hidden lg:flex items-center gap-8 mr-auto">
            <a href="#problem" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Why Tori</a>
            <a href="#how" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>How it works</a>
            <a href="#intelligence" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Intelligence</a>
            <Link href="/docs" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Docs</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-[15px] font-semibold hidden sm:block" style={{ color: "#0F1728" }}>Log in</Link>
            <Link href="/signup" className="text-sm px-4 py-2.5 rounded-lg font-bold text-white" style={{ background: "#0F1728" }}>Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-10 pt-12 pb-10 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold mb-6" style={{ background: "#E6F8F2", color: "#0F6E56" }}>
              <i className="ti ti-sparkles" /> Built natively on Nomba · Nomba x DevCareer 2026
            </div>
            <h1 className="text-4xl lg:text-6xl font-extrabold leading-none mb-5" style={{ color: "#0F1728", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
              Stop rebuilding<br />billing from scratch<br /><span style={{ color: "#00B37E" }}>every single time.</span>
            </h1>
            <p className="text-lg lg:text-xl mb-4" style={{ color: "#4B5563", lineHeight: 1.6 }}>
              Every Nigerian SaaS, edtech, and creator platform that charges customers monthly has had to build the same billing system from scratch. Subscriptions, payment retries, churn tracking, invoices. All of it, from zero, every time.
            </p>
            <p className="text-lg lg:text-xl mb-8 font-semibold" style={{ color: "#0F1728", lineHeight: 1.6 }}>
              Tori is that billing system. Built once. Available to every business on Nomba.
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              <Link href="/signup" className="flex items-center gap-2 px-6 py-3.5 rounded-lg text-white font-bold text-[15px]" style={{ background: "#0F1728" }}>
                Start for free <i className="ti ti-arrow-right" />
              </Link>
              <Link href="/docs" className="flex items-center gap-2 px-6 py-3.5 rounded-lg font-bold text-[15px] border" style={{ borderColor: "#D1D5DB", color: "#0F1728" }}>
                Read the docs
              </Link>
            </div>
            <p className="text-sm font-semibold" style={{ color: "#9CA3AF" }}>Free to start · No setup fee · No contracts</p>
          </div>

          <div className="relative mt-8 lg:mt-0">
            <div className="rounded-2xl p-4" style={{ background: "#0F1728" }}>
              <div className="flex gap-1.5 mb-3.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#E24B4A" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#00B37E" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#63AA22" }} />
              </div>
              <div className="text-xs font-mono mb-3" style={{ color: "#9CA3AF" }}># One call to start a subscription. No prior customer needed.</div>
              <div className="space-y-2 mb-4">
                <div className="rounded-lg p-3" style={{ background: "#1A2436" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold" style={{ color: "#00B37E" }}>POST</span>
                    <span className="text-xs font-mono" style={{ color: "#E5E7EB" }}>/v1/platform/checkout</span>
                  </div>
                  <div className="text-xs font-mono break-all" style={{ color: "#9CA3AF" }}>{`{ "email": "amaka@startup.ng", "plan_id": "plan_...", "external_id": "user_123" }`}</div>
                </div>
                <div className="rounded-lg p-3" style={{ background: "#0A2A1A", border: "1px solid #00B37E33" }}>
                  <div className="text-xs font-bold mb-1" style={{ color: "#00B37E" }}>Response</div>
                  <div className="text-xs font-mono space-y-0.5" style={{ color: "#9CA3AF" }}>
                    <div>{`{ "customer": { "id": "cus_...", "email": "amaka@startup.ng" },`}</div>
                    <div className="pl-2">{`"subscription": { "id": "sub_...", "status": "TRIALING" },`}</div>
                    <div className="pl-2">{`"customer_created": true }`}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg p-3" style={{ background: "#1A2436" }}>
                <div className="text-xs font-bold mb-1" style={{ color: "#00B37E" }}>Tori handles everything after this</div>
                <div className="text-xs font-mono" style={{ color: "#9CA3AF" }}>Monthly charges · Card failure retries · Revenue ledger · Webhooks · Portal</div>
              </div>
            </div>
            {/* Floating badges — hidden on small screens to avoid overflow */}
            <div className="hidden sm:flex absolute -top-4 -right-4 bg-white rounded-xl px-4 py-3 items-center gap-2.5" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#E6F8F2", color: "#00B37E" }}><i className="ti ti-trending-up" /></div>
              <div>
                <div className="text-xs font-bold" style={{ color: "#0F1728" }}>₦4.2M MRR</div>
                <div className="text-[10px] font-medium" style={{ color: "#6B7280" }}>tracked automatically</div>
              </div>
            </div>
            <div className="hidden sm:flex absolute -bottom-4 -left-4 bg-white rounded-xl px-4 py-3 items-center gap-2.5" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#E6F8F2", color: "#00B37E" }}><i className="ti ti-heartbeat" /></div>
              <div>
                <div className="text-xs font-bold" style={{ color: "#0F1728" }}>Health score: 87</div>
                <div className="text-[10px] font-medium" style={{ color: "#6B7280" }}>portfolio health</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="flex flex-wrap justify-center gap-8 lg:gap-16 px-6 py-8 border-t border-b" style={{ background: "#FAFAF8", borderColor: "#EEE" }}>
        {[
          ["1", "API call to start a subscription"],
          ["8", "Subscription states with validated transitions"],
          ["48hr", "Grace period before dunning begins"],
          ["Day 3, 7, 14, 21", "Nigerian payday-aligned retry schedule"],
        ].map(([v, l]) => (
          <div key={l} className="text-center">
            <div className="text-3xl font-extrabold" style={{ color: "#0F1728" }}>{v}</div>
            <div className="text-sm mt-1 font-medium" style={{ color: "#6B7280" }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Problem section */}
      <section id="problem" className="px-6 lg:px-10 py-16 lg:py-20 max-w-5xl mx-auto">
        <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>The problem</div>
        <h2 className="text-3xl lg:text-4xl font-extrabold mb-4" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
          Nigerian founders spend months on billing.<br className="hidden lg:block" /> Then their competitor does too.
        </h2>
        <p className="text-lg mb-10 max-w-2xl" style={{ color: "#6B7280" }}>
          Every subscription business needs the same infrastructure. The problem is everyone builds it from scratch.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl p-6 border" style={{ borderColor: "#FDCACA", background: "#FFF5F5" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#FDCACA" }}>
                <i className="ti ti-x" style={{ fontSize: 16, color: "#DC2626" }} />
              </div>
              <span className="font-extrabold" style={{ color: "#DC2626" }}>Without Tori</span>
            </div>
            <ul className="space-y-3">
              {[
                "Write a cron job that charges customers every month",
                "Figure out what to do when a card fails (retry? when? how many times?)",
                "Build a system to suspend access when someone does not pay",
                "Track who paid, who did not, and how much you have made",
                "Handle customer cancellations, pauses, and refunds",
                "Build it again for your next product",
                "Watch a GTBank card fail 4 times because it is blocked for online payments",
              ].map(i => (
                <li key={i} className="flex items-start gap-2.5 text-sm font-medium" style={{ color: "#4B5563" }}>
                  <i className="ti ti-circle-x mt-0.5 flex-shrink-0" style={{ fontSize: 16, color: "#DC2626" }} />{i}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl p-6 border" style={{ borderColor: "#86EFAC", background: "#F0FDF4" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#86EFAC" }}>
                <i className="ti ti-check" style={{ fontSize: 16, color: "#16A34A" }} />
              </div>
              <span className="font-extrabold" style={{ color: "#16A34A" }}>With Tori</span>
            </div>
            <ul className="space-y-3">
              {[
                "One API call to start a subscription. Email and plan ID. Done.",
                "Tori charges automatically every cycle through Nomba",
                "Failed cards are classified immediately. Blocked cards stop. Retriable ones retry on payday windows.",
                "Customers get a 48-hour grace period before dunning begins",
                "Every naira in and out is recorded in an immutable ledger",
                "MRR, churn, and dunning recovery update in real time",
                "Customers self-serve via a portal link you generate in one call",
              ].map(i => (
                <li key={i} className="flex items-start gap-2.5 text-sm font-medium" style={{ color: "#166534" }}>
                  <i className="ti ti-circle-check mt-0.5 flex-shrink-0" style={{ fontSize: 16, color: "#16A34A" }} />{i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Who it is for */}
      <section className="px-6 lg:px-10 py-14 border-t border-b" style={{ borderColor: "#F0F0F0", background: "#FAFAF8" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Who uses Tori</div>
          <h2 className="text-3xl lg:text-4xl font-extrabold mb-10" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>Built for Nigerian builders charging recurring revenue</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              ["ti-building-store", "SaaS founders", "You built software that solves a real problem and charge ₦5,000 to ₦50,000 per month. You need billing that just works so you can focus on the product."],
              ["ti-school", "Edtech platforms", "You charge school fees termly or tuition monthly. You need a billing system that handles irregular schedules and gives parents a clean way to pay."],
              ["ti-microphone", "Creator platforms", "You sell memberships, courses, or exclusive content. High volume, low value per charge. You need dunning recovery to not leave money on the table."],
              ["ti-heart-handshake", "Membership businesses", "Gyms, professional associations, subscription boxes. You need pause and resume, not just cancel, because life happens and customers come back."],
              ["ti-device-laptop", "Developer platforms", "API-first tools charging per seat or per month. You need a platform API your own customers can integrate with, not just a dashboard."],
              ["ti-chart-bar", "Fintech builders", "You are building on Nomba's rails and need the financial infrastructure layer: ledger, audit trail, and revenue metrics, without starting from scratch."],
            ].map(([icon, title, desc]) => (
              <div key={title} className="bg-white rounded-xl p-5 border" style={{ borderColor: "#E5E7EB" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: "#E6F8F2", color: "#00B37E" }}>
                  <i className={`ti ${icon}`} style={{ fontSize: 20 }} />
                </div>
                <h3 className="text-sm font-extrabold mb-1.5" style={{ color: "#0F1728" }}>{title}</h3>
                <p className="text-sm font-medium leading-relaxed" style={{ color: "#6B7280" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-6 lg:px-10 py-16 lg:py-20 max-w-5xl mx-auto">
        <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>How it works</div>
        <h2 className="text-3xl lg:text-4xl font-extrabold mb-4" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>From zero to billing in one afternoon</h2>
        <p className="text-lg mb-10" style={{ color: "#6B7280" }}>No billing engineer required. No months of work. One API call and a webhook listener.</p>
        <div className="space-y-5">
          {[
            ["1", "Create a billing plan", "Define what you charge and how often. ₦15,000/month, ₦150,000/year, or a custom interval: termly fees, quarterly retainers, anything. Set a free trial period if you want customers to experience the product before paying.", 'POST /v1/platform/plans\n{ "name": "Pro", "amount": 1500000, "interval": "monthly", "trial_period_days": 14 }'],
            ["2", "Start a subscription in one call", "Pass a customer email and a plan ID. Tori finds or creates the customer automatically and starts the subscription. No separate customer creation step. No prior transaction required.", 'POST /v1/platform/checkout\n{ "email": "amaka@startup.ng", "plan_id": "plan_...", "external_id": "user_123", "idempotency_key": "signup_user_123" }'],
            ["3", "React to events in your product", "Tori sends a signed webhook to your server every time something billing-related happens. Your product listens and acts: suspend access on payment failure, restore it when recovered, send a receipt on success.", "subscription.activated -> unlock access\npayment.failed -> show payment warning\ndunning.recovered -> restore full access\nsubscription.cancelled -> offboard gracefully"],
            ["4", "Let customers self-serve", "Generate a portal link for any customer with one API call. They can pause, resume, or cancel their own subscription without contacting support. The link expires after one hour.", 'GET /v1/platform/customers/{id}/portal-token\n// Returns: { "token": "eyJ..." }\n// Redirect customer to:\n// https://portal.tori.ng?token=eyJ...'],
          ].map(([num, title, desc, code]) => (
            <div key={num} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start p-6 rounded-2xl border" style={{ borderColor: "#E5E7EB" }}>
              <div>
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-sm mb-3 text-white" style={{ background: "#0F1728" }}>{num}</div>
                <h3 className="text-lg font-extrabold mb-2" style={{ color: "#0F1728" }}>{title}</h3>
                <p className="text-sm font-medium leading-relaxed" style={{ color: "#6B7280" }}>{desc}</p>
              </div>
              <pre className="rounded-xl p-4 text-xs font-mono leading-relaxed overflow-x-auto" style={{ background: "#0F1728", color: "#E5E7EB" }}><code>{code}</code></pre>
            </div>
          ))}
        </div>
      </section>

      {/* Nigerian dunning */}
      <section className="px-6 lg:px-10 py-14 border-t" style={{ borderColor: "#F0F0F0", background: "#FAFAF8" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Nigerian-first dunning</div>
          <h2 className="text-3xl lg:text-4xl font-extrabold mb-4" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
            Card failures in Nigeria are different.<br className="hidden lg:block" /> Your billing engine should know that.
          </h2>
          <p className="text-lg mb-10 max-w-2xl" style={{ color: "#6B7280" }}>
            Other billing tools retry immediately when a card fails. That does not work in Nigeria. Tori was built for how Nigerian cards actually behave.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              ["ti-credit-card-off", "Blocked cards", "Many Nigerian cards are issued blocked for online transactions by default. Tori recognises this immediately and stops retrying, so you do not waste 4 attempts on a card that can never succeed."],
              ["ti-clock", "Grace period", "When a charge fails for the first time, Tori grants 48 hours before dunning begins. One silent retry window. Only if that also fails does full dunning start."],
              ["ti-calendar", "Payday retries", "Insufficient funds often clear after salary day. Tori spaces retries to land after typical payday windows: Day 3, Day 7, Day 14, Day 21, maximising recovery."],
              ["ti-wifi-off", "Bank outages", "Nigerian bank systems go down. When a failure looks like a temporary issuer issue, Tori classifies it as retriable and waits instead of immediately suspending the customer."],
            ].map(([icon, title, desc]) => (
              <div key={title} className="bg-white rounded-xl p-5 border" style={{ borderColor: "#E5E7EB" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: "#E6F8F2", color: "#00B37E" }}>
                  <i className={`ti ${icon}`} style={{ fontSize: 20 }} />
                </div>
                <h3 className="text-sm font-extrabold mb-1.5" style={{ color: "#0F1728" }}>{title}</h3>
                <p className="text-sm font-medium leading-relaxed" style={{ color: "#6B7280" }}>{desc}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl p-6 border" style={{ borderColor: "#86EFAC", background: "#F0FDF4" }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#86EFAC" }}>
                <i className="ti ti-coin" style={{ fontSize: 24, color: "#16A34A" }} />
              </div>
              <div>
                <h3 className="text-base font-extrabold mb-1" style={{ color: "#0F1728" }}>What dunning recovery means in real money</h3>
                <p className="text-sm font-medium leading-relaxed" style={{ color: "#166534" }}>
                  If you have 500 subscribers at ₦10,000/month and 8% of payments fail each month, that is ₦400,000 at risk every cycle. Without smart dunning, you lose most of it. With Tori&apos;s Nigerian-tuned retry logic, a significant portion of that comes back automatically, with no action from you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Intelligence section */}
      <section id="intelligence" className="px-6 lg:px-10 py-16 lg:py-20 max-w-5xl mx-auto">
        <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Billing intelligence</div>
        <h2 className="text-3xl lg:text-4xl font-extrabold mb-4" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
          Know which customers are about to churn.<br className="hidden lg:block" /> Before they actually do.
        </h2>
        <p className="text-lg mb-10 max-w-2xl" style={{ color: "#6B7280" }}>
          Tori does not just process payments. It analyses your subscriber base and surfaces signals that help you act before revenue is lost.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="rounded-xl p-5 border" style={{ borderColor: "#E5E7EB" }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: "#E6F8F2", color: "#00B37E" }}>
              <i className="ti ti-heartbeat" style={{ fontSize: 20 }} />
            </div>
            <h3 className="text-sm font-extrabold mb-2" style={{ color: "#0F1728" }}>Billing health scores</h3>
            <p className="text-sm font-medium leading-relaxed mb-3" style={{ color: "#6B7280" }}>
              Every active subscription gets a real-time health score from 0 to 100. Computed from current state, dunning history, and subscription age. Not a guess. A calculation.
            </p>
            <div className="rounded-lg p-3" style={{ background: "#F8F9FA" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: "#6B7280" }}>amaka@startup.ng</span>
                <span className="text-xs font-extrabold" style={{ color: "#00B37E" }}>92</span>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: "#6B7280" }}>tunde@fintech.ng</span>
                <span className="text-xs font-extrabold" style={{ color: "#D97706" }}>54</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: "#6B7280" }}>ngozi@app.ng</span>
                <span className="text-xs font-extrabold" style={{ color: "#DC2626" }}>18</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-5 border" style={{ borderColor: "#E5E7EB" }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: "#FDF0D5", color: "#B8860B" }}>
              <i className="ti ti-user-minus" style={{ fontSize: 20 }} />
            </div>
            <h3 className="text-sm font-extrabold mb-2" style={{ color: "#0F1728" }}>Churn prediction</h3>
            <p className="text-sm font-medium leading-relaxed mb-3" style={{ color: "#6B7280" }}>
              Tori analyses each subscription&apos;s payment history, dunning depth, and period proximity to flag customers at risk of churning before they actually cancel.
            </p>
            <div className="rounded-lg p-3" style={{ background: "#FFF8E1", border: "1px solid #FDE68A" }}>
              <p className="text-xs font-bold mb-1" style={{ color: "#0F1728" }}>2 subscriptions at high risk</p>
              <p className="text-xs font-medium" style={{ color: "#6B7280" }}>Payment failing and retries are in progress. Billing period ends soon.</p>
              <p className="text-xs font-semibold mt-2" style={{ color: "#B8860B" }}>Recommended: contact customer and offer payment help</p>
            </div>
          </div>

          <div className="rounded-xl p-5 border" style={{ borderColor: "#E5E7EB" }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: "#E8EFF9", color: "#2563A8" }}>
              <i className="ti ti-chart-arrows-vertical" style={{ fontSize: 20 }} />
            </div>
            <h3 className="text-sm font-extrabold mb-2" style={{ color: "#0F1728" }}>Revenue forecasting</h3>
            <p className="text-sm font-medium leading-relaxed mb-3" style={{ color: "#6B7280" }}>
              Tori projects next month&apos;s expected revenue from current subscription state and your historical dunning recovery rate. Low, mid, and high estimates with confidence level.
            </p>
            <div className="rounded-lg p-3" style={{ background: "#F8F9FA" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "#8A94A6" }}>Next month forecast</p>
              <div className="flex items-end gap-3">
                <div>
                  <p className="text-[10px] font-semibold" style={{ color: "#9CA3AF" }}>Low</p>
                  <p className="text-sm font-extrabold" style={{ color: "#6B7280" }}>₦3.8M</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold" style={{ color: "#9CA3AF" }}>Mid</p>
                  <p className="text-xl font-extrabold" style={{ color: "#0F1728" }}>₦4.2M</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold" style={{ color: "#9CA3AF" }}>High</p>
                  <p className="text-sm font-extrabold" style={{ color: "#00B37E" }}>₦4.4M</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Customer portal section */}
      <section className="px-6 lg:px-10 py-14 border-t" style={{ borderColor: "#F0F0F0", background: "#FAFAF8" }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Customer portal</div>
              <h2 className="text-3xl lg:text-4xl font-extrabold mb-4" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
                Customers self-serve.<br className="hidden lg:block" /> You stop answering billing emails.
              </h2>
              <p className="text-lg mb-6" style={{ color: "#6B7280" }}>
                Every subscription business gets flooded with the same requests: pause my subscription, cancel it, I want to change my plan. Tori handles all of this without you being involved.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  "Generate a portal link for any customer with one API call",
                  "Customer opens the link and sees their subscription and plan",
                  "They can pause, resume, or cancel with a confirmation step",
                  "Tori fires the webhook. Your product reacts. You do nothing.",
                  "Link expires after one hour for security",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm font-medium" style={{ color: "#4B5563" }}>
                    <i className="ti ti-check flex-shrink-0 mt-0.5" style={{ fontSize: 16, color: "#00B37E" }} />{item}
                  </li>
                ))}
              </ul>
              <div className="rounded-lg p-3" style={{ background: "#0F1728" }}>
                <div className="text-xs font-mono" style={{ color: "#9CA3AF" }}>
                  <span style={{ color: "#00B37E" }}>GET</span> /v1/platform/customers/{"{id}"}/portal-token
                </div>
                <div className="text-xs font-mono mt-1" style={{ color: "#9CA3AF" }}>{`// Returns a token valid for 1 hour`}</div>
                <div className="text-xs font-mono mt-1" style={{ color: "#9CA3AF" }}>{`// Redirect to: /portal?token=eyJ...`}</div>
              </div>
            </div>
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
              <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "#E5E7EB", background: "#fff" }}>
                <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "#0F1728" }}>
                  <svg viewBox="0 0 14 14" className="w-3 h-3"><path d="M7 1L11.5 3.75V8.25L7 11L2.5 8.25V3.75L7 1Z" fill="#00B37E" /></svg>
                </div>
                <span className="text-sm font-extrabold" style={{ color: "#0F1728" }}>Tori</span>
                <span className="text-xs font-medium ml-1" style={{ color: "#8A94A6" }}>Billing portal</span>
              </div>
              <div className="p-5" style={{ background: "#FAFAF8" }}>
                <div className="bg-white rounded-xl p-4 border mb-3" style={{ borderColor: "#E5E7EB" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm" style={{ background: "#E6F8F2", color: "#00B37E" }}>AO</div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "#0F1728" }}>Amaka Obi</p>
                      <p className="text-xs font-medium" style={{ color: "#8A94A6" }}>amaka@startup.ng</p>
                    </div>
                  </div>
                  <div className="rounded-lg p-3 border" style={{ borderColor: "#E5E7EB" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold" style={{ color: "#0F1728" }}>Pro plan</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#E3F7EF", color: "#0A7A56" }}>ACTIVE</span>
                    </div>
                    <p className="text-xs font-medium mb-3" style={{ color: "#6B7280" }}>₦25,000/month · Next billing June 30</p>
                    <div className="flex gap-2">
                      <button className="text-xs font-bold px-3 py-1.5 rounded-lg border" style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>Pause</button>
                      <button className="text-xs font-bold px-3 py-1.5 rounded-lg border" style={{ borderColor: "#FDCACA", color: "#DC2626" }}>Cancel</button>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] font-medium text-center" style={{ color: "#C4CACD" }}>Powered by Tori · Secure billing portal</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Financial visibility */}
      <section className="px-6 lg:px-10 py-16 lg:py-20 max-w-5xl mx-auto">
        <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Financial visibility</div>
        <h2 className="text-3xl lg:text-4xl font-extrabold mb-4" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>Know your numbers. Always.</h2>
        <p className="text-lg mb-10 max-w-2xl" style={{ color: "#6B7280" }}>
          Tori keeps a tamper-proof record of every naira that moves through your billing. Not a spreadsheet. Not an estimate. An immutable ledger that investors and auditors can trust.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
          {[
            ["MRR (Monthly Recurring Revenue)", "The total amount your subscribers pay you every month. Tori computes this directly from actual charges, not forecasts or estimates."],
            ["Churn rate", "The percentage of customers who cancelled in a given period. Tori tracks this automatically so you always know if you are growing or shrinking."],
            ["Dunning recovery rate", "Of all the payments that failed, how many did Tori eventually recover through retries? This is money you would have lost without a smart retry system."],
            ["Net revenue", "Gross charges minus refunds and credits. The real money in your account after everything is accounted for. Reconcilable to the kobo."],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-xl p-5 border" style={{ borderColor: "#E5E7EB" }}>
              <h3 className="text-sm font-extrabold mb-2" style={{ color: "#0F1728" }}>{title}</h3>
              <p className="text-sm font-medium leading-relaxed" style={{ color: "#6B7280" }}>{desc}</p>
            </div>
          ))}
        </div>
        <div className="rounded-2xl p-5 border" style={{ borderColor: "#E5E7EB", background: "#F8F9FA" }}>
          <div className="flex items-center gap-2 mb-3">
            <i className="ti ti-shield-lock" style={{ fontSize: 18, color: "#00B37E" }} />
            <span className="text-sm font-extrabold" style={{ color: "#0F1728" }}>The tamper-proof ledger</span>
          </div>
          <p className="text-sm font-medium leading-relaxed" style={{ color: "#4B5563" }}>
            Every financial event (every charge, refund, credit, and adjustment) writes one immutable row to the ledger. Nothing is ever edited or deleted. If your investor asks &quot;show me exactly where this number comes from&quot;, you can show them the exact entries behind it. That is the level of financial trust Tori is built to provide.
          </p>
        </div>
      </section>

      {/* Architecture */}
      <section className="px-6 lg:px-10 py-14 border-t" style={{ borderColor: "#F0F0F0", background: "#FAFAF8" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Architecture</div>
          <h2 className="text-3xl lg:text-4xl font-extrabold mb-4" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
            Your product talks to Tori.<br className="hidden lg:block" /> Tori talks to Nomba.
          </h2>
          <p className="text-lg mb-10 max-w-2xl" style={{ color: "#6B7280" }}>
            Tori is not a payment processor. Nomba moves the money. Tori is the orchestration layer that decides when to charge, what to do when it fails, and how to record what happened.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 lg:gap-4 mb-10">
            {[
              { label: "Your product", sub: "Laravel, Node.js, any stack", icon: "ti-device-laptop", bg: "#E8EFF9", color: "#2563A8" },
              { label: "Tori", sub: "Subscription engine", icon: "ti-refresh", bg: "#E6F8F2", color: "#00B37E" },
              { label: "Nomba", sub: "Payment processor", icon: "ti-credit-card", bg: "#FDF0D5", color: "#B8860B" },
              { label: "Customer bank", sub: "Where the naira goes", icon: "ti-building-bank", bg: "#F1F3F5", color: "#6B7280" },
            ].map((item, i) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2 mx-auto" style={{ background: item.bg }}>
                    <i className={`ti ${item.icon}`} style={{ fontSize: 24, color: item.color }} />
                  </div>
                  <p className="text-xs font-extrabold" style={{ color: "#0F1728" }}>{item.label}</p>
                  <p className="text-[10px] font-medium" style={{ color: "#8A94A6" }}>{item.sub}</p>
                </div>
                {i < 3 && (
                  <div className="flex items-center gap-1">
                    <div className="w-6 h-0.5" style={{ background: "#E5E7EB" }} />
                    <i className="ti ti-arrow-right" style={{ fontSize: 14, color: "#9CA3AF" }} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ["ti-lock", "Security", "Argon2id passwords, SHA-256 API keys, HMAC-SHA256 webhooks, Redis token revocation, brute force protection"],
              ["ti-users", "Multi-tenant", "Every resource is tenant-scoped. Cross-tenant data access is impossible by design. Tested at every query level."],
              ["ti-database", "Immutable ledger", "Every charge, refund, and adjustment writes one append-only row. Nothing is ever edited. Full audit trail always."],
              ["ti-webhook", "Reliable webhooks", "HMAC-signed deliveries with retry schedule. Circuit breaker after 10 failures. Every delivery logged and replayable."],
            ].map(([icon, title, desc]) => (
              <div key={title} className="bg-white rounded-xl p-4 border" style={{ borderColor: "#E5E7EB" }}>
                <i className={`ti ${icon} mb-2 block`} style={{ fontSize: 20, color: "#00B37E" }} />
                <h3 className="text-xs font-extrabold mb-1" style={{ color: "#0F1728" }}>{title}</h3>
                <p className="text-xs font-medium leading-relaxed" style={{ color: "#6B7280" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-4 lg:mx-10 my-12 lg:my-16 rounded-2xl p-10 lg:p-14 text-center max-w-5xl xl:mx-auto" style={{ background: "#0F1728" }}>
        <h2 className="text-3xl lg:text-4xl font-extrabold mb-4 text-white" style={{ letterSpacing: "-0.02em" }}>
          Your next product deserves better billing.
        </h2>
        <p className="text-lg mb-3" style={{ color: "#9CA3AF" }}>
          Tori is the billing infrastructure that should have existed for Nigerian builders from day one.
        </p>
        <p className="text-base mb-8" style={{ color: "#6B7280" }}>Built on Nomba. Free to start. One API call to go live.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/signup" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg font-bold text-[15px]" style={{ background: "#00B37E", color: "white" }}>
            Create your free account <i className="ti ti-arrow-right" />
          </Link>
          <Link href="/docs" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg font-bold text-[15px] border" style={{ borderColor: "#374151", color: "#9CA3AF" }}>
            Read the docs
          </Link>
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: "#E5E7EB" }}>
        <div className="px-6 lg:px-10 py-10 max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "#0F1728" }}>
                <svg viewBox="0 0 14 14" className="w-3.5 h-3.5"><path d="M7 1L11.5 3.75V8.25L7 11L2.5 8.25V3.75L7 1Z" fill="#00B37E" /></svg>
              </div>
              <span className="text-xl font-extrabold tracking-tight" style={{ color: "#0F1728" }}>Tori</span>
            </div>
            <p className="text-sm font-medium mb-3" style={{ color: "#6B7280" }}>Recurring billing infrastructure for Nigerian businesses. Built natively on Nomba&apos;s payment rails.</p>
            <p className="text-xs font-medium" style={{ color: "#9CA3AF" }}>Nomba x DevCareer Hackathon 2026</p>
          </div>
          {[
            ["Product", ["Plans", "Subscriptions", "Dunning engine", "Ledger and FinOps", "Webhooks", "Customer portal"]],
            ["Developers", ["Documentation", "API Reference", "Integration guides", "Changelog"]],
            ["Company", ["About", "Contact", "Privacy"]],
          ].map(([title, links]) => (
            <div key={title as string}>
              <p className="text-sm font-extrabold mb-3" style={{ color: "#0F1728" }}>{title}</p>
              {(links as string[]).map(link => (
                <a key={link} href="#" className="block text-sm font-medium py-1" style={{ color: "#6B7280" }}>{link}</a>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t px-6 lg:px-10 py-5 flex flex-wrap gap-4 justify-between items-center max-w-6xl mx-auto" style={{ borderColor: "#E5E7EB" }}>
          <span className="text-sm font-medium" style={{ color: "#9CA3AF" }}>2026 Tori · Built on Nomba</span>
          <div className="flex gap-5">
            <a href="https://github.com/chibuike-kt" className="text-sm font-semibold" style={{ color: "#6B7280" }}>GitHub</a>
            <a href="https://twitter.com/chibuike_kt" className="text-sm font-semibold" style={{ color: "#6B7280" }}>Twitter</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

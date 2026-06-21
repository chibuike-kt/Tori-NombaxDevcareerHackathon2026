"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>

      {/* Nav */}
      <nav className="border-b" style={{ borderColor: "#F0F0F0" }}>
        <div className="flex items-center px-10 py-5 max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mr-10">
            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: "#0F1728" }}>
              <svg viewBox="0 0 14 14" className="w-4 h-4"><path d="M7 1L11.5 3.75V8.25L7 11L2.5 8.25V3.75L7 1Z" fill="#00B37E" /></svg>
            </div>
            <span className="text-2xl font-extrabold tracking-tight" style={{ color: "#0F1728" }}>Tori</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#problem" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Why Tori</a>
            <a href="#how" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>How it works</a>
            <Link href="/docs" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Docs</Link>
            <a href="#pricing" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Pricing</a>
          </div>
          <div className="flex items-center gap-5 ml-auto">
            <Link href="/login" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Log in</Link>
            <Link href="/signup" className="text-[15px] px-5 py-2.5 rounded-lg font-bold text-white" style={{ background: "#0F1728" }}>Create free account</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-10 pt-16 pb-14 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold mb-6" style={{ background: "#E6F8F2", color: "#0F6E56" }}>
              <i className="ti ti-sparkles" /> Built natively on Nomba · Nomba × DevCareer 2026
            </div>
            <h1 className="text-6xl font-extrabold leading-none mb-5" style={{ color: "#0F1728", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
              Stop rebuilding<br />billing from scratch<br /><span style={{ color: "#00B37E" }}>every single time.</span>
            </h1>
            <p className="text-xl mb-4" style={{ color: "#4B5563", lineHeight: 1.6 }}>
              Every Nigerian SaaS, edtech, and creator platform that charges customers monthly has had to build the same billing system from scratch. Subscriptions, payment retries, churn tracking, invoices — all of it, from zero, every time.
            </p>
            <p className="text-xl mb-8 font-semibold" style={{ color: "#0F1728", lineHeight: 1.6 }}>
              Tori is that billing system. Built once. Available to every business on Nomba.
            </p>
            <div className="flex gap-3 mb-10">
              <Link href="/signup" className="flex items-center gap-2 px-7 py-4 rounded-lg text-white font-bold text-[15px]" style={{ background: "#0F1728" }}>
                Start for free <i className="ti ti-arrow-right" />
              </Link>
              <Link href="/docs" className="flex items-center gap-2 px-7 py-4 rounded-lg font-bold text-[15px] border" style={{ borderColor: "#D1D5DB", color: "#0F1728" }}>
                Read the docs
              </Link>
            </div>
            <p className="text-sm font-semibold" style={{ color: "#9CA3AF" }}>Free to start · No setup fee · No contracts</p>
          </div>

          <div className="relative">
            <div className="rounded-2xl p-4" style={{ background: "#0F1728" }}>
              <div className="flex gap-1.5 mb-3.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#E24B4A" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#00B37E" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#63AA22" }} />
              </div>
              <div className="text-xs font-mono mb-3" style={{ color: "#9CA3AF" }}># The entire integration. Three API calls.</div>
              <div className="space-y-1 mb-4">
                {[
                  ["POST", "/v1/platform/plans", '{ "name": "Pro", "amount": 1500000 }'],
                  ["POST", "/v1/platform/customers", '{ "email": "amaka@startup.ng" }'],
                  ["POST", "/v1/platform/subscriptions", '{ "customer_id": "...", "plan_id": "..." }'],
                ].map(([method, path, body]) => (
                  <div key={path} className="rounded-lg p-3" style={{ background: "#1A2436" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold" style={{ color: "#00B37E" }}>{method}</span>
                      <span className="text-xs font-mono" style={{ color: "#E5E7EB" }}>{path}</span>
                    </div>
                    <div className="text-xs font-mono" style={{ color: "#9CA3AF" }}>{body}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg p-3" style={{ background: "#0A2A1A", border: "1px solid #00B37E33" }}>
                <div className="text-xs font-bold mb-1" style={{ color: "#00B37E" }}>✓ Tori handles everything after this</div>
                <div className="text-xs font-mono" style={{ color: "#9CA3AF" }}>Monthly charges · Card failure retries · Revenue ledger · Webhooks</div>
              </div>
            </div>
            <div className="absolute -top-4 -right-4 bg-white rounded-xl px-4 py-3 flex items-center gap-2.5" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#E6F8F2", color: "#00B37E" }}><i className="ti ti-trending-up" /></div>
              <div>
                <div className="text-xs font-bold" style={{ color: "#0F1728" }}>₦4.2M MRR</div>
                <div className="text-[10px] font-medium" style={{ color: "#6B7280" }}>tracked automatically</div>
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 bg-white rounded-xl px-4 py-3 flex items-center gap-2.5" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#E6F8F2", color: "#00B37E" }}><i className="ti ti-refresh" /></div>
              <div>
                <div className="text-xs font-bold" style={{ color: "#0F1728" }}>₦340K recovered</div>
                <div className="text-[10px] font-medium" style={{ color: "#6B7280" }}>from failed payments</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="flex justify-center gap-16 px-10 py-8 border-t border-b" style={{ background: "#FAFAF8", borderColor: "#EEE" }}>
        {[["₦0", "Setup fee"], ["3", "API calls to go live"], ["7", "Subscription states"], ["68%", "Avg dunning recovery"]].map(([v, l]) => (
          <div key={l} className="text-center">
            <div className="text-3xl font-extrabold" style={{ color: "#0F1728" }}>{v}</div>
            <div className="text-sm mt-1 font-medium" style={{ color: "#6B7280" }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Problem section */}
      <section id="problem" className="px-10 py-20 max-w-5xl mx-auto">
        <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>The problem</div>
        <h2 className="text-4xl font-extrabold mb-4" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
          Nigerian founders spend months on billing.<br />Then their competitor does too.
        </h2>
        <p className="text-lg mb-12 max-w-2xl" style={{ color: "#6B7280" }}>
          Every subscription business needs the same infrastructure. The problem is everyone builds it from scratch.
        </p>
        <div className="grid grid-cols-2 gap-6">
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
                "Build a system to suspend access when someone doesn't pay",
                "Track who paid, who didn't, and how much you've made",
                "Handle customer cancellations, pauses, and refunds",
                "Build it again for your next product",
                "Watch a GTBank card fail 4 times because it's blocked for online payments",
              ].map(i => (
                <li key={i} className="flex items-start gap-2.5 text-sm font-medium" style={{ color: "#4B5563" }}>
                  <i className="ti ti-circle-x mt-0.5 flex-shrink-0" style={{ fontSize: 16, color: "#DC2626" }} />
                  {i}
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
                "Create a plan in one API call — ₦15,000/month, done",
                "Add a customer and start their subscription in two more calls",
                "Tori charges them automatically every month via Nomba",
                "When a card fails, Tori classifies it and retries intelligently",
                "Customers get suspended if they don't pay after retries",
                "Every naira in and out is recorded in an immutable ledger",
                "Your MRR, churn, and recovery metrics update in real time",
              ].map(i => (
                <li key={i} className="flex items-start gap-2.5 text-sm font-medium" style={{ color: "#166534" }}>
                  <i className="ti ti-circle-check mt-0.5 flex-shrink-0" style={{ fontSize: 16, color: "#16A34A" }} />
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-10 py-16 border-t border-b" style={{ borderColor: "#F0F0F0", background: "#FAFAF8" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Who uses Tori</div>
          <h2 className="text-4xl font-extrabold mb-10" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>Built for Nigerian builders charging recurring revenue</h2>
          <div className="grid grid-cols-3 gap-5">
            {[
              ["ti-building-store", "SaaS founders", "You built software that solves a real problem and charge ₦5,000–₦50,000/month. You need billing that just works so you can focus on the product."],
              ["ti-school", "Edtech platforms", "You charge school fees termly or tuition monthly. You need a billing system that handles irregular schedules and gives parents a clean way to pay."],
              ["ti-microphone", "Creator platforms", "You sell memberships, courses, or exclusive content. High volume, low value per charge — you need dunning recovery to not leave money on the table."],
              ["ti-heart-handshake", "Membership businesses", "Gyms, professional associations, subscription boxes. You need pause and resume, not just cancel, because life happens and customers come back."],
              ["ti-device-laptop", "Developer platforms", "API-first tools charging per seat or per month. You need a platform API your own customers can integrate with, not just a dashboard."],
              ["ti-chart-bar", "Fintech builders", "You're building on Nomba's rails and need the financial infrastructure layer — ledger, audit trail, and revenue metrics — without starting from scratch."],
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
      <section id="how" className="px-10 py-20 max-w-5xl mx-auto">
        <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>How it works</div>
        <h2 className="text-4xl font-extrabold mb-4" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>From zero to billing in one afternoon</h2>
        <p className="text-lg mb-12" style={{ color: "#6B7280" }}>No billing engineer required. No months of work. Just three API calls and a webhook listener.</p>
        <div className="space-y-5">
          {[
            ["1", "Create a billing plan", "Define what you charge and how often. ₦15,000/month, ₦150,000/year, or a custom interval — termly fees, quarterly retainers, anything. Set a free trial period if you want customers to experience the product before paying.", 'POST /v1/platform/plans\n{ "name": "Pro", "amount": 1500000, "interval": "monthly", "trial_period_days": 14 }'],
            ["2", "Add your customer", "When someone signs up on your product, create a matching customer in Tori. Pass your own customer ID so you can always link the two. Tori stores their billing relationship from that point.", 'POST /v1/platform/customers\n{ "email": "amaka@startup.ng", "external_id": "your-user-123" }'],
            ["3", "Start their subscription", "Link the customer to a plan and Tori takes over. It charges them through Nomba every cycle, handles failures, retries intelligently, and keeps the financial record.", 'POST /v1/platform/subscriptions\n{ "customer_id": "cus_...", "plan_id": "plan_..." }'],
            ["4", "React to events in your product", "Tori sends a webhook to your server every time something billing-related happens. Your product listens and acts — suspend access on payment failure, restore it when recovered, send a receipt on success.", 'subscription.activated → unlock access\npayment.failed → show payment warning\ndunning.recovered → restore full access\nsubscription.cancelled → offboard gracefully'],
          ].map(([num, title, desc, code]) => (
            <div key={num} className="grid grid-cols-2 gap-8 items-start p-6 rounded-2xl border" style={{ borderColor: "#E5E7EB" }}>
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

      {/* Nigerian dunning section */}
      <section className="px-10 py-16 border-t" style={{ borderColor: "#F0F0F0", background: "#FAFAF8" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Nigerian-first dunning</div>
          <h2 className="text-4xl font-extrabold mb-4" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
            Card failures in Nigeria are different.<br />Your billing engine should know that.
          </h2>
          <p className="text-lg mb-10 max-w-2xl" style={{ color: "#6B7280" }}>
            American billing tools retry immediately when a card fails. That doesn&apos;t work in Nigeria. Tori was built for how Nigerian cards actually behave.
          </p>
          <div className="grid grid-cols-3 gap-5 mb-10">
            {[
              ["ti-credit-card-off", "Blocked cards", "Many Nigerian cards are issued blocked for online transactions by default. Tori recognises this immediately and stops retrying — so you don't waste 4 attempts on a card that can never succeed."],
              ["ti-calendar", "Payday retries", "Insufficient funds often clear after salary day. Tori spaces retries to land after typical payday windows — Day 3, Day 7, Day 14, Day 21 — maximising recovery."],
              ["ti-wifi-off", "Bank outages", "Nigerian bank systems go down. When a failure looks like a temporary issuer issue, Tori classifies it as retriable and waits — not a reason to immediately suspend the customer."],
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
                <h3 className="text-base font-extrabold mb-1" style={{ color: "#0F1728" }}>What dunning recovery actually means in money</h3>
                <p className="text-sm font-medium leading-relaxed" style={{ color: "#166534" }}>
                  If you have 500 subscribers at ₦10,000/month and 8% of payments fail each month, that&apos;s ₦400,000 at risk every cycle. Without smart dunning, you lose most of it. With Tori&apos;s Nigerian-tuned retry logic, a significant portion of that comes back — automatically, with no action from you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What Tori tracks */}
      <section className="px-10 py-20 max-w-5xl mx-auto">
        <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Financial visibility</div>
        <h2 className="text-4xl font-extrabold mb-4" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>Know your numbers. Always.</h2>
        <p className="text-lg mb-10 max-w-2xl" style={{ color: "#6B7280" }}>
          Tori keeps a tamper-proof record of every naira that moves through your billing. Not a spreadsheet. Not an estimate. An immutable ledger that investors and auditors can trust.
        </p>
        <div className="grid grid-cols-2 gap-5 mb-10">
          {[
            ["MRR (Monthly Recurring Revenue)", "The total amount your subscribers pay you every month. Tori computes this directly from actual charges — not forecasts or estimates."],
            ["Churn rate", "The percentage of customers who cancelled in a given period. Lower is better. Tori tracks this automatically so you always know if you're growing or shrinking."],
            ["Dunning recovery rate", "Of all the payments that failed, how many did Tori eventually recover through retries? This is money you would have lost without a smart retry system."],
            ["Net revenue", "Gross charges minus refunds and credits. The real money in your account after everything is accounted for. Reconcilable to the cent."],
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
            Every financial event — every charge, refund, credit, and adjustment — writes one immutable row to the ledger. Nothing is ever edited or deleted. If your investor asks &quot;show me exactly where this number comes from&quot;, you can show them the exact entries behind it. That&apos;s the level of financial trust Tori is built to provide.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-10 py-16 border-t" style={{ borderColor: "#F0F0F0", background: "#FAFAF8" }}>
        <div className="max-w-5xl mx-auto text-center">
          <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Pricing</div>
          <h2 className="text-4xl font-extrabold mb-4" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>Simple. No surprises.</h2>
          <p className="text-lg mb-10" style={{ color: "#6B7280" }}>Start for free. Pay only when you&apos;re making money.</p>
          <div className="grid grid-cols-3 gap-5 text-left">
            {[
              { name: "Starter", price: "Free", desc: "For early-stage products testing recurring billing.", features: ["Up to 50 active subscriptions", "Basic dunning (2 retries)", "Ledger and revenue tracking", "Webhook events", "Dashboard access"] },
              { name: "Growth", price: "₦25,000/mo", desc: "For products with real recurring revenue.", features: ["Unlimited subscriptions", "Smart dunning (4 retries, Nigerian-tuned)", "Full ledger and FinOps suite", "Priority webhook delivery", "Platform API access", "Email support"], highlight: true },
              { name: "Scale", price: "Custom", desc: "For high-volume billing at enterprise scale.", features: ["Everything in Growth", "Custom dunning schedules", "Dedicated support", "SLA guarantees", "Audit exports"] },
            ].map(plan => (
              <div key={plan.name} className="bg-white rounded-2xl p-6 border" style={{ borderColor: plan.highlight ? "#00B37E" : "#E5E7EB", borderWidth: plan.highlight ? 2 : 1 }}>
                {plan.highlight && <div className="text-xs font-extrabold px-3 py-1 rounded-full mb-3 inline-block" style={{ background: "#E6F8F2", color: "#00B37E" }}>MOST POPULAR</div>}
                <h3 className="text-lg font-extrabold mb-1" style={{ color: "#0F1728" }}>{plan.name}</h3>
                <div className="text-3xl font-extrabold mb-1" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>{plan.price}</div>
                <p className="text-sm font-medium mb-4" style={{ color: "#6B7280" }}>{plan.desc}</p>
                <ul className="space-y-2 mb-5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm font-medium" style={{ color: "#4B5563" }}>
                      <i className="ti ti-check flex-shrink-0" style={{ fontSize: 16, color: "#00B37E" }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="block text-center py-3 rounded-lg font-bold text-sm" style={{ background: plan.highlight ? "#0F1728" : "#F1F3F5", color: plan.highlight ? "white" : "#0F1728" }}>
                  {plan.name === "Scale" ? "Contact us" : "Get started"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-10 my-16 rounded-2xl p-14 text-center max-w-5xl xl:mx-auto" style={{ background: "#0F1728" }}>
        <h2 className="text-4xl font-extrabold mb-4 text-white" style={{ letterSpacing: "-0.02em" }}>
          Your next product deserves better billing.
        </h2>
        <p className="text-lg mb-3" style={{ color: "#9CA3AF" }}>
          Tori is the billing infrastructure that should have existed for Nigerian builders from day one.
        </p>
        <p className="text-base mb-8" style={{ color: "#6B7280" }}>
          Built on Nomba. Free to start. Three API calls to go live.
        </p>
        <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-[15px]" style={{ background: "#00B37E", color: "white" }}>
          Create your free account <i className="ti ti-arrow-right" />
        </Link>
      </section>

      <footer className="border-t" style={{ borderColor: "#E5E7EB" }}>
        <div className="px-10 py-10 max-w-6xl mx-auto grid grid-cols-5 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "#0F1728" }}>
                <svg viewBox="0 0 14 14" className="w-3.5 h-3.5"><path d="M7 1L11.5 3.75V8.25L7 11L2.5 8.25V3.75L7 1Z" fill="#00B37E" /></svg>
              </div>
              <span className="text-xl font-extrabold tracking-tight" style={{ color: "#0F1728" }}>Tori</span>
            </div>
            <p className="text-sm font-medium mb-3" style={{ color: "#6B7280" }}>Recurring billing infrastructure for Nigerian businesses. Built natively on Nomba&apos;s payment rails.</p>
            <p className="text-xs font-medium" style={{ color: "#9CA3AF" }}>Nomba × DevCareer Hackathon 2026</p>
          </div>
          {[
            ["Product", ["Plans", "Subscriptions", "Dunning engine", "Ledger & FinOps", "Webhooks"]],
            ["Developers", ["Documentation", "API Reference", "Changelog", "Status"]],
            ["Company", ["About", "Pricing", "Contact", "Privacy"]],
          ].map(([title, links]) => (
            <div key={title as string}>
              <p className="text-sm font-extrabold mb-3" style={{ color: "#0F1728" }}>{title}</p>
              {(links as string[]).map(link => (
                <a key={link} href="#" className="block text-sm font-medium py-1" style={{ color: "#6B7280" }}>{link}</a>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t px-10 py-5 flex justify-between items-center max-w-6xl mx-auto" style={{ borderColor: "#E5E7EB" }}>
          <span className="text-sm font-medium" style={{ color: "#9CA3AF" }}>© 2026 Tori · Built on Nomba</span>
          <div className="flex gap-5">
            <a href="https://github.com/chibuike-kt" className="text-sm font-semibold" style={{ color: "#6B7280" }}>GitHub</a>
            <a href="https://twitter.com/chibuike_kt" className="text-sm font-semibold" style={{ color: "#6B7280" }}>Twitter</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

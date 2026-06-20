"use client";

import Link from "next/link";

const features = [
  ["ti-refresh", "Smart dunning for Nigeria", "Classifies card failures as retriable or permanent. Knows GTBank cards block online transactions. Retries on payday timing."],
  ["ti-shield-check", "Tamper-proof ledger", "Every naira in and out recorded in an append-only ledger. Your audit trail for investors, regulators, and your finance team."],
  ["ti-plug", "One API call to bill", "POST /subscriptions with a customer and plan. Tori handles renewals, failures, retries, and cancellations after that."],
  ["ti-user-check", "Self-service portal", "Nigerian customers cancel, pause, and view invoices without calling anyone. Reduces chargebacks. Builds trust."],
  ["ti-chart-line", "Real revenue metrics", "MRR, ARR, churn, dunning recovery — computed from your actual ledger, not estimates. Numbers investors trust."],
  ["ti-webhook", "Versioned webhooks", "Clean events your product reacts to. Replayable if your server goes down. Never miss a billing event."],
];

export default function LandingPage() {
  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <nav className="border-b" style={{ borderColor: "#F0F0F0" }}>
        <div className="flex items-center px-10 py-5 max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mr-10">
            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: "#0F1728" }}>
              <svg viewBox="0 0 14 14" className="w-4 h-4"><path d="M7 1L11.5 3.75V8.25L7 11L2.5 8.25V3.75L7 1Z" fill="#00B37E" /></svg>
            </div>
            <span className="text-2xl font-extrabold tracking-tight" style={{ color: "#0F1728" }}>Tori</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#features" className="flex items-center gap-1 text-[15px] font-semibold" style={{ color: "#0F1728" }}>Products <i className="ti ti-chevron-down" style={{ fontSize: 15 }} /></a>
            <a href="#how" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Developer</a>
            <a href="#features" className="flex items-center gap-1 text-[15px] font-semibold" style={{ color: "#0F1728" }}>Use cases <i className="ti ti-chevron-down" style={{ fontSize: 15 }} /></a>
            <a href="/docs" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Docs</a>
          </div>
          <div className="flex items-center gap-5 ml-auto">
            <Link href="/login" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Log in</Link>
            <Link href="/signup" className="text-[15px] px-5 py-2.5 rounded-lg font-bold text-white" style={{ background: "#0F1728" }}>Create free account</Link>
          </div>
        </div>
      </nav>

      <section className="grid grid-cols-2 gap-10 px-10 pt-14 pb-16 items-center max-w-6xl mx-auto">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold mb-7" style={{ background: "#E6F8F2", color: "#0F6E56" }}>
            <i className="ti ti-sparkles" /> Built natively on Nomba&apos;s payment rails
          </div>
          <h1 className="text-6xl font-extrabold leading-none mb-6" style={{ color: "#0F1728", letterSpacing: "-0.03em" }}>
            Recurring billing in<br /><span style={{ color: "#00B37E" }}>one API call</span>
          </h1>
          <p className="text-xl mb-8 max-w-md" style={{ color: "#4B5563", lineHeight: 1.55 }}>
            Tori is the subscription infrastructure missing from Nomba. Plans, dunning, invoices, and a tamper-proof ledger — without rebuilding anything.
          </p>
          <div className="flex gap-3 mb-14">
            <Link href="/signup" className="flex items-center gap-2 px-7 py-4 rounded-lg text-white font-bold text-[15px]" style={{ background: "#0F1728" }}>
              Start building <i className="ti ti-arrow-right" />
            </Link>
            <a href="#features" className="px-7 py-4 rounded-lg font-bold text-[15px] border" style={{ borderColor: "#D1D5DB", color: "#0F1728" }}>Read the docs</a>
          </div>
          <div className="flex gap-10">
            {[["₦4.2M", "MRR managed"], ["847", "Subscriptions"], ["68%", "Dunning recovery"]].map(([v, l]) => (
              <div key={l}>
                <div className="text-3xl font-extrabold" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>{v}</div>
                <div className="text-sm mt-1 font-medium" style={{ color: "#6B7280" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="rounded-2xl p-4" style={{ background: "#0F1728" }}>
            <div className="flex gap-1.5 mb-3.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#E24B4A" }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#00B37E" }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#63AA22" }} />
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div className="rounded-lg p-3.5" style={{ background: "#1A2436" }}>
                <div className="text-xs mb-1.5 font-medium" style={{ color: "#9CA3AF" }}>MRR</div>
                <div className="text-xl font-bold" style={{ color: "#00B37E" }}>₦4.2M</div>
              </div>
              <div className="rounded-lg p-3.5" style={{ background: "#1A2436" }}>
                <div className="text-xs mb-1.5 font-medium" style={{ color: "#9CA3AF" }}>ACTIVE SUBS</div>
                <div className="text-xl font-bold text-white">847</div>
              </div>
            </div>
            {[["amaka@startup.ng · Pro", "ACTIVE", "#4ADE80", "rgba(0,179,126,0.2)"], ["emeka@saas.ng · Starter", "DUNNING", "#FBBF24", "rgba(251,191,36,0.2)"], ["fatima@ng.co · Pro", "ACTIVE", "#4ADE80", "rgba(0,179,126,0.2)"]].map(([t, s, c, bg]) => (
              <div key={t} className="rounded-lg px-3.5 py-3 flex justify-between items-center mb-1.5" style={{ background: "#1A2436" }}>
                <span className="text-xs font-medium" style={{ color: "#D1D5DB" }}>{t}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: c, background: bg }}>{s}</span>
              </div>
            ))}
          </div>
          <div className="absolute -top-4 -right-4 bg-white rounded-xl px-4 py-3 flex items-center gap-2.5" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#E6F8F2", color: "#00B37E" }}><i className="ti ti-shield-check" /></div>
            <div>
              <div className="text-sm font-bold" style={{ color: "#0F1728" }}>Tamper-proof ledger</div>
              <div className="text-xs font-medium" style={{ color: "#6B7280" }}>Append-only audit trail</div>
            </div>
          </div>
          <div className="absolute -bottom-4 -left-4 bg-white rounded-xl px-4 py-3 flex items-center gap-2.5" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#E6F8F2", color: "#00B37E" }}><i className="ti ti-refresh" /></div>
            <div>
              <div className="text-sm font-bold" style={{ color: "#0F1728" }}>Smart dunning</div>
              <div className="text-xs font-medium" style={{ color: "#6B7280" }}>Built for Nigerian cards</div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-center gap-16 px-10 py-8 border-t border-b" style={{ background: "#FAFAF8", borderColor: "#EEE" }}>
        {[["₦0", "Setup fee"], ["7", "Subscription states"], ["4", "Dunning retries"], ["100%", "Nomba-native"]].map(([v, l]) => (
          <div key={l} className="text-center">
            <div className="text-3xl font-extrabold" style={{ color: "#0F1728" }}>{v}</div>
            <div className="text-sm mt-1 font-medium" style={{ color: "#6B7280" }}>{l}</div>
          </div>
        ))}
      </div>

      <section id="features" className="px-10 py-20 max-w-5xl mx-auto">
        <div className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: "#00B37E" }}>Why Tori</div>
        <h2 className="text-4xl font-extrabold mb-3" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>Everything Nigerian SaaS founders need</h2>
        <p className="text-lg mb-12" style={{ color: "#6B7280" }}>Built for how Nigerian cards actually fail — not how American cards fail.</p>
        <div className="grid grid-cols-3 gap-5">
          {features.map(([icon, title, desc]) => (
            <div key={title} className="rounded-xl p-6" style={{ background: "#F8F9FA" }}>
              <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ background: "#E6F8F2", color: "#00B37E" }}>
                <i className={`ti ${icon}`} style={{ fontSize: 20 }} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: "#0F1728" }}>{title}</h3>
              <p className="text-sm leading-relaxed font-medium" style={{ color: "#6B7280" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-10 mb-20 rounded-2xl p-14 text-center max-w-6xl xl:mx-auto" style={{ background: "#0F1728" }}>
        <h2 className="text-4xl font-extrabold mb-4 text-white" style={{ letterSpacing: "-0.02em" }}>The billing infrastructure Nomba was missing.</h2>
        <p className="text-lg mb-8" style={{ color: "#9CA3AF" }}>Stop rebuilding recurring billing from scratch. Let Tori handle it.</p>
        <Link href="/signup" className="inline-flex items-center gap-2 px-7 py-4 rounded-lg font-bold text-[15px]" style={{ background: "#00B37E", color: "white" }}>
          Create your free account <i className="ti ti-arrow-right" />
        </Link>
      </section>

      <footer className="px-10 py-8 border-t flex justify-between items-center max-w-6xl mx-auto" style={{ borderColor: "#E5E7EB" }}>
        <span className="text-sm font-medium" style={{ color: "#6B7280" }}>© 2026 Tori · Built on Nomba · Nomba × DevCareer Hackathon 2026</span>
        <span className="text-sm font-medium" style={{ color: "#6B7280" }}>Docs · API Reference · Status</span>
      </footer>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Counter } from "@/components/counter";
import { useInView } from "@/lib/use-in-view";

const HEADLINE_WORDS = [
  "The",
  "recurring",
  "billing",
  "engine",
  "Nomba",
  "doesn't",
  "ship.",
];

const HOW_IT_WORKS = [
  {
    icon: "ti-credit-card",
    title: "Customer pays",
    desc: "Nomba checkout. Real card, real money. Tokenised on the first successful charge.",
  },
  {
    icon: "ti-refresh",
    title: "Subscription activates",
    desc: "The state machine governs every transition. No direct status update ever bypasses it.",
  },
  {
    icon: "ti-alert-triangle",
    title: "Payment fails",
    desc: "The recovery ladder fires: card retry, then a direct debit mandate, then a manual pay link.",
  },
  {
    icon: "ti-report-money",
    title: "Revenue recovered",
    desc: "The ledger proves every naira. Append-only, immutable, reconcilable to the kobo.",
  },
];

const FEATURES = [
  {
    icon: "ti-git-branch",
    title: "9-state machine",
    desc: "Every valid and invalid transition tested. Pure function, zero side effects, no bypassing it.",
  },
  {
    icon: "ti-calendar",
    title: "Nigerian dunning",
    desc: "Payday-aligned retries at Day 3, 7, 14, 21, because Nigerian salaries land on specific days.",
  },
  {
    icon: "ti-activity",
    title: "Recovery Command Center",
    desc: "Every at-risk, recovering, and recovered subscription in one view, with retry-now and send-pay-link.",
  },
  {
    icon: "ti-toggle-left",
    title: "Test/Live mode",
    desc: "A tori_test_ key hits Nomba sandbox, a tori_live_ key hits production. No code branching.",
  },
  {
    icon: "ti-users-group",
    title: "Team & Roles",
    desc: "Owner, admin, developer, viewer. Email invites, an audit log on every admin action.",
  },
  {
    icon: "ti-book",
    title: "Double-entry ledger",
    desc: "Append-only. Every charge, refund, and proration writes one immutable row. Nothing is edited.",
  },
];

const NUMBERS = [
  { to: 9, label: "subscription states" },
  { to: 4, label: "recovery rails" },
  { to: 21, label: "dunning schedule days" },
  { to: 1, label: "API call to start" },
];

function IntegrationSnippet() {
  const { ref, visible } = useInView<HTMLPreElement>(0.3);
  const lines = [
    "const res = await fetch('https://api.tori.ng/v1/platform/checkout', {",
    "  method: 'POST',",
    "  headers: { 'X-API-Key': process.env.TORI_API_KEY },",
    "  body: JSON.stringify({ email, plan_id, external_id: userId }),",
    "});",
  ];
  return (
    <pre
      ref={ref}
      className={`reveal-lines rounded-2xl p-6 text-sm font-mono leading-relaxed overflow-x-auto ${visible ? "is-visible" : ""}`}
      style={{ background: "#0F1728", color: "#E5E7EB" }}
    >
      {lines.map((line, i) => (
        <div key={i} style={{ transitionDelay: `${i * 90}ms` }}>
          {line}
        </div>
      ))}
    </pre>
  );
}

export default function LandingPage() {
  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      {/* Nav */}
      <nav className="border-b" style={{ borderColor: "#F0F0F0" }}>
        <div className="flex items-center px-6 py-4 max-w-6xl mx-auto">
          <div className="mr-auto lg:mr-10">
            <img src="/logo-light.svg" alt="Tori" className="h-8 w-auto" />
          </div>
          <div className="hidden lg:flex items-center gap-8 mr-auto">
            <a href="#problem" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Why Tori</a>
            <a href="#how" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>How it works</a>
            <a href="#features" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Features</a>
            <Link href="/docs" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Docs</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-[15px] font-semibold hidden sm:block" style={{ color: "#0F1728" }}>Log in</Link>
            <Link href="/signup" className="text-sm px-4 py-2.5 rounded-lg font-bold text-white" style={{ background: "#0F1728" }}>Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-10 pt-16 pb-14 max-w-5xl mx-auto text-center">
        <div
          className="animate-fade-up inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold mb-8"
          style={{ background: "#E6F8F2", color: "#0F6E56", animationDelay: "0ms" }}
        >
          <i className="ti ti-sparkles" /> Built natively on Nomba
        </div>

        <h1
          className="text-4xl lg:text-6xl font-extrabold mb-6"
          style={{ color: "#0F1728", letterSpacing: "-0.03em", lineHeight: 1.08 }}
        >
          {HEADLINE_WORDS.map((word, i) => (
            <span
              key={i}
              className="inline-block animate-fade-up mr-3"
              style={{
                animationDelay: `${120 + i * 70}ms`,
                color: word === "Nomba" || word === "ship." ? "#00B37E" : "#0F1728",
              }}
            >
              {word}
            </span>
          ))}
        </h1>

        <p
          className="animate-fade-up text-lg lg:text-xl max-w-2xl mx-auto mb-10"
          style={{ color: "#4B5563", lineHeight: 1.6, animationDelay: "700ms" }}
        >
          One API call. Every subscription state. Nigerian-aware dunning that recovers revenue your competitors write off.
        </p>

        <div
          className="animate-fade-up flex flex-wrap gap-3 justify-center"
          style={{ animationDelay: "800ms" }}
        >
          <Link href="/signup" className="flex items-center gap-2 px-6 py-3.5 rounded-lg text-white font-bold text-[15px]" style={{ background: "#0F1728" }}>
            Start building <i className="ti ti-arrow-right" />
          </Link>
          <Link href="/docs" className="flex items-center gap-2 px-6 py-3.5 rounded-lg font-bold text-[15px] border" style={{ borderColor: "#D1D5DB", color: "#0F1728" }}>
            View docs
          </Link>
        </div>
      </section>

      {/* The problem */}
      <section id="problem" className="px-6 lg:px-10 py-16 lg:py-20 max-w-5xl mx-auto">
        <Reveal>
          <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>The problem</div>
          <h2 className="text-3xl lg:text-4xl font-extrabold mb-10" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
            Nigerian card failures aren&apos;t rare. They&apos;re the default.
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Reveal delay={80}>
            <div className="h-full rounded-2xl p-6 border" style={{ borderColor: "#FDCACA", background: "#FFF5F5" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#FDCACA" }}>
                  <i className="ti ti-x" style={{ fontSize: 16, color: "#DC2626" }} />
                </div>
                <span className="font-extrabold" style={{ color: "#DC2626" }}>Without Tori</span>
              </div>
              <ul className="space-y-3">
                {[
                  "Card failure with no retry logic tuned for Nigerian banks",
                  "Silent churn. Customers just stop paying, nobody notices",
                  "Rebuilding the same billing state machine from scratch",
                  "Lost revenue with no ledger to show where it went",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm font-medium" style={{ color: "#4B5563" }}>
                    <i className="ti ti-circle-x mt-0.5 flex-shrink-0" style={{ fontSize: 16, color: "#DC2626" }} />{i}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="h-full rounded-2xl p-6 border" style={{ borderColor: "#86EFAC", background: "#F0FDF4" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#86EFAC" }}>
                  <i className="ti ti-check" style={{ fontSize: 16, color: "#16A34A" }} />
                </div>
                <span className="font-extrabold" style={{ color: "#16A34A" }}>With Tori</span>
              </div>
              <ul className="space-y-3">
                {[
                  "Automatic recovery: card retry, then mandate, then pay link",
                  "Provable ledger. Every naira in and out, immutable",
                  "One integration. Plans, checkout, webhooks, done",
                  "Payday-aligned retries that actually match salary cycles",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm font-medium" style={{ color: "#166534" }}>
                    <i className="ti ti-circle-check mt-0.5 flex-shrink-0" style={{ fontSize: 16, color: "#16A34A" }} />{i}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <div className="rounded-2xl p-6 lg:p-8 border" style={{ borderColor: "#E5E7EB", background: "#0F1728" }}>
            <p className="text-sm font-semibold mb-2" style={{ color: "#9CA3AF" }}>
              1,000 subscribers, ₦10,000/month, 10% card failure rate. No recovery system.
            </p>
            <div className="text-4xl lg:text-5xl font-extrabold" style={{ color: "#EF4444", letterSpacing: "-0.02em" }}>
              <Counter to={800000} prefix="₦" />
            </div>
            <p className="text-sm font-medium mt-2" style={{ color: "#9CA3AF" }}>
              lost every single billing cycle, recoverable with the right retry logic.
            </p>
          </div>
        </Reveal>
      </section>

      {/* How it works */}
      <section id="how" className="px-6 lg:px-10 py-16 lg:py-20 border-t" style={{ borderColor: "#F0F0F0", background: "#FAFAF8" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>How it works</div>
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-10" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
              From first charge to recovered revenue
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {HOW_IT_WORKS.map((step, i) => (
              <Reveal key={step.title} delay={i * 100}>
                <div className="h-full bg-white rounded-2xl p-5 border" style={{ borderColor: "#E5E7EB" }}>
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 text-sm font-extrabold text-white"
                    style={{ background: "#0F1728" }}
                  >
                    {i + 1}
                  </div>
                  <i className={`ti ${step.icon} block mb-2`} style={{ fontSize: 22, color: "#00B37E" }} />
                  <h3 className="text-sm font-extrabold mb-1.5" style={{ color: "#0F1728" }}>{step.title}</h3>
                  <p className="text-sm font-medium leading-relaxed" style={{ color: "#6B7280" }}>{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="px-6 lg:px-10 py-16 lg:py-20 max-w-5xl mx-auto">
        <Reveal>
          <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Everything built in</div>
          <h2 className="text-3xl lg:text-4xl font-extrabold mb-10" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
            Not a payments wrapper. A billing engine.
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 70}>
              <div
                className="h-full bg-white rounded-2xl p-5 border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                style={{ borderColor: "#E5E7EB" }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: "#E6F8F2", color: "#00B37E" }}>
                  <i className={`ti ${f.icon}`} style={{ fontSize: 20 }} />
                </div>
                <h3 className="text-sm font-extrabold mb-1.5" style={{ color: "#0F1728" }}>{f.title}</h3>
                <p className="text-sm font-medium leading-relaxed" style={{ color: "#6B7280" }}>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The numbers */}
      <section className="px-6 lg:px-10 py-14 border-t border-b" style={{ borderColor: "#F0F0F0", background: "#0F1728" }}>
        <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-10 lg:gap-16">
          {NUMBERS.map((n) => (
            <div key={n.label} className="text-center">
              <div className="text-4xl font-extrabold" style={{ color: "#00B37E", letterSpacing: "-0.02em" }}>
                <Counter to={n.to} />
              </div>
              <div className="text-sm mt-1.5 font-medium" style={{ color: "#9CA3AF" }}>{n.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Integration snippet */}
      <section className="px-6 lg:px-10 py-16 lg:py-20 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <Reveal>
            <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Integration</div>
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-4" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
              This is the whole integration.
            </h2>
            <p className="text-lg mb-4" style={{ color: "#6B7280" }}>
              This is the entire signup call ClassPay, a real school-management SaaS, uses to start billing a customer. No cron job. No retry logic. No state machine to design.
            </p>
            <p className="text-sm font-semibold" style={{ color: "#9CA3AF" }}>
              Tori handles the checkout session, the tokenised card, every renewal, every retry, and the ledger entry behind each one.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <IntegrationSnippet />
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-4 lg:mx-10 my-4 lg:my-8 rounded-2xl p-10 lg:p-14 text-center max-w-5xl xl:mx-auto" style={{ background: "#0F1728" }}>
        <Reveal>
          <h2 className="text-3xl lg:text-4xl font-extrabold mb-4 text-white" style={{ letterSpacing: "-0.02em" }}>
            Built on Nomba. Built for Nigeria.
          </h2>
          <p className="text-lg mb-8" style={{ color: "#9CA3AF" }}>
            Free to start. One API call to go live.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/signup" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg font-bold text-[15px]" style={{ background: "#00B37E", color: "white" }}>
              Start building free <i className="ti ti-arrow-right" />
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg font-bold text-[15px] border" style={{ borderColor: "#374151", color: "#9CA3AF" }}>
              Read the docs
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t mt-8" style={{ borderColor: "#E5E7EB" }}>
        <div className="px-6 lg:px-10 py-10 max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="col-span-2">
            <div className="mb-3">
              <img src="/logo-light.svg" alt="Tori" className="h-7 w-auto" />
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
              {(links as string[]).map((link) => (
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

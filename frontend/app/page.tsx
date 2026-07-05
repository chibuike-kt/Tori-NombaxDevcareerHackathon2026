"use client";

import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Counter } from "@/components/counter";
import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { StatusBar } from "@/components/status-bar";
import { ClassPayMock } from "@/components/classpay-mock";
import { CodeEditor, CodeLine, tok } from "@/components/code-editor";

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

const COMPARISON = [
  { feature: "Subscription state machine", diy: "Weeks to build, easy to corrupt", tori: "9 states, pure function, unit tested" },
  { feature: "Dunning retries", diy: "Blind exponential backoff", tori: "Payday-aligned: Day 3, 7, 14, 21" },
  { feature: "Nigerian card failure handling", diy: "Generic error, silent churn", tori: "ISO-8583 failure codes classified" },
  { feature: "Financial ledger", diy: "Usually an afterthought", tori: "Double-entry, append-only, immutable" },
  { feature: "Test/live isolation", diy: "Environment variables and prayer", tori: "tori_test_ hits sandbox, tori_live_ hits production" },
  { feature: "Recovery Command Center", diy: "Not built", tori: "At-risk, recovering, recovered — live" },
  { feature: "Time to first subscription", diy: "Weeks", tori: "One API call" },
];

const NUMBERS = [
  { to: 9, label: "subscription states", icon: "ti-git-branch" },
  { to: 4, label: "recovery rails", icon: "ti-alt-route" },
  { to: 21, label: "dunning schedule days", icon: "ti-calendar-time" },
  { to: 1, label: "API call to start", icon: "ti-bolt" },
];

const INTEGRATION_CODE = `// The entire ClassPay billing integration
const res = await fetch('https://api.tori.ng/v1/platform/checkout', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.TORI_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: customer.email,
    plan_id: 'plan_basic_monthly',
    external_id: customer.id,
    callback_url: 'https://classpay.ng/success',
  }),
});

const { checkout_url } = await res.json();
// Redirect customer to checkout_url
// Everything else — dunning, renewals, webhooks — is handled by Tori`;

function IntegrationSnippet() {
  return (
    <CodeEditor filename="integration.js" code={INTEGRATION_CODE}>
      <CodeLine n={1}>
        <span style={{ color: tok.comment }}>{"// The entire billing integration"}</span>
      </CodeLine>
      <CodeLine n={2}>
        <span style={{ color: tok.keyword }}>const</span>
        <span style={{ color: tok.plain }}> res = </span>
        <span style={{ color: tok.keyword }}>await</span>
        <span style={{ color: tok.plain }}> </span>
        <span style={{ color: tok.fn }}>fetch</span>
        <span style={{ color: tok.plain }}>(</span>
        <span style={{ color: tok.string }}>&apos;https://api.tori.ng/v1/platform/checkout&apos;</span>
        <span style={{ color: tok.plain }}>, {"{"}</span>
      </CodeLine>
      <CodeLine n={3}>
        <span style={{ color: tok.prop }}>  method</span>
        <span style={{ color: tok.plain }}>: </span>
        <span style={{ color: tok.string }}>&apos;POST&apos;</span>
        <span style={{ color: tok.plain }}>,</span>
      </CodeLine>
      <CodeLine n={4}>
        <span style={{ color: tok.prop }}>  headers</span>
        <span style={{ color: tok.plain }}>: {"{"}</span>
      </CodeLine>
      <CodeLine n={5}>
        <span style={{ color: tok.string }}>    &apos;X-API-Key&apos;</span>
        <span style={{ color: tok.plain }}>: process</span>
        <span style={{ color: tok.prop }}>.env</span>
        <span style={{ color: tok.prop }}>.TORI_API_KEY</span>
        <span style={{ color: tok.plain }}>,</span>
      </CodeLine>
      <CodeLine n={6}>
        <span style={{ color: tok.string }}>    &apos;Content-Type&apos;</span>
        <span style={{ color: tok.plain }}>: </span>
        <span style={{ color: tok.string }}>&apos;application/json&apos;</span>
        <span style={{ color: tok.plain }}>,</span>
      </CodeLine>
      <CodeLine n={7}>
        <span style={{ color: tok.plain }}>  {"}"},</span>
      </CodeLine>
      <CodeLine n={8}>
        <span style={{ color: tok.prop }}>  body</span>
        <span style={{ color: tok.plain }}>: JSON</span>
        <span style={{ color: tok.fn }}>.stringify</span>
        <span style={{ color: tok.plain }}>({"{"}</span>
      </CodeLine>
      <CodeLine n={9}>
        <span style={{ color: tok.prop }}>    email</span>
        <span style={{ color: tok.plain }}>: customer</span>
        <span style={{ color: tok.prop }}>.email</span>
        <span style={{ color: tok.plain }}>,</span>
      </CodeLine>
      <CodeLine n={10}>
        <span style={{ color: tok.prop }}>    plan_id</span>
        <span style={{ color: tok.plain }}>: </span>
        <span style={{ color: tok.string }}>&apos;plan_basic_monthly&apos;</span>
        <span style={{ color: tok.plain }}>,</span>
      </CodeLine>
      <CodeLine n={11}>
        <span style={{ color: tok.prop }}>    external_id</span>
        <span style={{ color: tok.plain }}>: customer</span>
        <span style={{ color: tok.prop }}>.id</span>
        <span style={{ color: tok.plain }}>,</span>
      </CodeLine>
      <CodeLine n={12}>
        <span style={{ color: tok.prop }}>    callback_url</span>
        <span style={{ color: tok.plain }}>: </span>
        <span style={{ color: tok.string }}>&apos;https://your-url.com/success&apos;</span>
        <span style={{ color: tok.plain }}>,</span>
      </CodeLine>
      <CodeLine n={13}>
        <span style={{ color: tok.plain }}>  {"}"}),</span>
      </CodeLine>
      <CodeLine n={14}>
        <span style={{ color: tok.plain }}>{"}"});</span>
      </CodeLine>
      <CodeLine n={15}> </CodeLine>
      <CodeLine n={16}>
        <span style={{ color: tok.keyword }}>const</span>
        <span style={{ color: tok.plain }}> {"{"} checkout_url {"}"} = </span>
        <span style={{ color: tok.keyword }}>await</span>
        <span style={{ color: tok.plain }}> res</span>
        <span style={{ color: tok.fn }}>.json</span>
        <span style={{ color: tok.plain }}>();</span>
      </CodeLine>
      <CodeLine n={17}>
        <span style={{ color: tok.comment }}>{"// Redirect customer to checkout_url"}</span>
      </CodeLine>
      <CodeLine n={18}>
        <span style={{ color: tok.comment }}>{"// Everything else — dunning, renewals, webhooks — is handled by Tori"}</span>
      </CodeLine>
    </CodeEditor>
  );
}

export default function LandingPage() {
  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      {/* Nav */}
      <nav className="border-b" style={{ borderColor: "#F0F0F0" }}>
        <div className="section-container flex items-center px-6 lg:px-10 py-4">
          <div className="mr-auto lg:mr-10">
            <img src="/logo-light.svg" alt="Tori" className="h-8 w-auto" />
          </div>
          <div className="hidden lg:flex items-center gap-8 mr-auto">
            <a href="#problem" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Why Tori</a>
            <a href="#how" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>How it works</a>
            <a href="#features" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Features</a>
            <Link href="/docs" className="text-[15px] font-semibold" style={{ color: "#0F1728" }}>Docs</Link>
            <a
              href="/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full"
              style={{ background: "#E6F8F2", color: "#0F6E56" }}
              title="Download the OpenAPI spec"
            >
              <i className="ti ti-file-code" style={{ fontSize: 12 }} /> API
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-[15px] font-semibold hidden sm:block" style={{ color: "#0F1728" }}>Log in</Link>
            <Link href="/signup" className="text-sm px-4 py-2.5 rounded-lg font-bold text-white" style={{ background: "#0F1728" }}>Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-10 py-12 lg:py-20 section-container text-center">
        <div
          className="animate-fade-up inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold mb-8"
          style={{ background: "#E6F8F2", color: "#0F6E56", animationDelay: "0ms" }}
        >
          <i className="ti ti-sparkles" /> Built natively on Nomba
        </div>

        <h1
          className="text-4xl lg:text-[80px] font-extrabold mb-6 max-w-4xl mx-auto"
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
          className="animate-fade-up flex flex-wrap gap-3 justify-center mb-14"
          style={{ animationDelay: "800ms" }}
        >
          <Link href="/signup" className="flex items-center gap-2 px-6 py-3.5 rounded-lg text-white font-bold text-[15px]" style={{ background: "#0F1728" }}>
            Start building <i className="ti ti-arrow-right" />
          </Link>
          <Link href="/docs" className="flex items-center gap-2 px-6 py-3.5 rounded-lg font-bold text-[15px] border" style={{ borderColor: "#D1D5DB", color: "#0F1728" }}>
            View docs
          </Link>
        </div>

        <Reveal delay={100}>
          <ArchitectureDiagram />
        </Reveal>
      </section>

      {/* The problem */}
      <section id="problem" className="px-6 lg:px-10 py-12 lg:py-20 section-container">
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
      <section id="how" className="px-6 lg:px-10 py-12 lg:py-20" style={{ background: "#FAFAF8" }}>
        <div className="section-container">
          <Reveal>
            <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>How it works</div>
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-12" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
              From first charge to recovered revenue
            </h2>
          </Reveal>

          {/* Desktop: connected horizontal flow with arrows between steps */}
          <div className="hidden lg:flex items-start">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} className="flex items-start flex-1">
                <Reveal delay={i * 120} className="flex-1">
                  <div className="text-center px-3">
                    <div
                      className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-base font-extrabold text-white"
                      style={{ background: "#0F1728" }}
                    >
                      {i + 1}
                    </div>
                    <i className={`ti ${step.icon} block mb-2`} style={{ fontSize: 24, color: "#00B37E" }} />
                    <h3 className="text-sm font-extrabold mb-1.5" style={{ color: "#0F1728" }}>{step.title}</h3>
                    <p className="text-sm font-medium leading-relaxed" style={{ color: "#6B7280" }}>{step.desc}</p>
                  </div>
                </Reveal>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="flex-shrink-0 pt-3">
                    <i className="ti ti-arrow-right step-arrow block" style={{ fontSize: 26, color: "#00B37E" }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile / tablet: vertical stack with a connecting line */}
          <div className="lg:hidden relative">
            <div className="absolute left-5 top-3 bottom-3 w-px" style={{ background: "#BBF7D0" }} />
            <div className="space-y-9">
              {HOW_IT_WORKS.map((step, i) => (
                <Reveal key={step.title} delay={i * 100}>
                  <div className="flex gap-4">
                    <div
                      className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold text-white"
                      style={{ background: "#0F1728" }}
                    >
                      {i + 1}
                    </div>
                    <div className="pt-1">
                      <i className={`ti ${step.icon} block mb-1.5`} style={{ fontSize: 20, color: "#00B37E" }} />
                      <h3 className="text-sm font-extrabold mb-1" style={{ color: "#0F1728" }}>{step.title}</h3>
                      <p className="text-sm font-medium leading-relaxed" style={{ color: "#6B7280" }}>{step.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ClassPay case study */}
      <section id="classpay" className="px-6 lg:px-10 py-12 lg:py-20" style={{ background: "#FAFAF8" }}>
        <div className="section-container">
          <Reveal>
            <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Case study</div>
            <h2 className="text-3xl lg:text-4xl font-extrabold mb-12" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
              See it in production.
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <Reveal>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#E6F8F2" }}>
                  <i className="ti ti-school" style={{ fontSize: 18, color: "#00B37E" }} />
                </div>
                <h3 className="text-xl font-extrabold" style={{ color: "#0F1728" }}>ClassPay</h3>
              </div>
              <p className="text-base mb-3" style={{ color: "#4B5563", lineHeight: 1.6 }}>
                A school management SaaS that handles billing for hundreds of schools across Nigeria.
              </p>
              <p className="text-sm font-semibold mb-6" style={{ color: "#00B37E" }}>
                Integration: 60 lines of code. Zero billing logic written.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-8">
                {["60 lines", "0 billing bugs", "₦0 in engineering time"].map((s) => (
                  <div key={s} className="rounded-lg px-3 py-3 text-center bg-white border" style={{ borderColor: "#E5E7EB" }}>
                    <span className="text-[13px] font-extrabold leading-tight" style={{ color: "#0F1728" }}>{s}</span>
                  </div>
                ))}
              </div>
              <a href="#classpay" className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: "#00B37E" }}>
                Try the demo <i className="ti ti-arrow-right" />
              </a>
            </Reveal>
            <Reveal delay={120}>
              <ClassPayMock />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="px-6 lg:px-10 py-12 lg:py-20 section-container">
        <Reveal>
          <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Everything built in</div>
          <h2 className="text-3xl lg:text-4xl font-extrabold mb-10" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
            Not a payments wrapper. A billing engine.
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 70}>
              <div className="feature-card h-full rounded-2xl p-6">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "#F0FDF9" }}
                >
                  <i className={`ti ${f.icon}`} style={{ fontSize: 24, color: "#00B37E" }} />
                </div>
                <h3 className="text-base font-bold mb-1.5" style={{ color: "#0F1728" }}>{f.title}</h3>
                <p className="text-sm" style={{ color: "#64748B", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Built different — comparison table */}
      <section className="px-6 lg:px-10 py-12 lg:py-20 section-container">
        <Reveal>
          <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00B37E" }}>Built different</div>
          <h2 className="text-3xl lg:text-4xl font-extrabold mb-10" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
            Built for the billing problem, not bolted onto it.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr>
                    <th className="text-left px-5 py-4" style={{ background: "#F8FAFC" }} />
                    <th className="text-left px-5 py-4 font-bold" style={{ color: "#94A3B8", background: "#F8FAFC" }}>
                      Build it yourself
                    </th>
                    <th className="text-left px-5 py-4" style={{ background: "#F8FAFC" }}>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold" style={{ color: "#0F1728", borderBottom: "2px solid #00B37E", paddingBottom: 2 }}>
                          Tori
                        </span>
                        <span
                          className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ background: "#E6F8F2", color: "#00B37E" }}
                        >
                          Recommended
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={row.feature} style={{ background: i % 2 === 1 ? "#F8FAFC" : "#fff" }}>
                      <td className="px-5 py-4 font-semibold align-top" style={{ color: "#64748B" }}>{row.feature}</td>
                      <td className="px-5 py-4 align-top" style={{ color: "#94A3B8" }}>
                        <span className="flex items-start gap-1.5">
                          {row.diy === "Not built" && <span style={{ color: "#DC2626" }}>✗</span>}
                          <span>{row.diy}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold align-top" style={{ color: "#0F1728" }}>
                        <span className="flex items-start gap-1.5">
                          <span style={{ color: "#00B37E" }}>✓</span>
                          <span>{row.tori}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </section>

      {/* The numbers */}
      <section className="px-6 lg:px-10 py-12 lg:py-20" style={{ background: "#0F1728" }}>
        <div className="section-container flex flex-wrap justify-center gap-10 lg:gap-16">
          {NUMBERS.map((n, i) => (
            <Reveal key={n.label} delay={i * 90} className="text-center">
              <i className={`ti ${n.icon} block mb-3`} style={{ fontSize: 28, color: "#00B37E" }} />
              <div className="text-[72px] leading-none font-black" style={{ color: "#00B37E", letterSpacing: "-0.02em" }}>
                <Counter to={n.to} />
              </div>
              <div className="text-sm mt-3 font-medium" style={{ color: "#9CA3AF" }}>{n.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Integration snippet */}
      <section className="px-6 lg:px-10 py-12 lg:py-20 section-container">
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
      <section className="mx-4 lg:mx-10 mb-8 rounded-2xl p-10 lg:p-14 text-center max-w-5xl xl:mx-auto" style={{ background: "#0F1728" }}>
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

      <StatusBar />

      <footer className="border-t" style={{ borderColor: "#E5E7EB" }}>
        <div className="section-container px-6 lg:px-10 py-10 grid grid-cols-2 lg:grid-cols-5 gap-8">
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
        <div className="border-t px-6 lg:px-10 py-5" style={{ borderColor: "#E5E7EB" }}>
          <div className="section-container flex flex-wrap gap-4 justify-between items-center">
            <span className="text-sm font-medium" style={{ color: "#9CA3AF" }}>2026 Tori · Built on Nomba</span>
            <div className="flex gap-5">
              <a href="https://github.com/chibuike-kt" className="text-sm font-semibold" style={{ color: "#6B7280" }}>GitHub</a>
              <a href="https://twitter.com/chibuike_kt" className="text-sm font-semibold" style={{ color: "#6B7280" }}>Twitter</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

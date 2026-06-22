"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  getMRR,
  getChurn,
  getDunningRecovery,
  getLedgerSummary,
  getSubscriptions,
  getCustomers,
  getPlans,
  getPortfolioHealth,
  api,
  type Customer,
  type Plan,
} from "@/lib/api";
import { StatusPill } from "@/components/status-pill";
import {
  formatKobo,
  formatKoboShort,
  formatDate,
  avatarFor,
} from "@/lib/utils";

function MetricCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  iconColor,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  accent?: boolean;
}) {
  return (
    <div
      className="bg-white border rounded-xl p-4"
      style={{ borderColor: "#EAECEF" }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold" style={{ color: "#8A94A6" }}>
          {label}
        </span>
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: iconBg, color: iconColor }}
        >
          <i className={`ti ${icon}`} style={{ fontSize: 15 }} />
        </span>
      </div>
      <div
        className="text-[23px] font-bold"
        style={{
          color: accent ? "#00B37E" : "#0F1728",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="text-[11px] mt-1 font-semibold"
          style={{ color: "#98A2B3" }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function OnboardingChecklist({
  plans,
  subs,
  hasWebhook,
  hasAPIKey,
}: {
  plans: Plan[];
  subs: unknown[];
  hasWebhook: boolean;
  hasAPIKey: boolean;
}) {
  const steps = [
    {
      label: "Create your first plan",
      done: plans.length > 0,
      href: "/dashboard/plans",
      desc: "Define what you charge and how often",
    },
    {
      label: "Subscribe your first customer",
      done: subs.length > 0,
      href: "/dashboard/subscriptions",
      desc: "Use the checkout form or the Platform API",
    },
    {
      label: "Add a webhook endpoint",
      done: hasWebhook,
      href: "/dashboard/webhooks",
      desc: "Get notified when billing events happen",
    },
    {
      label: "Create an API key",
      done: hasAPIKey,
      href: "/dashboard/api-keys",
      desc: "Authenticate your server-to-server calls",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return null;

  return (
    <div
      className="bg-white border rounded-xl mb-5"
      style={{ borderColor: "#EAECEF" }}
    >
      <div
        className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "#F0F2F4" }}
      >
        <div>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            Getting started
          </h2>
          <p
            className="text-xs font-medium mt-0.5"
            style={{ color: "#8A94A6" }}
          >
            {completed} of {steps.length} complete
          </p>
        </div>
        <div className="flex gap-1">
          {steps.map((s, i) => (
            <div
              key={i}
              className="w-8 h-1.5 rounded-full"
              style={{ background: s.done ? "#00B37E" : "#F1F3F5" }}
            />
          ))}
        </div>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        {steps.map((step, i) => (
          <Link
            key={i}
            href={step.href}
            className="flex items-start gap-3 p-3 rounded-lg border"
            style={{
              borderColor: step.done ? "#D1FAE5" : "#EAECEF",
              background: step.done ? "#F0FDF4" : "#FAFAFA",
            }}
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: step.done ? "#00B37E" : "#E5E7EB" }}
            >
              {step.done ? (
                <i
                  className="ti ti-check text-white"
                  style={{ fontSize: 11 }}
                />
              ) : (
                <span
                  className="text-[10px] font-bold"
                  style={{ color: "#9CA3AF" }}
                >
                  {i + 1}
                </span>
              )}
            </div>
            <div>
              <p
                className="text-xs font-bold"
                style={{ color: step.done ? "#166534" : "#0F1728" }}
              >
                {step.label}
              </p>
              <p
                className="text-[11px] font-medium mt-0.5"
                style={{ color: "#8A94A6" }}
              >
                {step.desc}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: mrrData } = useQuery({
    queryKey: ["mrr"],
    queryFn: () => getMRR(),
  });
  const { data: churnData } = useQuery({
    queryKey: ["churn"],
    queryFn: () => getChurn(),
  });
  const { data: recoveryData } = useQuery({
    queryKey: ["recovery"],
    queryFn: () => getDunningRecovery(),
  });
  const { data: summaryData } = useQuery({
    queryKey: ["ledger-summary"],
    queryFn: () => getLedgerSummary(),
  });
  const { data: subsData } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: getSubscriptions,
  });
  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });
  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
  });
  const { data: healthData } = useQuery({
    queryKey: ["portfolio-health"],
    queryFn: getPortfolioHealth,
  });
  const { data: webhooksData } = useQuery({
    queryKey: ["webhook-endpoints"],
    queryFn: () => api.get<{ data: unknown[] }>("/v1/webhooks/endpoints"),
  });
  const { data: apiKeyData } = useQuery({
    queryKey: ["api-key-hint"],
    queryFn: () => api.get<{ data: { hint: string } }>("/v1/api-keys"),
  });

  const mrr = mrrData?.data;
  const churn = churnData?.data;
  const recovery = recoveryData?.data;
  const summary = summaryData?.data;
  const subs = subsData?.data ?? [];
  const customers = customersData?.data ?? [];
  const plans = plansData?.data ?? [];
  const health = healthData?.data;
  const hasWebhook = (webhooksData?.data?.length ?? 0) > 0;
  const hasAPIKey = !!apiKeyData?.data?.hint;

  const custById = new Map<string, Customer>(customers.map((c) => [c.id, c]));
  const planById = new Map<string, Plan>(plans.map((p) => [p.id, p]));

  const activeCount = subs.filter((s) => s.status === "ACTIVE").length;
  const dunningSubs = subs.filter(
    (s) => s.status === "DUNNING" || s.status === "PAST_DUE",
  );
  const criticalSubs =
    health?.subscriptions.filter((s) => s.health.score < 30) ?? [];
  const atRiskSubs =
    health?.subscriptions.filter(
      (s) => s.churn.signal === "high" || s.churn.signal === "critical",
    ) ?? [];
  const needsAttention = [
    ...new Map(
      [
        ...criticalSubs,
        ...atRiskSubs,
        ...dunningSubs.map((s) => ({ ...s, id: s.id })),
      ].map((s) => [s.id, s]),
    ).values(),
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {needsAttention.length > 0 && (
        <div
          className="rounded-xl border px-4 py-3 mb-5 flex items-center gap-2.5"
          style={{ background: "#FDF0D5", borderColor: "#FDE68A" }}
        >
          <i
            className="ti ti-alert-triangle"
            style={{ fontSize: 16, color: "#8A5A00" }}
          />
          <span className="text-sm font-semibold" style={{ color: "#8A5A00" }}>
            {needsAttention.length} subscription
            {needsAttention.length > 1 ? "s" : ""} need your attention
          </span>
          <Link
            href="/dashboard/health"
            className="text-sm font-bold ml-auto"
            style={{ color: "#00B37E" }}
          >
            View billing health →
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1
            className="text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            Overview
          </h1>
          <p
            className="text-sm font-medium mt-0.5"
            style={{ color: "#8A94A6" }}
          >
            Your billing engine at a glance
          </p>
        </div>
        <Link
          href="/dashboard/subscriptions"
          className="flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-lg font-bold text-white"
          style={{ background: "#00B37E" }}
        >
          <i className="ti ti-plus" /> New subscription
        </Link>
      </div>

      <OnboardingChecklist
        plans={plans}
        subs={subs}
        hasWebhook={hasWebhook}
        hasAPIKey={hasAPIKey}
      />

      <div className="grid grid-cols-4 gap-3 mb-4">
        <MetricCard
          label="MRR"
          value={mrr ? formatKoboShort(mrr.mrr_kobo) : "..."}
          sub="monthly recurring revenue"
          icon="ti-trending-up"
          iconBg="#E3F7EF"
          iconColor="#00A36C"
          accent
        />
        <MetricCard
          label="Active subscriptions"
          value={String(activeCount)}
          sub={`${customers.length} total customers`}
          icon="ti-refresh"
          iconBg="#E8EFF9"
          iconColor="#2563A8"
        />
        <MetricCard
          label="Churn rate"
          value={churn ? `${churn.churn_rate_pct.toFixed(1)}%` : "..."}
          sub={`${churn?.cancelled_count ?? 0} cancelled`}
          icon="ti-user-minus"
          iconBg="#FDECEC"
          iconColor="#E24B4A"
        />
        <MetricCard
          label="Dunning recovered"
          value={recovery ? formatKoboShort(recovery.recovered_kobo) : "..."}
          sub="auto-recovered revenue"
          icon="ti-rotate-clockwise"
          iconBg="#FDF0D5"
          iconColor="#B8860B"
        />
      </div>

      <div
        className="grid gap-3 mb-4"
        style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
      >
        <div
          className="bg-white border rounded-xl"
          style={{ borderColor: "#EAECEF" }}
        >
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: "#F0F2F4" }}
          >
            <span className="text-sm font-bold" style={{ color: "#0F1728" }}>
              Revenue summary
            </span>
          </div>
          <div className="p-4 space-y-3">
            {[
              ["Gross revenue", summary?.total_charged, "#0F1728"],
              ["Refunds", summary?.total_refunded, "#E24B4A"],
              ["Net revenue", summary?.net_revenue, "#00B37E"],
            ].map(([label, val, color]) => (
              <div
                key={label as string}
                className="flex justify-between items-center py-2 border-b"
                style={{ borderColor: "#F4F6F8" }}
              >
                <span
                  className="text-xs font-semibold"
                  style={{ color: "#6B7280" }}
                >
                  {label}
                </span>
                <span
                  className="text-sm font-extrabold"
                  style={{ color: color as string }}
                >
                  {val !== undefined ? formatKobo(val as number) : "..."}
                </span>
              </div>
            ))}
            <div className="pt-1">
              <p
                className="text-xs font-semibold mb-0.5"
                style={{ color: "#8A94A6" }}
              >
                Ledger entries
              </p>
              <p
                className="text-2xl font-extrabold"
                style={{ color: "#0F1728" }}
              >
                {summary?.entry_count ?? 0}
              </p>
              <p
                className="text-[11px] font-medium"
                style={{ color: "#98A2B3" }}
              >
                immutable records
              </p>
            </div>
          </div>
        </div>

        <div
          className="bg-white border rounded-xl"
          style={{ borderColor: "#EAECEF" }}
        >
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: "#F0F2F4" }}
          >
            <span className="text-sm font-bold" style={{ color: "#0F1728" }}>
              Subscription states
            </span>
          </div>
          <div className="p-4 space-y-3">
            {[
              [
                "ACTIVE",
                subs.filter((s) => s.status === "ACTIVE").length,
                "#00A36C",
              ],
              [
                "TRIALING",
                subs.filter((s) => s.status === "TRIALING").length,
                "#4F46B5",
              ],
              [
                "DUNNING",
                subs.filter((s) => s.status === "DUNNING").length,
                "#B8860B",
              ],
              [
                "PAUSED",
                subs.filter((s) => s.status === "PAUSED").length,
                "#2563A8",
              ],
              [
                "CANCELLED",
                subs.filter((s) => s.status === "CANCELLED").length,
                "#98A2B3",
              ],
            ].map(([label, count, color]) => {
              const pct = subs.length ? (Number(count) / subs.length) * 100 : 0;
              return (
                <div key={label as string}>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span style={{ color: "#4B5563" }}>{label}</span>
                    <span style={{ color: "#0F1728" }}>{count}</span>
                  </div>
                  <div
                    className="h-1.5 rounded-full"
                    style={{ background: "#F1F3F5" }}
                  >
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${pct}%`, background: color as string }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="bg-white border rounded-xl"
          style={{ borderColor: "#EAECEF" }}
        >
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: "#F0F2F4" }}
          >
            <span className="text-sm font-bold" style={{ color: "#0F1728" }}>
              Billing health
            </span>
            <Link
              href="/dashboard/health"
              className="text-xs font-semibold"
              style={{ color: "#00B37E" }}
            >
              View all →
            </Link>
          </div>
          <div className="p-4">
            {health ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <svg viewBox="0 0 72 72" className="w-16 h-16 flex-shrink-0">
                    <circle
                      cx="36"
                      cy="36"
                      r="28"
                      fill="none"
                      stroke="#F1F3F5"
                      strokeWidth="6"
                    />
                    <circle
                      cx="36"
                      cy="36"
                      r="28"
                      fill="none"
                      stroke={
                        health.average_score >= 70
                          ? "#00B37E"
                          : health.average_score >= 50
                            ? "#D97706"
                            : "#DC2626"
                      }
                      strokeWidth="6"
                      strokeDasharray={`${(health.average_score / 100) * 2 * Math.PI * 28} ${2 * Math.PI * 28}`}
                      strokeLinecap="round"
                      transform="rotate(-90 36 36)"
                    />
                    <text
                      x="36"
                      y="36"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="14"
                      fontWeight="800"
                      fill={
                        health.average_score >= 70
                          ? "#00B37E"
                          : health.average_score >= 50
                            ? "#D97706"
                            : "#DC2626"
                      }
                    >
                      {health.average_score}
                    </text>
                  </svg>
                  <div>
                    <p
                      className="text-base font-extrabold"
                      style={{ color: "#0F1728" }}
                    >
                      {health.average_score >= 70
                        ? "Healthy"
                        : health.average_score >= 50
                          ? "Fair"
                          : "Needs attention"}
                    </p>
                    <p
                      className="text-xs font-medium"
                      style={{ color: "#8A94A6" }}
                    >
                      portfolio score
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Healthy", health.healthy_count, "#00B37E"],
                    ["At risk", health.at_risk_count, "#EA580C"],
                    ["Critical", health.critical_count, "#DC2626"],
                  ].map(([label, count, color]) => (
                    <div
                      key={label as string}
                      className="rounded-lg p-2 text-center"
                      style={{ background: "#F8F9FA" }}
                    >
                      <p
                        className="text-lg font-extrabold"
                        style={{ color: color as string }}
                      >
                        {count as number}
                      </p>
                      <p
                        className="text-[10px] font-semibold"
                        style={{ color: "#6B7280" }}
                      >
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div
                className="text-sm font-medium text-center py-6"
                style={{ color: "#8A94A6" }}
              >
                Loading...
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className="bg-white border rounded-xl"
        style={{ borderColor: "#EAECEF" }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "#F0F2F4" }}
        >
          <span className="text-sm font-bold" style={{ color: "#0F1728" }}>
            Recent subscriptions
          </span>
          <Link
            href="/dashboard/subscriptions"
            className="text-xs font-semibold"
            style={{ color: "#00B37E" }}
          >
            View all →
          </Link>
        </div>
        {subs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-refresh" style={{ fontSize: 22 }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No subscriptions yet
            </p>
            <p
              className="text-xs font-medium mt-1 mb-4"
              style={{ color: "#8A94A6" }}
            >
              Create a plan and subscribe your first customer.
            </p>
            <Link
              href="/dashboard/plans"
              className="inline-flex text-sm px-4 py-2 rounded-lg font-bold text-white"
              style={{ background: "#0F1728" }}
            >
              Create a plan
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: "#FAFBFC" }}>
                {["Customer", "Plan", "Amount", "Status", "Next billing"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-[11px] font-semibold"
                      style={{ color: "#98A2B3" }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {subs.slice(0, 8).map((sub) => {
                const cust = custById.get(sub.customer_id);
                const plan = planById.get(sub.plan_id);
                const av = avatarFor(cust?.email ?? sub.customer_id);
                return (
                  <tr key={sub.id} style={{ borderTop: "0.5px solid #F2F4F6" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[10px] font-bold"
                          style={{ background: av.bg, color: av.color }}
                        >
                          {av.initials}
                        </span>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: "#1F2733" }}
                        >
                          {cust?.email ?? "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-xs font-medium"
                      style={{ color: "#4B5563" }}
                    >
                      {plan?.name ?? "..."}
                    </td>
                    <td
                      className="px-4 py-3 text-xs font-bold"
                      style={{ color: "#0F1728" }}
                    >
                      {plan ? formatKobo(plan.amount) : "..."}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={sub.status} />
                    </td>
                    <td
                      className="px-4 py-3 text-xs font-medium"
                      style={{
                        color: sub.dunning_attempt > 0 ? "#B8860B" : "#4B5563",
                      }}
                    >
                      {sub.dunning_attempt > 0
                        ? `Retry · attempt ${sub.dunning_attempt}`
                        : formatDate(sub.current_period_end)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

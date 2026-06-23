"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getPortfolioHealth,
  getPlans,
  getCustomers,
  type Plan,
  type Customer,
} from "@/lib/api";
import { formatDate, avatarFor } from "@/lib/utils";

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="#F1F3F5"
        strokeWidth="6"
      />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text
        x="36"
        y="36"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="14"
        fontWeight="800"
        fill={color}
      >
        {score}
      </text>
    </svg>
  );
}

function HealthBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
      style={{ background: color + "20", color }}
    >
      {label.toUpperCase()}
    </span>
  );
}

function ChurnBadge({ signal }: { signal: string }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    none: { color: "#6B7280", bg: "#F1F3F5", label: "No risk" },
    low: { color: "#16A34A", bg: "#E3F7EF", label: "Low risk" },
    medium: { color: "#D97706", bg: "#FEF3C7", label: "Medium risk" },
    high: { color: "#EA580C", bg: "#FFF0E6", label: "High risk" },
    critical: { color: "#DC2626", bg: "#FDECEC", label: "Critical" },
  };
  const c = config[signal] ?? config.none;
  return (
    <span
      className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.color }}
    >
      {c.label.toUpperCase()}
    </span>
  );
}

export default function HealthPage() {
  const { data: healthData, isLoading } = useQuery({
    queryKey: ["portfolio-health"],
    queryFn: getPortfolioHealth,
    refetchInterval: 30000,
  });
  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
  });
  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });

  const portfolio = healthData?.data;
  const plans = plansData?.data ?? [];
  const customers = customersData?.data ?? [];

  const planById = new Map<string, Plan>(plans.map((p) => [p.id, p]));
  const custById = new Map<string, Customer>(customers.map((c) => [c.id, c]));

  const avgColor = !portfolio
    ? "#9CA3AF"
    : portfolio.average_score >= 70
      ? "#00B37E"
      : portfolio.average_score >= 50
        ? "#D97706"
        : "#DC2626";

  const churnRisk =
    portfolio?.subscriptions.filter(
      (s) => s.churn.signal === "high" || s.churn.signal === "critical",
    ) ?? [];
  const atRisk =
    portfolio?.subscriptions.filter(
      (s) => s.health.score < 70 && s.health.score >= 30,
    ) ?? [];
  const critical =
    portfolio?.subscriptions.filter((s) => s.health.score < 30) ?? [];
  const needsAttention = [
    ...new Map(
      [...critical, ...atRisk, ...churnRisk].map((s) => [s.id, s]),
    ).values(),
  ];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1
          className="text-xl lg:text-2xl font-extrabold"
          style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
        >
          Billing health
        </h1>
        <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
          Real-time health scores and churn prediction across your subscriber
          base
        </p>
      </div>

      {isLoading ? (
        <div
          className="text-sm font-medium p-12 text-center"
          style={{ color: "#8A94A6" }}
        >
          Computing health scores...
        </div>
      ) : !portfolio ? null : (
        <>
          {/* Portfolio summary */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            <div
              className="col-span-2 lg:col-span-2 bg-white border rounded-xl p-5 flex items-center gap-4"
              style={{ borderColor: "#EAECEF" }}
            >
              <ScoreRing score={portfolio.average_score} color={avgColor} />
              <div>
                <p
                  className="text-xs font-semibold mb-0.5"
                  style={{ color: "#8A94A6" }}
                >
                  Portfolio health
                </p>
                <p
                  className="text-lg font-extrabold"
                  style={{ color: "#0F1728" }}
                >
                  {portfolio.average_score >= 70
                    ? "Healthy"
                    : portfolio.average_score >= 50
                      ? "Fair"
                      : "Needs attention"}
                </p>
                <p className="text-xs font-medium" style={{ color: "#9CA3AF" }}>
                  avg score across {portfolio.subscriptions.length} active
                  subscriptions
                </p>
              </div>
            </div>

            {[
              [
                "Healthy",
                portfolio.healthy_count,
                "#00B37E",
                "ti-circle-check",
              ],
              [
                "At risk",
                portfolio.at_risk_count,
                "#EA580C",
                "ti-alert-triangle",
              ],
              ["Critical", portfolio.critical_count, "#DC2626", "ti-circle-x"],
              [
                "Churn risk",
                portfolio.churn_risk_count,
                "#7C3AED",
                "ti-user-minus",
              ],
            ].map(([label, count, color, icon]) => (
              <div
                key={label as string}
                className="bg-white border rounded-xl p-4 lg:p-5"
                style={{ borderColor: "#EAECEF" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <i
                    className={`ti ${icon}`}
                    style={{ fontSize: 16, color: color as string }}
                  />
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "#8A94A6" }}
                  >
                    {label}
                  </span>
                </div>
                <p
                  className="text-2xl lg:text-3xl font-extrabold"
                  style={{ color: color as string, letterSpacing: "-0.02em" }}
                >
                  {count as number}
                </p>
                <p
                  className="text-xs font-medium mt-0.5"
                  style={{ color: "#9CA3AF" }}
                >
                  subscriptions
                </p>
              </div>
            ))}
          </div>

          {/* Attention banner */}
          {needsAttention.length > 0 && (
            <div
              className="rounded-xl border p-4 mb-5"
              style={{ borderColor: "#FDE68A", background: "#FFFBEB" }}
            >
              <div className="flex items-start gap-3">
                <i
                  className="ti ti-alert-triangle flex-shrink-0 mt-0.5"
                  style={{ fontSize: 18, color: "#D97706" }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-extrabold mb-2"
                    style={{ color: "#0F1728" }}
                  >
                    {needsAttention.length} subscription
                    {needsAttention.length > 1 ? "s" : ""} need
                    {needsAttention.length === 1 ? "s" : ""} your attention
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {needsAttention.slice(0, 5).map((s) => {
                      const cust = custById.get(s.customer_id);
                      const av = avatarFor(cust?.email ?? s.customer_id);
                      return (
                        <div
                          key={s.id}
                          className="flex items-center gap-1.5 bg-white rounded-lg px-3 py-1.5 border"
                          style={{ borderColor: "#E5E7EB" }}
                        >
                          <span
                            className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                            style={{ background: av.bg, color: av.color }}
                          >
                            {av.initials}
                          </span>
                          <span
                            className="text-xs font-semibold truncate max-w-[120px]"
                            style={{ color: "#0F1728" }}
                          >
                            {cust?.email ?? "Unknown"}
                          </span>
                          <ChurnBadge signal={s.churn.signal} />
                        </div>
                      );
                    })}
                    {needsAttention.length > 5 && (
                      <span
                        className="text-xs font-medium px-3 py-1.5"
                        style={{ color: "#6B7280" }}
                      >
                        +{needsAttention.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Churn risk detail */}
          {churnRisk.length > 0 && (
            <div
              className="bg-white border rounded-xl mb-4"
              style={{ borderColor: "#EAECEF" }}
            >
              <div
                className="px-5 py-4 border-b flex items-center gap-2"
                style={{ borderColor: "#F0F2F4" }}
              >
                <i
                  className="ti ti-user-minus"
                  style={{ fontSize: 16, color: "#7C3AED" }}
                />
                <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
                  Churn prediction: {churnRisk.length} high-risk subscription
                  {churnRisk.length > 1 ? "s" : ""}
                </h2>
              </div>
              <div className="divide-y" style={{ borderColor: "#F0F2F4" }}>
                {churnRisk.map((sub) => {
                  const cust = custById.get(sub.customer_id);
                  const plan = planById.get(sub.plan_id);
                  const av = avatarFor(cust?.email ?? sub.customer_id);
                  return (
                    <div key={sub.id} className="px-4 lg:px-5 py-4">
                      <div className="flex items-start gap-3">
                        <span
                          className="w-8 h-8 rounded-full inline-flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: av.bg, color: av.color }}
                        >
                          {av.initials}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span
                              className="text-sm font-bold"
                              style={{ color: "#0F1728" }}
                            >
                              {cust?.email ?? "Unknown"}
                            </span>
                            <ChurnBadge signal={sub.churn.signal} />
                            <span
                              className="text-xs font-medium"
                              style={{ color: "#8A94A6" }}
                            >
                              {plan?.name ?? "Unknown plan"}
                            </span>
                          </div>
                          <ul className="space-y-0.5 mb-2">
                            {sub.churn.reasons.map((reason, i) => (
                              <li
                                key={i}
                                className="flex items-center gap-1.5 text-xs font-medium"
                                style={{ color: "#6B7280" }}
                              >
                                <i
                                  className="ti ti-point-filled"
                                  style={{ fontSize: 8, color: "#D97706" }}
                                />
                                {reason}
                              </li>
                            ))}
                          </ul>
                          <div
                            className="rounded-lg px-3 py-2 text-xs font-semibold"
                            style={{ background: "#F8F9FA", color: "#4B5563" }}
                          >
                            <i
                              className="ti ti-bulb mr-1.5"
                              style={{ color: "#00B37E" }}
                            />
                            {sub.churn.recommended_action}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right ml-2">
                          <div
                            className="text-xs font-semibold mb-0.5"
                            style={{ color: "#8A94A6" }}
                          >
                            Churn score
                          </div>
                          <div
                            className="text-2xl font-extrabold"
                            style={{
                              color: "#DC2626",
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {sub.churn.score}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full table */}
          <div
            className="bg-white border rounded-xl"
            style={{ borderColor: "#EAECEF" }}
          >
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{ borderColor: "#F0F2F4" }}
            >
              <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
                All subscriptions
              </h2>
              <span
                className="text-xs font-medium"
                style={{ color: "#8A94A6" }}
              >
                Sorted by health score, lowest first
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr
                    style={{
                      background: "#FAFBFC",
                      borderBottom: "0.5px solid #EAECEF",
                    }}
                  >
                    {[
                      "Score",
                      "Customer",
                      "Plan",
                      "Status",
                      "Churn risk",
                      "Reason",
                      "Period end",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-[11px] font-semibold"
                        style={{ color: "#98A2B3" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...portfolio.subscriptions]
                    .sort((a, b) => a.health.score - b.health.score)
                    .map((sub) => {
                      const cust = custById.get(sub.customer_id);
                      const plan = planById.get(sub.plan_id);
                      const av = avatarFor(cust?.email ?? sub.customer_id);
                      return (
                        <tr
                          key={sub.id}
                          style={{ borderTop: "0.5px solid #F2F4F6" }}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <ScoreRing
                                score={sub.health.score}
                                color={sub.health.color}
                              />
                              <HealthBadge
                                label={sub.health.label}
                                color={sub.health.color}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                style={{ background: av.bg, color: av.color }}
                              >
                                {av.initials}
                              </span>
                              <span
                                className="text-xs font-semibold truncate max-w-[120px]"
                                style={{ color: "#1F2733" }}
                              >
                                {cust?.email ?? "Unknown"}
                              </span>
                            </div>
                          </td>
                          <td
                            className="px-4 py-3 text-xs font-semibold"
                            style={{ color: "#4B5563" }}
                          >
                            {plan?.name ?? "Unknown"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: "#F1F3F5",
                                color: "#6B7280",
                              }}
                            >
                              {sub.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <ChurnBadge signal={sub.churn.signal} />
                          </td>
                          <td
                            className="px-4 py-3 text-xs font-medium max-w-[180px]"
                            style={{ color: "#6B7280" }}
                          >
                            {sub.health.reason}
                          </td>
                          <td
                            className="px-4 py-3 text-xs font-medium"
                            style={{ color: "#98A2B3" }}
                          >
                            {formatDate(sub.current_period_end)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

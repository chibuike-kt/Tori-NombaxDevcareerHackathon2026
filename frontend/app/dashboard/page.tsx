"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getMRR,
  getChurn,
  getDunningRecovery,
  getLedgerSummary,
  getSubscriptions,
} from "@/lib/api";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { formatKobo, formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const { data: mrrData } = useQuery({ queryKey: ["mrr"], queryFn: getMRR });
  const { data: churnData } = useQuery({
    queryKey: ["churn"],
    queryFn: getChurn,
  });
  const { data: recoveryData } = useQuery({
    queryKey: ["recovery"],
    queryFn: getDunningRecovery,
  });
  const { data: summaryData } = useQuery({
    queryKey: ["ledger-summary"],
    queryFn: getLedgerSummary,
  });
  const { data: subsData } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: getSubscriptions,
  });

  const mrr = mrrData?.data;
  const churn = churnData?.data;
  const recovery = recoveryData?.data;
  const summary = summaryData?.data;
  const subs = subsData?.data ?? [];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--heading)" }}
        >
          Overview
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          Your billing engine at a glance
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
        <StatCard
          label="MRR"
          value={mrr ? formatKobo(mrr.mrr_kobo) : "—"}
          sub={mrr?.period}
          accent
        />
        <StatCard
          label="Net Revenue"
          value={summary ? formatKobo(summary.net_revenue) : "—"}
          sub="all time"
        />
        <StatCard
          label="Churn Rate"
          value={churn ? `${churn.churn_rate_pct.toFixed(1)}%` : "—"}
          sub={`${churn?.cancelled_count ?? 0} cancelled`}
        />
        <StatCard
          label="Dunning Recovered"
          value={recovery ? formatKobo(recovery.recovered_kobo) : "—"}
          sub="recovered revenue"
          accent
        />
      </div>

      <div
        className="rounded-lg border"
        style={{
          borderColor: "var(--border)",
          background: "var(--background)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between"
          style={{ borderColor: "var(--border)" }}
        >
          <h2
            className="text-sm font-medium"
            style={{ color: "var(--heading)" }}
          >
            Recent Subscriptions
          </h2>
          <a
            href="/dashboard/subscriptions"
            className="text-sm"
            style={{ color: "var(--primary)" }}
          >
            View all
          </a>
        </div>
        {subs.length === 0 ? (
          <div
            className="px-5 py-10 text-center text-sm"
            style={{ color: "var(--muted)" }}
          >
            No subscriptions yet. Create a plan and subscribe your first
            customer.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid var(--border)` }}>
                <th
                  className="px-5 py-2.5 text-left text-sm font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  ID
                </th>
                <th
                  className="px-5 py-2.5 text-left text-sm font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  Status
                </th>
                <th
                  className="px-5 py-2.5 text-left text-sm font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  Period End
                </th>
                <th
                  className="px-5 py-2.5 text-left text-sm font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  Dunning
                </th>
              </tr>
            </thead>
            <tbody>
              {subs.slice(0, 10).map((sub) => (
                <tr
                  key={sub.id}
                  style={{ borderBottom: `1px solid var(--border)` }}
                >
                  <td
                    className="px-5 py-3 font-mono text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    {sub.id.slice(0, 8)}…
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill status={sub.status} />
                  </td>
                  <td
                    className="px-5 py-3 text-sm"
                    style={{ color: "var(--body)" }}
                  >
                    {formatDate(sub.current_period_end)}
                  </td>
                  <td
                    className="px-5 py-3 text-sm"
                    style={{
                      color:
                        sub.dunning_attempt > 0
                          ? "var(--warning)"
                          : "var(--muted)",
                    }}
                  >
                    {sub.dunning_attempt > 0
                      ? `Attempt ${sub.dunning_attempt}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

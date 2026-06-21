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
  delta,
  deltaUp,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaUp?: boolean;
  icon: string;
  iconBg: string;
  iconColor: string;
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
        style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
      {delta && (
        <div
          className="text-[11px] mt-1 flex items-center gap-1 font-semibold"
          style={{ color: deltaUp ? "#00A36C" : "#E24B4A" }}
        >
          <i
            className={`ti ${deltaUp ? "ti-arrow-up-right" : "ti-arrow-down-right"}`}
          />
          {delta}
        </div>
      )}
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

  const mrr = mrrData?.data;
  const churn = churnData?.data;
  const recovery = recoveryData?.data;
  const summary = summaryData?.data;
  const subs = subsData?.data ?? [];
  const customers = customersData?.data ?? [];
  const plans = plansData?.data ?? [];

  const custById = new Map<string, Customer>(customers.map((c) => [c.id, c]));
  const planById = new Map<string, Plan>(plans.map((p) => [p.id, p]));

  const activeCount = subs.filter((s) => s.status === "ACTIVE").length;
  const dunningSubs = subs.filter(
    (s) => s.status === "DUNNING" || s.status === "PAST_DUE",
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {dunningSubs.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 mb-5 flex items-center gap-2.5"
          style={{ background: "#FDF0D5" }}
        >
          <i
            className="ti ti-alert-circle"
            style={{ fontSize: 16, color: "#8A5A00" }}
          />
          <span className="text-sm font-semibold" style={{ color: "#8A5A00" }}>
            {dunningSubs.length} subscription{dunningSubs.length > 1 ? "s" : ""}{" "}
            need attention.
          </span>
          <Link
            href="/dashboard/subscriptions"
            className="text-sm font-bold ml-auto"
            style={{ color: "#00B37E" }}
          >
            Review →
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

      <div className="grid grid-cols-4 gap-3 mb-4">
        <MetricCard
          label="MRR"
          value={mrr ? formatKoboShort(mrr.mrr_kobo) : "—"}
          delta="18.2% vs last month"
          deltaUp
          icon="ti-trending-up"
          iconBg="#E3F7EF"
          iconColor="#00A36C"
        />
        <MetricCard
          label="Active subscriptions"
          value={String(activeCount)}
          delta={`${subs.length} total`}
          deltaUp
          icon="ti-refresh"
          iconBg="#E8EFF9"
          iconColor="#2563A8"
        />
        <MetricCard
          label="Churn rate"
          value={churn ? `${churn.churn_rate_pct.toFixed(1)}%` : "—"}
          delta={`${churn?.cancelled_count ?? 0} cancelled`}
          deltaUp
          icon="ti-user-minus"
          iconBg="#FDECEC"
          iconColor="#E24B4A"
        />
        <MetricCard
          label="Dunning recovered"
          value={recovery ? formatKoboShort(recovery.recovered_kobo) : "—"}
          delta="68% recovery rate"
          deltaUp
          icon="ti-rotate-clockwise"
          iconBg="#FDF0D5"
          iconColor="#B8860B"
        />
      </div>

      <div
        className="grid gap-3 mb-3"
        style={{ gridTemplateColumns: "1.6fr 1fr" }}
      >
        <div
          className="bg-white border rounded-xl"
          style={{ borderColor: "#EAECEF" }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "#F0F2F4" }}
          >
            <span className="text-sm font-bold" style={{ color: "#0F1728" }}>
              Revenue summary
            </span>
            <span
              className="text-xs font-semibold"
              style={{ color: "#00B37E" }}
            >
              All time
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 p-5">
            <div>
              <p
                className="text-xs font-semibold mb-1"
                style={{ color: "#8A94A6" }}
              >
                Gross revenue
              </p>
              <p className="text-xl font-bold" style={{ color: "#0F1728" }}>
                {summary ? formatKobo(summary.total_charged) : "—"}
              </p>
            </div>
            <div>
              <p
                className="text-xs font-semibold mb-1"
                style={{ color: "#8A94A6" }}
              >
                Refunds
              </p>
              <p className="text-xl font-bold" style={{ color: "#E24B4A" }}>
                {summary ? formatKobo(summary.total_refunded) : "—"}
              </p>
            </div>
            <div>
              <p
                className="text-xs font-semibold mb-1"
                style={{ color: "#8A94A6" }}
              >
                Net revenue
              </p>
              <p className="text-xl font-bold" style={{ color: "#00B37E" }}>
                {summary ? formatKobo(summary.net_revenue) : "—"}
              </p>
            </div>
          </div>
          <div className="px-5 pb-5">
            <div className="rounded-lg p-4" style={{ background: "#F7F8FA" }}>
              <p
                className="text-xs font-semibold mb-3"
                style={{ color: "#8A94A6" }}
              >
                Entries recorded
              </p>
              <p
                className="text-3xl font-extrabold"
                style={{ color: "#0F1728" }}
              >
                {summary?.entry_count ?? 0}
              </p>
              <p
                className="text-xs font-medium mt-1"
                style={{ color: "#98A2B3" }}
              >
                immutable ledger entries
              </p>
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
              Subscription health
            </span>
          </div>
          <div className="p-4 space-y-3">
            {[
              [
                "Active",
                subs.filter((s) => s.status === "ACTIVE").length,
                "#00A36C",
              ],
              [
                "Trialing",
                subs.filter((s) => s.status === "TRIALING").length,
                "#4F46B5",
              ],
              [
                "Dunning",
                subs.filter((s) => s.status === "DUNNING").length,
                "#B8860B",
              ],
              [
                "Paused",
                subs.filter((s) => s.status === "PAUSED").length,
                "#2563A8",
              ],
              [
                "Cancelled",
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
                      {plan?.name ?? "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-xs font-bold"
                      style={{ color: "#0F1728" }}
                    >
                      {plan ? formatKobo(plan.amount) : "—"}
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

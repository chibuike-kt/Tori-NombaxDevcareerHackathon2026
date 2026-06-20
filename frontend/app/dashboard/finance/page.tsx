"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getMRR,
  getChurn,
  getDunningRecovery,
  getLedgerSummary,
} from "@/lib/api";
import { formatKobo, formatKoboShort } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="bg-white border rounded-xl p-5"
      style={{ borderColor: "#EAECEF" }}
    >
      <p className="text-xs font-semibold mb-2" style={{ color: "#8A94A6" }}>
        {label}
      </p>
      <p
        className="text-2xl font-extrabold"
        style={{
          color: accent ? "#00B37E" : "#0F1728",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs font-medium mt-1" style={{ color: "#98A2B3" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

const mockTrend = [
  { month: "Jan", revenue: 0 },
  { month: "Feb", revenue: 0 },
  { month: "Mar", revenue: 12500000 },
  { month: "Apr", revenue: 28000000 },
  { month: "May", revenue: 45000000 },
  { month: "Jun", revenue: 91500000 },
];

const mockDunning = [
  { label: "Attempt 1", recovered: 3 },
  { label: "Attempt 2", recovered: 2 },
  { label: "Attempt 3", recovered: 1 },
  { label: "Attempt 4", recovered: 0 },
];

export default function FinancePage() {
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

  const mrr = mrrData?.data;
  const churn = churnData?.data;
  const recovery = recoveryData?.data;
  const summary = summaryData?.data;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1
          className="text-2xl font-extrabold"
          style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
        >
          Finance
        </h1>
        <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
          Revenue, churn, and dunning recovery metrics
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard
          label="MRR"
          value={mrr ? formatKoboShort(mrr.mrr_kobo) : "—"}
          sub={mrr?.period}
          accent
        />
        <StatCard
          label="ARR (est.)"
          value={mrr ? formatKoboShort(mrr.mrr_kobo * 12) : "—"}
          sub="annualised"
        />
        <StatCard
          label="Churn rate"
          value={churn ? `${churn.churn_rate_pct.toFixed(1)}%` : "—"}
          sub={`${churn?.cancelled_count ?? 0} cancelled`}
        />
        <StatCard
          label="Dunning recovered"
          value={recovery ? formatKoboShort(recovery.recovered_kobo) : "—"}
          sub="this period"
          accent
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div
          className="bg-white border rounded-xl p-5"
          style={{ borderColor: "#EAECEF" }}
        >
          <p
            className="text-xs font-semibold mb-1"
            style={{ color: "#8A94A6" }}
          >
            Gross revenue
          </p>
          <p
            className="text-2xl font-extrabold mb-4"
            style={{ color: "#0F1728" }}
          >
            {summary ? formatKobo(summary.total_charged) : "—"}
          </p>
          <div
            className="flex justify-between text-xs font-medium"
            style={{ color: "#8A94A6" }}
          >
            <span>Refunds</span>
            <span style={{ color: "#E24B4A" }}>
              {summary ? formatKobo(summary.total_refunded) : "—"}
            </span>
          </div>
          <div
            className="flex justify-between text-xs font-semibold mt-1.5 pt-1.5 border-t"
            style={{ borderColor: "#F0F2F4" }}
          >
            <span style={{ color: "#0F1728" }}>Net revenue</span>
            <span style={{ color: "#00B37E" }}>
              {summary ? formatKobo(summary.net_revenue) : "—"}
            </span>
          </div>
        </div>

        <div
          className="col-span-2 bg-white border rounded-xl p-5"
          style={{ borderColor: "#EAECEF" }}
        >
          <p className="text-sm font-bold mb-4" style={{ color: "#0F1728" }}>
            Revenue trend
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={mockTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F4" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#98A2B3" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "#98A2B3" }}
                tickFormatter={(v) => `₦${(v / 1000000).toFixed(1)}M`}
              />
              <Tooltip formatter={(v) => [formatKobo(Number(v)), "Revenue"]} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#00B37E"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div
          className="bg-white border rounded-xl p-5"
          style={{ borderColor: "#EAECEF" }}
        >
          <p className="text-sm font-bold mb-4" style={{ color: "#0F1728" }}>
            Dunning recovery by attempt
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={mockDunning}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F4" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#98A2B3" }} />
              <YAxis tick={{ fontSize: 11, fill: "#98A2B3" }} />
              <Tooltip />
              <Bar dataKey="recovered" fill="#00B37E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          className="bg-white border rounded-xl p-5"
          style={{ borderColor: "#EAECEF" }}
        >
          <p className="text-sm font-bold mb-4" style={{ color: "#0F1728" }}>
            Ledger breakdown
          </p>
          <div className="space-y-3">
            {[
              ["Total charges", summary?.total_charged, "#0F1728"],
              ["Total refunds", summary?.total_refunded, "#E24B4A"],
              ["Credits applied", summary?.total_credits_applied, "#2563A8"],
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
                  {val !== undefined ? formatKobo(val as number) : "—"}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-1">
              <span
                className="text-xs font-semibold"
                style={{ color: "#6B7280" }}
              >
                Total entries
              </span>
              <span
                className="text-sm font-extrabold"
                style={{ color: "#0F1728" }}
              >
                {summary?.entry_count ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

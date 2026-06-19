"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getMRR,
  getChurn,
  getDunningRecovery,
  getLedgerSummary,
} from "@/lib/api";
import { StatCard } from "@/components/stat-card";
import { formatKobo } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const mockMRRTrend = [
  { month: "Jan", mrr: 0 },
  { month: "Feb", mrr: 0 },
  { month: "Mar", mrr: 0 },
  { month: "Apr", mrr: 0 },
  { month: "May", mrr: 0 },
  { month: "Jun", mrr: 0 },
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

  const trendData = mockMRRTrend.map((d, i) => ({
    ...d,
    mrr: i === mockMRRTrend.length - 1 ? (mrr?.mrr_kobo ?? 0) / 100 : d.mrr,
  }));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--heading)" }}>
          Finance
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          Revenue, churn, and dunning recovery metrics
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
          label="ARR (est.)"
          value={mrr ? formatKobo(mrr.mrr_kobo * 12) : "—"}
          sub="annualised"
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
      </div>

      <div className="grid grid-cols-1 gap-4 mb-4 lg:grid-cols-2">
        <div
          className="rounded-lg border p-5"
          style={{
            borderColor: "var(--border)",
            background: "var(--background)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <h2
            className="text-sm font-semibold mb-4"
            style={{ color: "var(--heading)" }}
          >
            MRR trend
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "var(--muted)" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--muted)" }}
                tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v) => [`₦${Number(v).toLocaleString()}`, "MRR"]}
              />
              <Line
                type="monotone"
                dataKey="mrr"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div
          className="rounded-lg border p-5"
          style={{
            borderColor: "var(--border)",
            background: "var(--background)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <h2
            className="text-sm font-semibold mb-4"
            style={{ color: "var(--heading)" }}
          >
            Dunning recovery
          </h2>
          <div className="flex items-center gap-6 mb-4">
            <div>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Recovered
              </p>
              <p
                className="text-xl font-semibold"
                style={{ color: "var(--primary)" }}
              >
                {recovery ? formatKobo(recovery.recovered_kobo) : "—"}
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart
              data={[
                {
                  name: "At risk",
                  value: (recovery?.recovered_kobo ?? 0) / 100,
                },
                {
                  name: "Recovered",
                  value: (recovery?.recovered_kobo ?? 0) / 100,
                },
                { name: "Lost", value: 0 },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "var(--muted)" }}
              />
              <YAxis tick={{ fontSize: 12, fill: "var(--muted)" }} />
              <Tooltip />
              <Bar
                dataKey="value"
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div
        className="rounded-lg border p-5"
        style={{
          borderColor: "var(--border)",
          background: "var(--background)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <h2
          className="text-sm font-semibold mb-4"
          style={{ color: "var(--heading)" }}
        >
          Revenue summary
        </h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Gross revenue
            </p>
            <p
              className="text-xl font-semibold mt-1"
              style={{ color: "var(--heading)" }}
            >
              {summary ? formatKobo(summary.total_charged) : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Refunds
            </p>
            <p
              className="text-xl font-semibold mt-1"
              style={{ color: "var(--danger)" }}
            >
              {summary ? formatKobo(summary.total_refunded) : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Net revenue
            </p>
            <p
              className="text-xl font-semibold mt-1"
              style={{ color: "var(--primary)" }}
            >
              {summary ? formatKobo(summary.net_revenue) : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

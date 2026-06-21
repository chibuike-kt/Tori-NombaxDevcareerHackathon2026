"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMRR,
  getChurn,
  getDunningRecovery,
  getLedgerSummary,
  getRevenueForecast,
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

type Range = "7D" | "30D" | "90D" | "1Y";

function rangeParams(range: Range): {
  from: string;
  to: string;
  period: string;
} {
  const to = new Date();
  const from = new Date();
  if (range === "7D") from.setDate(to.getDate() - 7);
  else if (range === "30D") from.setDate(to.getDate() - 30);
  else if (range === "90D") from.setDate(to.getDate() - 90);
  else from.setFullYear(to.getFullYear() - 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const period = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}`;
  return { from: fmt(from), to: fmt(to), period };
}

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
  const [range, setRange] = useState<Range>("30D");
  const { from, to, period } = rangeParams(range);

  const { data: mrrData } = useQuery({
    queryKey: ["mrr", period],
    queryFn: () => getMRR(period),
  });
  const { data: churnData } = useQuery({
    queryKey: ["churn", from, to],
    queryFn: () => getChurn(from, to),
  });
  const { data: recoveryData } = useQuery({
    queryKey: ["recovery", from, to],
    queryFn: () => getDunningRecovery(from, to),
  });
  const { data: summaryData } = useQuery({
    queryKey: ["ledger-summary", from, to],
    queryFn: () => getLedgerSummary(from, to),
  });
  const { data: forecastData } = useQuery({
    queryKey: ["forecast"],
    queryFn: getRevenueForecast,
  });

  const mrr = mrrData?.data;
  const churn = churnData?.data;
  const recovery = recoveryData?.data;
  const summary = summaryData?.data;
  const forecast = forecastData?.data;

  const ranges: Range[] = ["7D", "30D", "90D", "1Y"];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            Finance
          </h1>
          <p
            className="text-sm font-medium mt-0.5"
            style={{ color: "#8A94A6" }}
          >
            Revenue, churn, and dunning recovery metrics
          </p>
        </div>
        <div
          className="flex gap-1.5 p-1 rounded-lg"
          style={{ background: "#F1F3F5" }}
        >
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="text-xs font-bold px-3 py-1.5 rounded-md"
              style={{
                background: range === r ? "#fff" : "transparent",
                color: range === r ? "#0F1728" : "#6B7280",
                boxShadow: range === r ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard
          label="MRR"
          value={mrr ? formatKoboShort(mrr.mrr_kobo) : "..."}
          sub={mrr?.period}
          accent
        />
        <StatCard
          label="ARR (est.)"
          value={mrr ? formatKoboShort(mrr.mrr_kobo * 12) : "..."}
          sub="annualised"
        />
        <StatCard
          label="Churn rate"
          value={churn ? `${churn.churn_rate_pct.toFixed(1)}%` : "..."}
          sub={`${churn?.cancelled_count ?? 0} cancelled`}
        />
        <StatCard
          label="Dunning recovered"
          value={recovery ? formatKoboShort(recovery.recovered_kobo) : "..."}
          sub="this period"
          accent
        />
      </div>

      {/* Revenue forecast */}
      {forecast && (
        <div
          className="bg-white border rounded-xl p-5 mb-4"
          style={{ borderColor: "#EAECEF" }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <i
                  className="ti ti-chart-arrows-vertical"
                  style={{ fontSize: 16, color: "#00B37E" }}
                />
                <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
                  Revenue forecast for {forecast.period_label}
                </p>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background:
                      forecast.confidence === "high"
                        ? "#E3F7EF"
                        : forecast.confidence === "medium"
                          ? "#FEF3C7"
                          : "#F1F3F5",
                    color:
                      forecast.confidence === "high"
                        ? "#0A7A56"
                        : forecast.confidence === "medium"
                          ? "#92400E"
                          : "#6B7280",
                  }}
                >
                  {forecast.confidence.toUpperCase()} CONFIDENCE
                </span>
              </div>
              <p
                className="text-xs font-medium mb-4"
                style={{ color: "#8A94A6" }}
              >
                {forecast.note}
              </p>
              <div className="flex items-end gap-3">
                <div>
                  <p
                    className="text-xs font-semibold mb-0.5"
                    style={{ color: "#8A94A6" }}
                  >
                    Low estimate
                  </p>
                  <p
                    className="text-xl font-extrabold"
                    style={{ color: "#6B7280", letterSpacing: "-0.02em" }}
                  >
                    {formatKoboShort(forecast.expected_low)}
                  </p>
                </div>
                <div className="pb-1 px-2" style={{ color: "#D1D5DB" }}>
                  <i
                    className="ti ti-arrows-horizontal"
                    style={{ fontSize: 16 }}
                  />
                </div>
                <div>
                  <p
                    className="text-xs font-semibold mb-0.5"
                    style={{ color: "#8A94A6" }}
                  >
                    Mid estimate
                  </p>
                  <p
                    className="text-3xl font-extrabold"
                    style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
                  >
                    {formatKoboShort(forecast.expected_mid)}
                  </p>
                </div>
                <div className="pb-1 px-2" style={{ color: "#D1D5DB" }}>
                  <i
                    className="ti ti-arrows-horizontal"
                    style={{ fontSize: 16 }}
                  />
                </div>
                <div>
                  <p
                    className="text-xs font-semibold mb-0.5"
                    style={{ color: "#8A94A6" }}
                  >
                    High estimate
                  </p>
                  <p
                    className="text-xl font-extrabold"
                    style={{ color: "#00B37E", letterSpacing: "-0.02em" }}
                  >
                    {formatKoboShort(forecast.expected_high)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 ml-8">
              <div className="grid grid-cols-3 gap-4 text-right">
                <div>
                  <p
                    className="text-xs font-semibold mb-0.5"
                    style={{ color: "#8A94A6" }}
                  >
                    Active subs
                  </p>
                  <p
                    className="text-2xl font-extrabold"
                    style={{ color: "#0F1728" }}
                  >
                    {forecast.active_subscriptions}
                  </p>
                </div>
                <div>
                  <p
                    className="text-xs font-semibold mb-0.5"
                    style={{ color: "#8A94A6" }}
                  >
                    At risk
                  </p>
                  <p
                    className="text-2xl font-extrabold"
                    style={{ color: "#EA580C" }}
                  >
                    {formatKoboShort(forecast.at_risk_revenue)}
                  </p>
                </div>
                <div>
                  <p
                    className="text-xs font-semibold mb-0.5"
                    style={{ color: "#8A94A6" }}
                  >
                    Recovery rate
                  </p>
                  <p
                    className="text-2xl font-extrabold"
                    style={{ color: "#0F1728" }}
                  >
                    {forecast.recovery_rate_pct}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
            {summary ? formatKobo(summary.total_charged) : "..."}
          </p>
          <div
            className="flex justify-between text-xs font-medium"
            style={{ color: "#8A94A6" }}
          >
            <span>Refunds</span>
            <span style={{ color: "#E24B4A" }}>
              {summary ? formatKobo(summary.total_refunded) : "..."}
            </span>
          </div>
          <div
            className="flex justify-between text-xs font-semibold mt-1.5 pt-1.5 border-t"
            style={{ borderColor: "#F0F2F4" }}
          >
            <span style={{ color: "#0F1728" }}>Net revenue</span>
            <span style={{ color: "#00B37E" }}>
              {summary ? formatKobo(summary.net_revenue) : "..."}
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
                  {val !== undefined ? formatKobo(val as number) : "..."}
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

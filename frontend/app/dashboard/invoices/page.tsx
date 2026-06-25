"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  getInvoices,
  getCustomers,
  getSubscriptions,
  type Invoice,
} from "@/lib/api";
import { formatKobo, formatDate, avatarFor } from "@/lib/utils";

function statusStyle(status: string) {
  switch (status) {
    case "paid":
      return { bg: "#E3F7EF", color: "#0A7A56" };
    case "open":
      return { bg: "#EEF2FF", color: "#4338CA" };
    case "void":
      return { bg: "#F1F3F5", color: "#6B7280" };
    case "uncollectible":
      return { bg: "#FDECEC", color: "#A32D2D" };
    default:
      return { bg: "#F1F3F5", color: "#6B7280" };
  }
}

export default function InvoicesPage() {
  const [statusFilter, setStatusFilter] = useState("");

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: () => getInvoices(statusFilter || undefined),
  });
const { data: customersData } = useQuery({
  queryKey: ["customers", 100],
  queryFn: () => getCustomers(100),
});
  const { data: subsData } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: getSubscriptions,
  });

  const invoices = invoicesData?.data ?? [];
  const customers = customersData?.data ?? [];
  const subs = subsData?.data ?? [];

  const custById = new Map(customers.map((c) => [c.id, c]));
  const subById = new Map(subs.map((s) => [s.id, s]));

  const statuses = ["", "open", "paid", "void", "uncollectible"];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1
            className="text-xl lg:text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            Invoices
          </h1>
          <p
            className="text-sm font-medium mt-0.5"
            style={{ color: "#8A94A6" }}
          >
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold"
            style={{
              background: statusFilter === s ? "#0F1728" : "#fff",
              color: statusFilter === s ? "#fff" : "#6B7280",
              border: `1px solid ${statusFilter === s ? "#0F1728" : "#E5E7EB"}`,
            }}
          >
            {s === "" ? "ALL" : s.toUpperCase()}
          </button>
        ))}
      </div>

      <div
        className="bg-white border rounded-xl"
        style={{ borderColor: "#EAECEF" }}
      >
        {isLoading ? (
          <div
            className="p-12 text-center text-sm font-medium"
            style={{ color: "#8A94A6" }}
          >
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-receipt" style={{ fontSize: 22 }} />
            </div>
            <p className="text-sm font-bold mb-1" style={{ color: "#0F1728" }}>
              No invoices yet
            </p>
            <p
              className="text-xs font-medium mb-4"
              style={{ color: "#8A94A6" }}
            >
              Invoices are generated automatically when a subscription charge
              succeeds.
            </p>
            <Link
              href="/dashboard/subscriptions"
              className="text-sm font-bold"
              style={{ color: "#00B37E" }}
            >
              View subscriptions →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr
                  style={{
                    background: "#FAFBFC",
                    borderBottom: "0.5px solid #EAECEF",
                  }}
                >
                  {[
                    "Customer",
                    "Subscription",
                    "Amount",
                    "Status",
                    "Due date",
                    "Paid at",
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
                {invoices.map((inv: Invoice) => {
                  const cust = custById.get(inv.customer_id);
                  const sub = subById.get(inv.subscription_id);
                  const av = avatarFor(cust?.email ?? inv.customer_id);
                  const s = statusStyle(inv.status);
                  return (
                    <tr
                      key={inv.id}
                      style={{ borderTop: "0.5px solid #F2F4F6" }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
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
                        className="px-4 py-3 text-xs font-mono"
                        style={{ color: "#98A2B3" }}
                      >
                        {sub
                          ? sub.id.slice(0, 8) + "..."
                          : inv.subscription_id.slice(0, 8) + "..."}
                      </td>
                      <td
                        className="px-4 py-3 text-xs font-bold"
                        style={{ color: "#0F1728" }}
                      >
                        {formatKobo(inv.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: s.bg, color: s.color }}
                        >
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-xs font-medium"
                        style={{ color: "#4B5563" }}
                      >
                        {formatDate(inv.due_date)}
                      </td>
                      <td
                        className="px-4 py-3 text-xs font-medium"
                        style={{ color: inv.paid_at ? "#00B37E" : "#C4CACD" }}
                      >
                        {inv.paid_at ? formatDate(inv.paid_at) : "Unpaid"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

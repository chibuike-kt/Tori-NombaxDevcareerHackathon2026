"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getCustomer, getCustomerSubscriptions, getPlans } from "@/lib/api";
import { StatusPill } from "@/components/status-pill";
import { formatKobo, formatDate, avatarFor } from "@/lib/utils";
import type { Plan } from "@/lib/api";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: customerData, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id),
  });

  const { data: subsData } = useQuery({
    queryKey: ["customer-subscriptions", id],
    queryFn: () => getCustomerSubscriptions(id),
  });

  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: () => import("@/lib/api").then((m) => m.getPlans()),
  });

  const customer = customerData?.data;
  const subs = subsData?.data ?? [];
  const plans = plansData?.data ?? [];
  const planById = new Map<string, Plan>(plans.map((p) => [p.id, p]));

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-sm font-medium" style={{ color: "#8A94A6" }}>
          Loading customer...
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-sm font-medium" style={{ color: "#DC2626" }}>
          Customer not found.
        </div>
        <Link
          href="/dashboard/customers"
          className="text-sm font-bold mt-2 inline-block"
          style={{ color: "#00B37E" }}
        >
          Back to customers
        </Link>
      </div>
    );
  }

  const av = avatarFor(customer.email);

  const totalRevenue = subs
    .map((s) => planById.get(s.plan_id)?.amount ?? 0)
    .reduce((a, b) => a + b, 0);

  const activeSubs = subs.filter(
    (s) => s.status === "ACTIVE" || s.status === "TRIALING",
  ).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/customers"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border"
          style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 13 }} /> Customers
        </Link>
      </div>

      <div
        className="bg-white border rounded-xl p-6 mb-4"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="flex items-start gap-4">
          <span
            className="w-16 h-16 rounded-full inline-flex items-center justify-center text-xl font-extrabold flex-shrink-0"
            style={{ background: av.bg, color: av.color }}
          >
            {av.initials}
          </span>
          <div className="flex-1">
            <h1
              className="text-2xl font-extrabold mb-0.5"
              style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
            >
              {customer.name ?? customer.email}
            </h1>
            <p
              className="text-sm font-medium mb-3"
              style={{ color: "#8A94A6" }}
            >
              {customer.email}
            </p>
            <div className="flex gap-6">
              <div>
                <p
                  className="text-xs font-semibold mb-0.5"
                  style={{ color: "#8A94A6" }}
                >
                  Customer ID
                </p>
                <p className="text-xs font-mono" style={{ color: "#4B5563" }}>
                  {customer.id}
                </p>
              </div>
              {customer.external_id && (
                <div>
                  <p
                    className="text-xs font-semibold mb-0.5"
                    style={{ color: "#8A94A6" }}
                  >
                    External ID
                  </p>
                  <p className="text-xs font-mono" style={{ color: "#4B5563" }}>
                    {customer.external_id}
                  </p>
                </div>
              )}
              <div>
                <p
                  className="text-xs font-semibold mb-0.5"
                  style={{ color: "#8A94A6" }}
                >
                  Created
                </p>
                <p className="text-xs font-medium" style={{ color: "#4B5563" }}>
                  {formatDate(customer.created_at)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          ["Subscriptions", subs.length.toString(), "#0F1728"],
          ["Active", activeSubs.toString(), "#00B37E"],
          ["Plan value", formatKobo(totalRevenue), "#0F1728"],
        ].map(([label, value, color]) => (
          <div
            key={label}
            className="bg-white border rounded-xl p-5"
            style={{ borderColor: "#EAECEF" }}
          >
            <p
              className="text-xs font-semibold mb-2"
              style={{ color: "#8A94A6" }}
            >
              {label}
            </p>
            <p
              className="text-2xl font-extrabold"
              style={{ color, letterSpacing: "-0.02em" }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div
        className="bg-white border rounded-xl"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            Subscriptions
          </h2>
        </div>
        {subs.length === 0 ? (
          <div className="p-10 text-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-refresh" style={{ fontSize: 18 }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No subscriptions yet
            </p>
            <p
              className="text-xs font-medium mt-1"
              style={{ color: "#8A94A6" }}
            >
              This customer has not been subscribed to any plan.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr
                style={{
                  background: "#FAFBFC",
                  borderBottom: "0.5px solid #EAECEF",
                }}
              >
                {["Plan", "Amount", "Status", "Period end", "Dunning"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-[11px] font-semibold"
                      style={{ color: "#98A2B3" }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => {
                const plan = planById.get(sub.plan_id);
                return (
                  <tr key={sub.id} style={{ borderTop: "0.5px solid #F2F4F6" }}>
                    <td
                      className="px-4 py-3 text-xs font-semibold"
                      style={{ color: "#1F2733" }}
                    >
                      {plan?.name ?? "Unknown plan"}
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
                      style={{ color: "#4B5563" }}
                    >
                      {formatDate(sub.current_period_end)}
                    </td>
                    <td
                      className="px-4 py-3 text-xs font-medium"
                      style={{
                        color: sub.dunning_attempt > 0 ? "#B8860B" : "#C4CACD",
                      }}
                    >
                      {sub.dunning_attempt > 0
                        ? `Attempt ${sub.dunning_attempt}`
                        : "None"}
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

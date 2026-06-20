"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  getSubscriptions,
  getCustomers,
  getPlans,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  type Customer,
  type Plan,
} from "@/lib/api";
import { StatusPill } from "@/components/status-pill";
import { formatKobo, formatDate, avatarFor } from "@/lib/utils";

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const { data: subsData, isLoading } = useQuery({
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

  const subs = subsData?.data ?? [];
  const customers = customersData?.data ?? [];
  const plans = plansData?.data ?? [];

  const custById = new Map<string, Customer>(customers.map((c) => [c.id, c]));
  const planById = new Map<string, Plan>(plans.map((p) => [p.id, p]));

  const cancel = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
  const pause = useMutation({
    mutationFn: pauseSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
  const resume = useMutation({
    mutationFn: resumeSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  const states = [
    "ALL",
    "ACTIVE",
    "TRIALING",
    "DUNNING",
    "PAUSED",
    "SUSPENDED",
    "CANCELLED",
  ];
  const counts = Object.fromEntries(
    states.map((s) => [
      s,
      s === "ALL" ? subs.length : subs.filter((x) => x.status === s).length,
    ]),
  );

  const filtered = subs.filter((s) => {
    if (filter !== "ALL" && s.status !== filter) return false;
    if (search) {
      const cust = custById.get(s.customer_id);
      const plan = planById.get(s.plan_id);
      const q = search.toLowerCase();
      if (
        !cust?.email.toLowerCase().includes(q) &&
        !plan?.name.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            Subscriptions
          </h1>
          <p
            className="text-sm font-medium mt-0.5"
            style={{ color: "#8A94A6" }}
          >
            {subs.length} total billing relationships
          </p>
        </div>
        <Link
          href="/dashboard/customers"
          className="flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-lg font-bold text-white"
          style={{ background: "#00B37E" }}
        >
          <i className="ti ti-plus" /> New subscription
        </Link>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {states.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold"
            style={{
              background: filter === s ? "#0F1728" : "#fff",
              color: filter === s ? "#fff" : "#6B7280",
              border: `1px solid ${filter === s ? "#0F1728" : "#E5E7EB"}`,
            }}
          >
            {s}{" "}
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px]"
              style={{
                background: filter === s ? "rgba(255,255,255,0.2)" : "#F1F3F5",
              }}
            >
              {counts[s]}
            </span>
          </button>
        ))}
        <div
          className="ml-auto flex items-center gap-2 border rounded-lg px-3 py-1.5"
          style={{ borderColor: "#E5E7EB", background: "#fff" }}
        >
          <i
            className="ti ti-search"
            style={{ fontSize: 14, color: "#9CA3AF" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer or plan..."
            className="outline-none text-xs font-medium w-52"
            style={{ color: "#0F1728" }}
          />
        </div>
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
            Loading subscriptions...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-refresh" style={{ fontSize: 22 }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No subscriptions found
            </p>
            <p
              className="text-xs font-medium mt-1"
              style={{ color: "#8A94A6" }}
            >
              Try a different filter or search term.
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
                {[
                  "Customer",
                  "Plan",
                  "Amount",
                  "Status",
                  "Period end",
                  "Dunning",
                  "Actions",
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
              {filtered.map((sub) => {
                const cust = custById.get(sub.customer_id);
                const plan = planById.get(sub.plan_id);
                const av = avatarFor(cust?.email ?? sub.customer_id);
                return (
                  <tr key={sub.id} style={{ borderTop: "0.5px solid #F2F4F6" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background: av.bg, color: av.color }}
                        >
                          {av.initials}
                        </span>
                        <div>
                          <div
                            className="text-xs font-semibold"
                            style={{ color: "#1F2733" }}
                          >
                            {cust?.email ?? "Unknown"}
                          </div>
                          {cust?.name && (
                            <div
                              className="text-[10px] font-medium"
                              style={{ color: "#98A2B3" }}
                            >
                              {cust.name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-xs font-semibold"
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
                      style={{ color: "#4B5563" }}
                    >
                      {formatDate(sub.current_period_end)}
                    </td>
                    <td className="px-4 py-3">
                      {sub.dunning_attempt > 0 ? (
                        <span
                          className="text-xs font-bold"
                          style={{ color: "#B8860B" }}
                        >
                          Attempt {sub.dunning_attempt}
                        </span>
                      ) : (
                        <span
                          className="text-xs font-medium"
                          style={{ color: "#C4CACD" }}
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {sub.status === "ACTIVE" && (
                          <>
                            <button
                              onClick={() => pause.mutate(sub.id)}
                              className="text-[11px] px-2.5 py-1 rounded-md font-bold border"
                              style={{
                                borderColor: "#E5E7EB",
                                color: "#6B7280",
                              }}
                            >
                              Pause
                            </button>
                            <button
                              onClick={() => cancel.mutate(sub.id)}
                              className="text-[11px] px-2.5 py-1 rounded-md font-bold border"
                              style={{
                                borderColor: "#FDCACA",
                                color: "#DC2626",
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {sub.status === "PAUSED" && (
                          <button
                            onClick={() => resume.mutate(sub.id)}
                            className="text-[11px] px-2.5 py-1 rounded-md font-bold border"
                            style={{ borderColor: "#00B37E", color: "#00B37E" }}
                          >
                            Resume
                          </button>
                        )}
                        {(sub.status === "DUNNING" ||
                          sub.status === "PAST_DUE") && (
                          <button
                            onClick={() => cancel.mutate(sub.id)}
                            className="text-[11px] px-2.5 py-1 rounded-md font-bold border"
                            style={{ borderColor: "#FDCACA", color: "#DC2626" }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
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

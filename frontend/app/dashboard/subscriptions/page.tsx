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
  recoverSubscription,
  createCheckout,
  type Customer,
  type Plan,
} from "@/lib/api";
import { StatusPill } from "@/components/status-pill";
import { formatKobo, formatDate, avatarFor } from "@/lib/utils";

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutPlanId, setCheckoutPlanId] = useState("");
  const [checkoutExternalId, setCheckoutExternalId] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState<{
    customerCreated: boolean;
    email: string;
  } | null>(null);

  const { data: subsData, isLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: getSubscriptions,
  });
  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: () => getCustomers(100),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      setActionError(null);
    },
    onError: (e: unknown) =>
      setActionError(
        e instanceof Error ? e.message : "Failed to cancel subscription",
      ),
  });
  const pause = useMutation({
    mutationFn: pauseSubscription,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      setActionError(null);
    },
    onError: (e: unknown) =>
      setActionError(
        e instanceof Error ? e.message : "Failed to pause subscription",
      ),
  });
  const resume = useMutation({
    mutationFn: resumeSubscription,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      setActionError(null);
    },
    onError: (e: unknown) =>
      setActionError(
        e instanceof Error ? e.message : "Failed to resume subscription",
      ),
  });

  const recover = useMutation({
    mutationFn: recoverSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  const checkout = useMutation({
    mutationFn: () =>
      createCheckout(
        checkoutEmail,
        checkoutPlanId,
        checkoutName || undefined,
        checkoutExternalId || undefined,
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setCheckoutSuccess({
        customerCreated: res.data.customer_created,
        email: res.data.customer.email,
      });
      setCheckoutEmail("");
      setCheckoutName("");
      setCheckoutPlanId("");
      setCheckoutExternalId("");
      setCheckoutError("");
    },
    onError: (e: unknown) =>
      setCheckoutError(
        e instanceof Error ? e.message : "Failed to create subscription",
      ),
  });

  const states = [
    "ALL",
    "PENDING_PAYMENT",
    "ACTIVE",
    "TRIALING",
    "GRACE_PERIOD",
    "PAST_DUE",
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

  const activePlans = plans.filter((p) => p.is_active);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1
            className="text-xl lg:text-2xl font-extrabold"
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
        <button
          onClick={() => {
            setShowForm(true);
            setCheckoutSuccess(null);
          }}
          className="flex items-center gap-1.5 text-sm px-3 lg:px-4 py-2.5 rounded-lg font-bold text-white"
          style={{ background: "#00B37E" }}
        >
          <i className="ti ti-plus" />{" "}
          <span className="hidden sm:inline">New subscription</span>
        </button>
      </div>

      {showForm && (
        <div
          className="bg-white border rounded-xl p-5 mb-4"
          style={{ borderColor: "#EAECEF" }}
        >
          {checkoutSuccess ? (
            <div className="text-center py-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "#E6F8F2", color: "#00B37E" }}
              >
                <i className="ti ti-check" style={{ fontSize: 22 }} />
              </div>
              <p
                className="text-sm font-extrabold mb-1"
                style={{ color: "#0F1728" }}
              >
                Subscription started
              </p>
              <p
                className="text-xs font-medium mb-4"
                style={{ color: "#6B7280" }}
              >
                {checkoutSuccess.customerCreated
                  ? `${checkoutSuccess.email} was created as a new customer and subscribed.`
                  : `${checkoutSuccess.email} was found and subscribed to the plan.`}
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setCheckoutSuccess(null)}
                  className="text-sm px-4 py-2 rounded-lg font-bold text-white"
                  style={{ background: "#0F1728" }}
                >
                  Add another
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setCheckoutSuccess(null);
                  }}
                  className="text-sm px-4 py-2 rounded-lg font-bold border"
                  style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2
                className="text-sm font-bold mb-1"
                style={{ color: "#0F1728" }}
              >
                New subscription
              </h2>
              <p
                className="text-xs font-medium mb-4"
                style={{ color: "#8A94A6" }}
              >
                Enter a customer email and select a plan. If the customer does
                not exist yet, Tori creates them automatically.
              </p>
              {activePlans.length === 0 ? (
                <div
                  className="rounded-lg p-4 mb-4"
                  style={{ background: "#FFF8E1", border: "1px solid #FDE68A" }}
                >
                  <p
                    className="text-xs font-semibold"
                    style={{ color: "#0F1728" }}
                  >
                    No active plans
                  </p>
                  <p
                    className="text-xs font-medium mt-0.5"
                    style={{ color: "#6B7280" }}
                  >
                    You need at least one active plan before creating a
                    subscription.{" "}
                    <Link
                      href="/dashboard/plans"
                      style={{ color: "#00B37E", fontWeight: 600 }}
                    >
                      Create a plan
                    </Link>
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label
                        className="text-xs font-semibold block mb-1.5"
                        style={{ color: "#4B5563" }}
                      >
                        Customer email
                      </label>
                      <input
                        value={checkoutEmail}
                        onChange={(e) => setCheckoutEmail(e.target.value)}
                        placeholder="customer@business.ng"
                        className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
                        style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
                      />
                    </div>
                    <div>
                      <label
                        className="text-xs font-semibold block mb-1.5"
                        style={{ color: "#4B5563" }}
                      >
                        Customer name{" "}
                        <span style={{ color: "#9CA3AF", fontWeight: 400 }}>
                          optional
                        </span>
                      </label>
                      <input
                        value={checkoutName}
                        onChange={(e) => setCheckoutName(e.target.value)}
                        placeholder="Amaka Obi"
                        className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
                        style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
                      />
                    </div>
                    <div>
                      <label
                        className="text-xs font-semibold block mb-1.5"
                        style={{ color: "#4B5563" }}
                      >
                        Plan
                      </label>
                      <select
                        value={checkoutPlanId}
                        onChange={(e) => setCheckoutPlanId(e.target.value)}
                        className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
                        style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
                      >
                        <option value="">Select a plan</option>
                        {activePlans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {formatKobo(p.amount)}/{p.interval}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        className="text-xs font-semibold block mb-1.5"
                        style={{ color: "#4B5563" }}
                      >
                        External ID{" "}
                        <span style={{ color: "#9CA3AF", fontWeight: 400 }}>
                          optional
                        </span>
                      </label>
                      <input
                        value={checkoutExternalId}
                        onChange={(e) => setCheckoutExternalId(e.target.value)}
                        placeholder="user_12345"
                        className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
                        style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
                      />
                    </div>
                  </div>
                  {checkoutError && (
                    <p
                      className="text-xs font-medium mb-3"
                      style={{ color: "#DC2626" }}
                    >
                      {checkoutError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => checkout.mutate()}
                      disabled={
                        checkout.isPending || !checkoutEmail || !checkoutPlanId
                      }
                      className="text-sm px-4 py-2 rounded-lg font-bold text-white"
                      style={{
                        background:
                          checkout.isPending ||
                          !checkoutEmail ||
                          !checkoutPlanId
                            ? "#9CA3AF"
                            : "#0F1728",
                      }}
                    >
                      {checkout.isPending
                        ? "Starting..."
                        : "Start subscription"}
                    </button>
                    <button
                      onClick={() => {
                        setShowForm(false);
                        setCheckoutError("");
                      }}
                      className="text-sm px-4 py-2 rounded-lg font-bold border"
                      style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Filter tabs — horizontally scrollable on mobile */}
      <div className="overflow-x-auto pb-2 mb-4">
        <div className="flex gap-2 min-w-max">
          {states.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
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
                  background:
                    filter === s ? "rgba(255,255,255,0.2)" : "#F1F3F5",
                }}
              >
                {counts[s]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2 border rounded-lg px-3 py-2 mb-4 bg-white"
        style={{ borderColor: "#E5E7EB" }}
      >
        <i
          className="ti ti-search"
          style={{ fontSize: 14, color: "#9CA3AF" }}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer or plan..."
          className="outline-none text-xs font-medium flex-1"
          style={{ color: "#0F1728" }}
        />
      </div>

      {actionError && (
        <div
          className="rounded-lg px-4 py-3 mb-3 flex items-center gap-2"
          style={{ background: "#FDECEC", border: "1px solid #FDCACA" }}
        >
          <i
            className="ti ti-alert-circle flex-shrink-0"
            style={{ fontSize: 15, color: "#DC2626" }}
          />
          <span className="text-xs font-semibold" style={{ color: "#DC2626" }}>
            {actionError}
          </span>
          <button
            onClick={() => setActionError(null)}
            className="ml-auto flex-shrink-0"
            style={{ color: "#DC2626" }}
          >
            <i className="ti ti-x" style={{ fontSize: 14 }} />
          </button>
        </div>
      )}

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
                    <tr
                      key={sub.id}
                      style={{ borderTop: "0.5px solid #F2F4F6" }}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/subscriptions/${sub.id}`}
                          className="flex items-center gap-2.5"
                        >
                          <span
                            className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{ background: av.bg, color: av.color }}
                          >
                            {av.initials}
                          </span>
                          <div>
                            <div
                              className="text-xs font-semibold hover:underline"
                              style={{ color: "#1F2733" }}
                            >
                              {cust?.email ?? "Unknown"}
                            </div>
                            <div
                              className="text-[10px] font-mono"
                              style={{ color: "#C4CACD" }}
                            >
                              {sub.id.slice(0, 8)}...
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td
                        className="px-4 py-3 text-xs font-semibold"
                        style={{ color: "#4B5563" }}
                      >
                        {plan?.name ?? "Unknown"}
                      </td>
                      <td
                        className="px-4 py-3 text-xs font-bold"
                        style={{ color: "#0F1728" }}
                      >
                        {plan ? formatKobo(plan.amount) : "..."}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={sub.status} />
                        {sub.cancel_at_period_end && (
                          <span
                            className="block text-[10px] font-semibold mt-1"
                            style={{ color: "#B8860B" }}
                          >
                            Cancels {formatDate(sub.current_period_end)}
                          </span>
                        )}
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
                            None
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {(sub.status === "ACTIVE" ||
                            sub.status === "GRACE_PERIOD") && (
                            <>
                              {sub.status === "ACTIVE" && (
                                <button
                                  onClick={() => pause.mutate(sub.id)}
                                  className="text-[11px] px-2.5 py-1 rounded-md font-bold border hover:opacity-75 transition-opacity"
                                  style={{
                                    borderColor: "#E5E7EB",
                                    color: "#6B7280",
                                    cursor: "pointer",
                                  }}
                                >
                                  Pause
                                </button>
                              )}
                              {!sub.cancel_at_period_end && (
                                <button
                                  onClick={() => cancel.mutate(sub.id)}
                                  className="text-[11px] px-2.5 py-1 rounded-md font-bold border hover:opacity-75 transition-opacity"
                                  style={{
                                    borderColor: "#FDCACA",
                                    color: "#DC2626",
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                              )}
                            </>
                          )}
                          {sub.status === "PAUSED" && (
                            <button
                              onClick={() => resume.mutate(sub.id)}
                              className="text-[11px] px-2.5 py-1 rounded-md font-bold border"
                              style={{
                                borderColor: "#00B37E",
                                color: "#00B37E",
                              }}
                            >
                              Resume
                            </button>
                          )}
                          {(sub.status === "DUNNING" ||
                            sub.status === "PAST_DUE") && (
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
                          )}

                          {sub.status === "SUSPENDED" && (
                            <button
                              onClick={() => recover.mutate(sub.id)}
                              className="text-[11px] px-2.5 py-1 rounded-md font-bold border hover:opacity-75 transition-opacity"
                              style={{
                                borderColor: "#00B37E",
                                color: "#00B37E",
                                cursor: "pointer",
                              }}
                            >
                              Recover
                            </button>
                          )}
                        </div>
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

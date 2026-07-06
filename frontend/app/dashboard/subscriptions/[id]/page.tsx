"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  getSubscription,
  getSubscriptionTransitions,
  getCustomers,
  getPlans,
  type Customer,
  type Plan,
} from "@/lib/api";
import { StatusPill } from "@/components/status-pill";
import { formatKobo, formatDate } from "@/lib/utils";

export default function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: subData, isLoading } = useQuery({
    queryKey: ["subscription", id],
    queryFn: () => getSubscription(id),
    // Never serve a cached snapshot from an earlier visit to this same
    // subscription — a webhook can flip its status seconds after the list
    // page's own (separately cached) row was fetched, so this query must
    // always hit the network on mount rather than trusting the global
    // 30s staleTime window.
    staleTime: 0,
    refetchOnMount: "always",
    // Keep polling while the subscription is mid-transition (e.g. waiting on
    // the payment_success webhook), so a tab left open catches the status
    // change on its own instead of showing a stale PENDING_PAYMENT forever.
    refetchInterval: (query) =>
      query.state.data?.data?.status === "PENDING_PAYMENT" ? 5000 : false,
  });
  const { data: transitionsData } = useQuery({
    queryKey: ["subscription-transitions", id],
    queryFn: () => getSubscriptionTransitions(id),
  });
  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: () => getCustomers(100),
  });
  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
  });

  const sub = subData?.data;
  const transitions = transitionsData?.data ?? [];
  const customers = customersData?.data ?? [];
  const plans = plansData?.data ?? [];
  const custById = new Map<string, Customer>(customers.map((c) => [c.id, c]));
  const planById = new Map<string, Plan>(plans.map((p) => [p.id, p]));

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm font-medium" style={{ color: "#8A94A6" }}>
          Loading subscription...
        </div>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="p-6">
        <div className="text-sm font-medium mb-2" style={{ color: "#DC2626" }}>
          Subscription not found.
        </div>
        <Link
          href="/dashboard/subscriptions"
          className="text-sm font-bold"
          style={{ color: "#00B37E" }}
        >
          Back to subscriptions
        </Link>
      </div>
    );
  }

  const customer = custById.get(sub.customer_id);
  const plan = planById.get(sub.plan_id);

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/dashboard/subscriptions"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border"
          style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 13 }} /> Subscriptions
        </Link>
      </div>

      <div
        className="bg-white border rounded-xl p-5 mb-4"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h1
              className="text-xl lg:text-2xl font-extrabold"
              style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
            >
              {customer?.email ?? "Unknown customer"}
            </h1>
            <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
              {plan?.name ?? "Unknown plan"}
              {plan ? ` — ${formatKobo(plan.amount)}/${plan.interval}` : ""}
            </p>
          </div>
          <StatusPill status={sub.status} />
        </div>
        <div className="flex flex-wrap gap-4 lg:gap-6">
          <div>
            <p className="text-xs font-semibold mb-0.5" style={{ color: "#8A94A6" }}>
              Subscription ID
            </p>
            <p className="text-xs font-mono" style={{ color: "#4B5563" }}>
              {sub.id}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold mb-0.5" style={{ color: "#8A94A6" }}>
              Current period ends
            </p>
            <p className="text-xs font-medium" style={{ color: "#4B5563" }}>
              {formatDate(sub.current_period_end)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold mb-0.5" style={{ color: "#8A94A6" }}>
              Dunning attempts
            </p>
            <p className="text-xs font-medium" style={{ color: "#4B5563" }}>
              {sub.dunning_attempt}
            </p>
          </div>
        </div>
      </div>

      <div
        className="bg-white border rounded-xl"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            Status history
          </h2>
        </div>
        {transitions.length === 0 ? (
          <div className="p-10 text-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-history" style={{ fontSize: 18 }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No transitions recorded yet
            </p>
            <p className="text-xs font-medium mt-1" style={{ color: "#8A94A6" }}>
              Status changes will appear here as they happen.
            </p>
          </div>
        ) : (
          <div className="p-5">
            <ol className="relative border-l-2 ml-2" style={{ borderColor: "#F0F2F4" }}>
              {transitions.map((t) => (
                <li key={t.id} className="mb-6 ml-5 last:mb-0">
                  <span
                    className="absolute w-3 h-3 rounded-full -left-[7px] border-2"
                    style={{ background: "#00B37E", borderColor: "#fff" }}
                  />
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <StatusPill status={t.from_status} />
                    <i className="ti ti-arrow-right" style={{ fontSize: 12, color: "#9CA3AF" }} />
                    <StatusPill status={t.to_status} />
                  </div>
                  <p className="text-xs font-medium" style={{ color: "#8A94A6" }}>
                    {formatDate(t.created_at)}
                    {t.reason ? ` · ${t.reason}` : ""}
                    {t.actor ? ` · ${t.actor}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

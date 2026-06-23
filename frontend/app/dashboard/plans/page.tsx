"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPlans, createPlan } from "@/lib/api";
import { formatKobo, formatDate } from "@/lib/utils";

function PlanIDRow({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div
      className="rounded-lg px-3 py-2 mb-3 flex items-center gap-2"
      style={{ background: "#F8F9FA" }}
    >
      <i
        className="ti ti-key"
        style={{ fontSize: 12, color: "#9CA3AF", flexShrink: 0 }}
      />
      <code
        className="text-[10px] font-mono flex-1 truncate"
        style={{ color: "#6B7280" }}
      >
        {id}
      </code>
      <button
        onClick={copy}
        className="text-[10px] font-bold flex-shrink-0 px-2 py-0.5 rounded"
        style={{
          background: copied ? "#E3F7EF" : "#E5E7EB",
          color: copied ? "#0A7A56" : "#4B5563",
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function PlansPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
  });
  const plans = data?.data ?? [];
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    amount: "",
    interval: "monthly",
    trial_period_days: "0",
  });

  const create = useMutation({
    mutationFn: () =>
      createPlan({
        name: form.name,
        amount: Math.round(parseFloat(form.amount) * 100),
        interval: form.interval,
        trial_period_days: parseInt(form.trial_period_days),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      setShowForm(false);
      setForm({
        name: "",
        amount: "",
        interval: "monthly",
        trial_period_days: "0",
      });
      setError("");
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Failed to create plan"),
  });

  const intervalLabel: Record<string, string> = {
    monthly: "/mo",
    annual: "/yr",
    custom: " custom",
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1
            className="text-xl lg:text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            Plans
          </h1>
          <p
            className="text-sm font-medium mt-0.5"
            style={{ color: "#8A94A6" }}
          >
            {plans.length} active pricing plans
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm px-3 lg:px-4 py-2.5 rounded-lg font-bold text-white"
          style={{ background: "#00B37E" }}
        >
          <i className="ti ti-plus" />{" "}
          <span className="hidden sm:inline">Create plan</span>
        </button>
      </div>

      {showForm && (
        <div
          className="bg-white border rounded-xl p-5 mb-5"
          style={{ borderColor: "#EAECEF" }}
        >
          <h2 className="text-sm font-bold mb-4" style={{ color: "#0F1728" }}>
            New plan
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label
                className="text-xs font-semibold block mb-1.5"
                style={{ color: "#4B5563" }}
              >
                Plan name
              </label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Pro"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium"
                style={{ background: "#F8F9FA", color: "#0F1728" }}
              />
            </div>
            <div>
              <label
                className="text-xs font-semibold block mb-1.5"
                style={{ color: "#4B5563" }}
              >
                Amount (₦)
              </label>
              <input
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                placeholder="15000"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium"
                style={{ background: "#F8F9FA", color: "#0F1728" }}
              />
            </div>
            <div>
              <label
                className="text-xs font-semibold block mb-1.5"
                style={{ color: "#4B5563" }}
              >
                Billing interval
              </label>
              <select
                value={form.interval}
                onChange={(e) =>
                  setForm((f) => ({ ...f, interval: e.target.value }))
                }
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium"
                style={{ background: "#F8F9FA", color: "#0F1728" }}
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label
                className="text-xs font-semibold block mb-1.5"
                style={{ color: "#4B5563" }}
              >
                Trial days
              </label>
              <input
                value={form.trial_period_days}
                onChange={(e) =>
                  setForm((f) => ({ ...f, trial_period_days: e.target.value }))
                }
                placeholder="0"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium"
                style={{ background: "#F8F9FA", color: "#0F1728" }}
              />
            </div>
          </div>
          {error && (
            <p
              className="text-xs font-medium mb-3"
              style={{ color: "#DC2626" }}
            >
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="text-sm px-4 py-2 rounded-lg font-bold text-white"
              style={{ background: create.isPending ? "#9CA3AF" : "#0F1728" }}
            >
              {create.isPending ? "Creating..." : "Create plan"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setError("");
              }}
              className="text-sm px-4 py-2 rounded-lg font-bold border"
              style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div
          className="p-12 text-center text-sm font-medium"
          style={{ color: "#8A94A6" }}
        >
          Loading plans...
        </div>
      ) : plans.length === 0 ? (
        <div
          className="bg-white border rounded-xl p-12 text-center"
          style={{ borderColor: "#EAECEF" }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: "#F1F3F5", color: "#9CA3AF" }}
          >
            <i className="ti ti-file-text" style={{ fontSize: 22 }} />
          </div>
          <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
            No plans yet
          </p>
          <p
            className="text-xs font-medium mt-1 mb-4"
            style={{ color: "#8A94A6" }}
          >
            Create your first billing plan to start subscriptions.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm px-4 py-2 rounded-lg font-bold text-white"
            style={{ background: "#0F1728" }}
          >
            Create plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white border rounded-xl p-5"
              style={{ borderColor: "#EAECEF" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#E6F8F2", color: "#00B37E" }}
                >
                  <i className="ti ti-file-text" style={{ fontSize: 20 }} />
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-1 rounded-full"
                  style={{
                    background: plan.is_active ? "#E3F7EF" : "#F1F3F5",
                    color: plan.is_active ? "#0A7A56" : "#6B7280",
                  }}
                >
                  {plan.is_active ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
              <h3
                className="text-base font-extrabold mb-0.5"
                style={{ color: "#0F1728" }}
              >
                {plan.name}
              </h3>
              <div className="flex items-baseline gap-0.5 mb-3">
                <span
                  className="text-2xl font-extrabold"
                  style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
                >
                  {formatKobo(plan.amount)}
                </span>
                <span
                  className="text-sm font-medium"
                  style={{ color: "#8A94A6" }}
                >
                  {intervalLabel[plan.interval] ?? ""}
                </span>
              </div>
              {plan.trial_period_days > 0 && (
                <div className="flex items-center gap-1.5 mb-3">
                  <i
                    className="ti ti-clock"
                    style={{ fontSize: 13, color: "#8A94A6" }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#8A94A6" }}
                  >
                    {plan.trial_period_days}-day free trial
                  </span>
                </div>
              )}
              <PlanIDRow id={plan.id} />
              <div
                className="pt-3 border-t flex items-center justify-between"
                style={{ borderColor: "#F0F2F4" }}
              >
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "#98A2B3" }}
                >
                  Created {formatDate(plan.created_at)}
                </span>
                <span
                  className="text-[11px] font-bold capitalize"
                  style={{ color: "#6B7280" }}
                >
                  {plan.interval}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPlans, createPlan } from "@/lib/api";
import { formatKobo, formatDate } from "@/lib/utils";

export default function PlansPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
  });
  const plans = data?.data ?? [];
  const [showForm, setShowForm] = useState(false);
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
        amount: parseInt(form.amount) * 100, // naira to kobo
        interval: form.interval,
        trial_period_days: parseInt(form.trial_period_days),
        currency: "NGN",
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
    },
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--heading)" }}
          >
            Plans
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            {plans.length} active plans
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="text-sm px-4 py-2 rounded-lg font-medium text-white"
          style={{ background: "var(--primary)" }}
        >
          Create plan
        </button>
      </div>

      {showForm && (
        <div
          className="rounded-lg border p-4 mb-4"
          style={{
            borderColor: "var(--border)",
            background: "var(--background)",
          }}
        >
          <h2
            className="text-sm font-medium mb-3"
            style={{ color: "var(--heading)" }}
          >
            New plan
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              placeholder="Plan name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="border rounded px-3 py-1.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--body)" }}
            />
            <input
              placeholder="Amount in ₦ (e.g. 5000)"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
              className="border rounded px-3 py-1.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--body)" }}
            />
            <select
              value={form.interval}
              onChange={(e) =>
                setForm((f) => ({ ...f, interval: e.target.value }))
              }
              className="border rounded px-3 py-1.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--body)" }}
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
              <option value="custom">Custom</option>
            </select>
            <input
              placeholder="Trial days (0 = no trial)"
              value={form.trial_period_days}
              onChange={(e) =>
                setForm((f) => ({ ...f, trial_period_days: e.target.value }))
              }
              className="border rounded px-3 py-1.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--body)" }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => create.mutate()}
              className="text-sm px-4 py-1.5 rounded font-medium text-white"
              style={{ background: "var(--primary)" }}
            >
              {create.isPending ? "Creating..." : "Create plan"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-sm px-3 py-1.5 rounded border"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Loading...
          </div>
        ) : plans.length === 0 ? (
          <div
            className="col-span-3 text-center text-sm py-10"
            style={{ color: "var(--muted)" }}
          >
            No plans yet. Create your first billing plan.
          </div>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-lg border p-4"
              style={{
                borderColor: "var(--border)",
                background: "var(--background)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <h3
                  className="text-sm font-medium"
                  style={{ color: "var(--heading)" }}
                >
                  {plan.name}
                </h3>
                <span
                  className="text-sm px-1.5 py-0.5 rounded"
                  style={{ background: "#E6F8F2", color: "var(--primary)" }}
                >
                  {plan.interval}
                </span>
              </div>
              <p
                className="text-2xl font-semibold mb-1"
                style={{ color: "var(--heading)" }}
              >
                {formatKobo(plan.amount)}
              </p>
              {plan.trial_period_days > 0 && (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {plan.trial_period_days} day trial
                </p>
              )}
              <p className="text-sm mt-3" style={{ color: "var(--muted)" }}>
                Created {formatDate(plan.created_at)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

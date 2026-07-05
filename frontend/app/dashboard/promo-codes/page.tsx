"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPromoCodes,
  createPromoCode,
  deactivatePromoCode,
  getPlans,
  type PromoCode,
  type Plan,
} from "@/lib/api";
import { formatKobo, formatDate } from "@/lib/utils";

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

type Status = "Active" | "Expired" | "Depleted" | "Inactive";

function statusOf(p: PromoCode): Status {
  if (!p.is_active) return "Inactive";
  if (p.expires_at && new Date(p.expires_at).getTime() < Date.now()) return "Expired";
  if (p.max_uses != null && p.use_count >= p.max_uses) return "Depleted";
  return "Active";
}

const statusStyle: Record<Status, { bg: string; color: string }> = {
  Active: { bg: "#E3F7EF", color: "#0A7A56" },
  Expired: { bg: "#F1F3F5", color: "#6B7280" },
  Depleted: { bg: "#FEF3C7", color: "#92400E" },
  Inactive: { bg: "#F1F3F5", color: "#9CA3AF" },
};

function discountLabel(p: PromoCode): string {
  return p.discount_type === "percentage"
    ? `${p.discount_value}% off`
    : `${formatKobo(p.discount_value)} off`;
}

function CreateModal({
  plans,
  onClose,
}: {
  plans: Plan[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [code, setCode] = useState(randomCode());
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("20");
  const [planId, setPlanId] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: () => {
      const value =
        discountType === "percentage"
          ? Math.round(parseFloat(discountValue))
          : Math.round(parseFloat(discountValue) * 100);
      return createPromoCode({
        code,
        description: description || undefined,
        discount_type: discountType,
        discount_value: value,
        plan_id: planId || undefined,
        max_uses: maxUses ? parseInt(maxUses) : undefined,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promo-codes"] });
      onClose();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Failed to create promo code"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(15,23,40,0.5)" }}
    >
      <div
        className="bg-white rounded-xl border max-w-lg w-full p-6 my-8"
        style={{ borderColor: "#EAECEF" }}
      >
        <h2 className="text-lg font-extrabold mb-4" style={{ color: "#0F1728" }}>
          Create promo code
        </h2>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: "#4B5563" }}>
              Code
            </label>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SAVE20"
                maxLength={20}
                className="flex-1 rounded-lg px-3.5 py-2.5 text-sm outline-none font-mono font-semibold uppercase"
                style={{ background: "#F8F9FA", color: "#0F1728" }}
              />
              <button
                onClick={() => setCode(randomCode())}
                className="text-xs font-bold px-3 rounded-lg border flex-shrink-0"
                style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
              >
                Regenerate
              </button>
            </div>
            <p className="text-[11px] font-medium mt-1" style={{ color: "#9CA3AF" }}>
              4-20 uppercase letters and numbers.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: "#4B5563" }}>
              Description <span style={{ color: "#9CA3AF", fontWeight: 400 }}>optional</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Launch promo for new customers"
              className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium"
              style={{ background: "#F8F9FA", color: "#0F1728" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "#4B5563" }}>
                Discount type
              </label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium"
                style={{ background: "#F8F9FA", color: "#0F1728" }}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "#4B5563" }}>
                {discountType === "percentage" ? "Percent off" : "Amount off (₦)"}
              </label>
              <input
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percentage" ? "20" : "500"}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium"
                style={{ background: "#F8F9FA", color: "#0F1728" }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: "#4B5563" }}>
              Applies to <span style={{ color: "#9CA3AF", fontWeight: 400 }}>optional</span>
            </label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium"
              style={{ background: "#F8F9FA", color: "#0F1728" }}
            >
              <option value="">All plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "#4B5563" }}>
                Max uses <span style={{ color: "#9CA3AF", fontWeight: 400 }}>optional</span>
              </label>
              <input
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium"
                style={{ background: "#F8F9FA", color: "#0F1728" }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "#4B5563" }}>
                Expires <span style={{ color: "#9CA3AF", fontWeight: 400 }}>optional</span>
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium"
                style={{ background: "#F8F9FA", color: "#0F1728" }}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs font-medium mb-3" style={{ color: "#DC2626" }}>
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || !code || !discountValue}
            className="text-sm px-4 py-2 rounded-lg font-bold text-white"
            style={{
              background:
                create.isPending || !code || !discountValue ? "#9CA3AF" : "#0F1728",
            }}
          >
            {create.isPending ? "Creating..." : "Create promo code"}
          </button>
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg font-bold border"
            style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PromoCodesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["promo-codes"],
    queryFn: getPromoCodes,
  });
  const { data: plansData } = useQuery({ queryKey: ["plans"], queryFn: getPlans });

  const codes = data?.data ?? [];
  const plans = plansData?.data ?? [];
  const planById = new Map<string, Plan>(plans.map((p) => [p.id, p]));

  const deactivate = useMutation({
    mutationFn: (id: string) => deactivatePromoCode(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promo-codes"] });
      setConfirmDeactivateId(null);
    },
  });

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1
            className="text-xl lg:text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            Promo Codes
          </h1>
          <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
            Discounts customers can redeem at checkout
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-sm px-3 lg:px-4 py-2.5 rounded-lg font-bold text-white"
          style={{ background: "#00B37E" }}
        >
          <i className="ti ti-plus" /> <span className="hidden sm:inline">Create promo code</span>
        </button>
      </div>

      <div className="bg-white border rounded-xl" style={{ borderColor: "#EAECEF" }}>
        {isLoading ? (
          <div
            className="p-12 text-center text-sm font-medium"
            style={{ color: "#8A94A6" }}
          >
            Loading promo codes...
          </div>
        ) : codes.length === 0 ? (
          <div className="p-12 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-discount" style={{ fontSize: 22 }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No promo codes yet
            </p>
            <p className="text-xs font-medium mt-1" style={{ color: "#8A94A6" }}>
              Create a code to offer discounts at checkout.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr style={{ background: "#FAFBFC", borderBottom: "0.5px solid #EAECEF" }}>
                  {["Code", "Discount", "Applies to", "Uses", "Expires", "Status", "Actions"].map(
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
                {codes.map((p) => {
                  const status = statusOf(p);
                  const style = statusStyle[status];
                  return (
                    <tr key={p.id} style={{ borderTop: "0.5px solid #F2F4F6" }}>
                      <td className="px-4 py-3">
                        <code className="text-xs font-mono font-bold" style={{ color: "#0F1728" }}>
                          {p.code}
                        </code>
                        {p.description && (
                          <div className="text-[11px] font-medium mt-0.5" style={{ color: "#9CA3AF" }}>
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: "#0F1728" }}>
                        {discountLabel(p)}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: "#4B5563" }}>
                        {p.plan_id ? planById.get(p.plan_id)?.name ?? "Unknown plan" : "All plans"}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: "#4B5563" }}>
                        {p.max_uses != null ? `${p.use_count}/${p.max_uses}` : "Unlimited"}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: "#4B5563" }}>
                        {p.expires_at ? formatDate(p.expires_at) : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                          style={{ background: style.bg, color: style.color }}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.is_active &&
                          (confirmDeactivateId === p.id ? (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => deactivate.mutate(p.id)}
                                disabled={deactivate.isPending}
                                className="text-[11px] px-2.5 py-1 rounded-md font-bold text-white"
                                style={{ background: "#DC2626" }}
                              >
                                {deactivate.isPending ? "..." : "Confirm"}
                              </button>
                              <button
                                onClick={() => setConfirmDeactivateId(null)}
                                className="text-[11px] px-2.5 py-1 rounded-md font-bold border"
                                style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeactivateId(p.id)}
                              className="text-[11px] px-2.5 py-1 rounded-md font-bold border"
                              style={{ borderColor: "#FDCACA", color: "#DC2626" }}
                            >
                              Deactivate
                            </button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreateModal plans={plans} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

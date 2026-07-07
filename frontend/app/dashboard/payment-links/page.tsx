"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPaymentLinks,
  createPaymentLink,
  deactivatePaymentLink,
  getMe,
  type PaymentLink,
} from "@/lib/api";
import { formatKobo, formatDateTime } from "@/lib/utils";
import { can, type Role } from "@/lib/permissions";

function CreateLinkModal({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (input: { title: string; description?: string; amountKobo: number; maxUses?: number }) => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amountNaira, setAmountNaira] = useState("");
  const [maxUses, setMaxUses] = useState("");

  const amountKobo = Math.round(parseFloat(amountNaira || "0") * 100);
  const canSubmit = title.trim().length > 0 && amountKobo > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,40,0.5)" }}
    >
      <div
        className="bg-white rounded-xl border max-w-md w-full p-6"
        style={{ borderColor: "#EAECEF" }}
      >
        <h2 className="text-base font-extrabold mb-1" style={{ color: "#0F1728" }}>
          Create payment link
        </h2>
        <p className="text-xs font-medium mb-4" style={{ color: "#8A94A6" }}>
          A shareable link customers can use to pay you once.
        </p>

        <label className="block text-xs font-bold mb-1.5" style={{ color: "#4B5563" }}>
          Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. School onboarding fee"
          className="w-full text-sm px-3 py-2.5 rounded-lg border mb-4 outline-none"
          style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
        />

        <label className="block text-xs font-bold mb-1.5" style={{ color: "#4B5563" }}>
          Description (optional)
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this payment for?"
          className="w-full text-sm px-3 py-2.5 rounded-lg border mb-4 outline-none"
          style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
        />

        <label className="block text-xs font-bold mb-1.5" style={{ color: "#4B5563" }}>
          Amount (₦)
        </label>
        <input
          type="number"
          value={amountNaira}
          onChange={(e) => setAmountNaira(e.target.value)}
          placeholder="0.00"
          className="w-full text-sm px-3 py-2.5 rounded-lg border mb-4 outline-none"
          style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
        />

        <label className="block text-xs font-bold mb-1.5" style={{ color: "#4B5563" }}>
          Max uses (optional)
        </label>
        <input
          type="number"
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          placeholder="Unlimited"
          className="w-full text-sm px-3 py-2.5 rounded-lg border mb-5 outline-none"
          style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
        />

        <div className="flex gap-2">
          <button
            onClick={() =>
              canSubmit &&
              onSubmit({
                title: title.trim(),
                description: description.trim() || undefined,
                amountKobo,
                maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
              })
            }
            disabled={!canSubmit || submitting}
            className="flex-1 text-sm px-4 py-2.5 rounded-lg font-bold text-white disabled:opacity-50"
            style={{ background: "#0F1728" }}
          >
            {submitting ? "Creating..." : "Create link"}
          </button>
          <button
            onClick={onClose}
            className="text-sm px-4 py-2.5 rounded-lg font-bold border"
            style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentLinksPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const { data: meData } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const role = (meData?.data?.member_role as Role) || "owner";
  const canManage = can(role, "manage_payment_links");

  const { data: linksData, isLoading } = useQuery({
    queryKey: ["payment-links"],
    queryFn: getPaymentLinks,
  });
  const links = linksData?.data ?? [];

  const create = useMutation({
    mutationFn: (input: { title: string; description?: string; amountKobo: number; maxUses?: number }) =>
      createPaymentLink({
        title: input.title,
        description: input.description,
        amount_kobo: input.amountKobo,
        max_uses: input.maxUses,
      }),
    onSuccess: () => {
      setShowCreate(false);
      setError("");
      qc.invalidateQueries({ queryKey: ["payment-links"] });
    },
    onError: (e: Error) => setError(e.message || "Failed to create payment link"),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => deactivatePaymentLink(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-links"] }),
  });

  const copyLink = (id: string) => {
    const payUrl = `${window.location.origin}/pay/${id}`;
    navigator.clipboard.writeText(payUrl).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(""), 1500);
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-xl lg:text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            Payment Links
          </h1>
          <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
            Collect one-off payments without a subscription — share a link, get paid.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="text-sm px-4 py-2.5 rounded-lg font-bold text-white flex-shrink-0"
            style={{ background: "#0F1728" }}
          >
            <i className="ti ti-plus mr-1.5" style={{ fontSize: 14 }} />
            Create link
          </button>
        )}
      </div>

      {error && (
        <div
          className="rounded-lg px-4 py-3 mb-4 text-sm font-semibold"
          style={{ background: "#FEE2E2", color: "#991B1B" }}
        >
          {error}
        </div>
      )}

      <div
        className="bg-white border rounded-xl overflow-hidden"
        style={{ borderColor: "#EAECEF" }}
      >
        {isLoading ? (
          <div className="p-10 text-center text-sm font-medium" style={{ color: "#8A94A6" }}>
            Loading...
          </div>
        ) : links.length === 0 ? (
          <div className="p-10 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-link" style={{ fontSize: 22 }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No payment links yet
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ background: "#F8F9FA", borderBottom: "1px solid #EAECEF" }}>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Title</th>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Amount</th>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Uses</th>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Status</th>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Created</th>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}></th>
                </tr>
              </thead>
              <tbody>
                {links.map((l: PaymentLink) => (
                  <tr key={l.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                    <td className="px-5 py-3.5 font-bold" style={{ color: "#0F1728" }}>
                      {l.title}
                      {l.description && (
                        <span className="block text-xs font-medium" style={{ color: "#9CA3AF" }}>
                          {l.description}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "#4B5563" }}>
                      {formatKobo(l.amount_kobo)}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "#4B5563" }}>
                      {l.use_count}{l.max_uses ? ` / ${l.max_uses}` : ""}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                        style={{
                          background: l.is_active ? "#E6F8F2" : "#F1F3F5",
                          color: l.is_active ? "#00703C" : "#6B7280",
                        }}
                      >
                        {l.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "#8A94A6" }}>
                      {formatDateTime(l.created_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => copyLink(l.id)}
                        className="text-xs font-bold px-2.5 py-1.5 rounded-lg border mr-2"
                        style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
                      >
                        {copiedId === l.id ? "Copied!" : "Copy link"}
                      </button>
                      {canManage && l.is_active && (
                        <button
                          onClick={() => deactivate.mutate(l.id)}
                          disabled={deactivate.isPending}
                          className="text-xs font-bold px-2.5 py-1.5 rounded-lg border disabled:opacity-50"
                          style={{ borderColor: "#FCA5A5", color: "#DC2626" }}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateLinkModal
          onClose={() => setShowCreate(false)}
          onSubmit={(input) => create.mutate(input)}
          submitting={create.isPending}
        />
      )}
    </div>
  );
}

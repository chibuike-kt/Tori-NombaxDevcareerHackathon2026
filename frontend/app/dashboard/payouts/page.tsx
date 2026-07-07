"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBalance,
  getPayouts,
  getBanks,
  createPayout,
  resolveAccount,
  getMe,
  type Payout,
  type Bank,
} from "@/lib/api";
import { formatKobo, formatDateTime } from "@/lib/utils";
import { can, type Role } from "@/lib/permissions";

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return { label: "Completed", bg: "#E6F8F2", color: "#00703C" };
    case "processing":
      return { label: "Processing", bg: "#EAF2FF", color: "#1D4ED8" };
    case "failed":
      return { label: "Failed", bg: "#FEE2E2", color: "#991B1B" };
    default:
      return { label: "Pending", bg: "#FEF3C7", color: "#92400E" };
  }
}

function RequestPayoutModal({
  availableKobo,
  banks,
  onClose,
  onSubmit,
  submitting,
}: {
  availableKobo: number;
  banks: Bank[];
  onClose: () => void;
  onSubmit: (input: {
    amountKobo: number;
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) => void;
  submitting: boolean;
}) {
  const [amountNaira, setAmountNaira] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  const bankName = banks.find((b) => b.code === bankCode)?.name ?? "";
  const amountKobo = Math.round(parseFloat(amountNaira || "0") * 100);
  const overLimit = amountKobo > availableKobo;
  const canSubmit =
    amountKobo > 0 && !overLimit && bankCode && accountNumber.length >= 10 && accountName;

  const verify = async () => {
    if (!bankCode || accountNumber.length < 10) return;
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await resolveAccount(accountNumber, bankCode);
      setAccountName(res.data.account_name);
    } catch {
      setVerifyError("Could not verify this account — check the number and bank.");
      setAccountName("");
    } finally {
      setVerifying(false);
    }
  };

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
          Request payout
        </h2>
        <p className="text-xs font-medium mb-4" style={{ color: "#8A94A6" }}>
          Available to withdraw: {formatKobo(availableKobo)}
        </p>

        <label className="block text-xs font-bold mb-1.5" style={{ color: "#4B5563" }}>
          Amount (₦)
        </label>
        <input
          type="number"
          value={amountNaira}
          onChange={(e) => setAmountNaira(e.target.value)}
          placeholder="0.00"
          className="w-full text-sm px-3 py-2.5 rounded-lg border mb-1 outline-none"
          style={{ borderColor: overLimit ? "#FCA5A5" : "#E5E7EB", color: "#0F1728" }}
        />
        {overLimit && (
          <p className="text-xs font-semibold mb-3" style={{ color: "#DC2626" }}>
            Exceeds available balance
          </p>
        )}
        {!overLimit && <div className="mb-3" />}

        <label className="block text-xs font-bold mb-1.5" style={{ color: "#4B5563" }}>
          Bank
        </label>
        <select
          value={bankCode}
          onChange={(e) => {
            setBankCode(e.target.value);
            setAccountName("");
          }}
          className="w-full text-sm px-3 py-2.5 rounded-lg border mb-4 outline-none bg-white"
          style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
        >
          <option value="">Select a bank...</option>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>

        <label className="block text-xs font-bold mb-1.5" style={{ color: "#4B5563" }}>
          Account number
        </label>
        <div className="flex gap-2 mb-1">
          <input
            value={accountNumber}
            onChange={(e) => {
              setAccountNumber(e.target.value);
              setAccountName("");
            }}
            placeholder="0123456789"
            className="flex-1 text-sm px-3 py-2.5 rounded-lg border outline-none"
            style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
          />
          <button
            onClick={verify}
            disabled={!bankCode || accountNumber.length < 10 || verifying}
            className="text-xs font-bold px-3 py-2 rounded-lg border disabled:opacity-50 flex-shrink-0"
            style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
          >
            {verifying ? "Verifying..." : "Verify account"}
          </button>
        </div>
        {verifyError && (
          <p className="text-xs font-semibold mb-2" style={{ color: "#DC2626" }}>
            {verifyError}
          </p>
        )}
        {accountName && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 mb-4"
            style={{ background: "#E6F8F2" }}
          >
            <i className="ti ti-circle-check" style={{ fontSize: 14, color: "#00703C" }} />
            <span className="text-xs font-bold" style={{ color: "#00703C" }}>
              {accountName}
            </span>
          </div>
        )}
        {!accountName && !verifyError && <div className="mb-4" />}

        <div className="flex gap-2">
          <button
            onClick={() =>
              canSubmit &&
              onSubmit({ amountKobo, bankCode, bankName, accountNumber, accountName })
            }
            disabled={!canSubmit || submitting}
            className="flex-1 text-sm px-4 py-2.5 rounded-lg font-bold text-white disabled:opacity-50"
            style={{ background: "#0F1728" }}
          >
            {submitting ? "Requesting..." : "Confirm payout"}
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

export default function PayoutsPage() {
  const qc = useQueryClient();
  const [showRequest, setShowRequest] = useState(false);
  const [error, setError] = useState("");

  const { data: meData } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const role = (meData?.data?.member_role as Role) || "owner";
  const canManage = can(role, "manage_payouts");

  const { data: balanceData } = useQuery({ queryKey: ["balance"], queryFn: getBalance });
  const balance = balanceData?.data;

  const { data: payoutsData, isLoading } = useQuery({
    queryKey: ["payouts"],
    queryFn: getPayouts,
  });
  const payouts = payoutsData?.data ?? [];

  const { data: banksData } = useQuery({ queryKey: ["banks"], queryFn: getBanks });
  const banks = banksData?.data ?? [];

  const request = useMutation({
    mutationFn: (input: {
      amountKobo: number;
      bankCode: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
    }) =>
      createPayout({
        amount_kobo: input.amountKobo,
        bank_code: input.bankCode,
        bank_name: input.bankName,
        account_number: input.accountNumber,
        account_name: input.accountName,
      }),
    onSuccess: () => {
      setShowRequest(false);
      setError("");
      qc.invalidateQueries({ queryKey: ["payouts"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
    },
    onError: (e: Error) => setError(e.message || "Failed to request payout"),
  });

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-xl lg:text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            Payouts
          </h1>
          <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
            Withdraw your available balance to a Nigerian bank account.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowRequest(true)}
            className="text-sm px-4 py-2.5 rounded-lg font-bold text-white flex-shrink-0"
            style={{ background: "#0F1728" }}
          >
            <i className="ti ti-plus mr-1.5" style={{ fontSize: 14 }} />
            Request payout
          </button>
        )}
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div
          className="rounded-xl p-4 lg:p-5"
          style={{ background: "#E6F8F2", border: "1px solid #B8ECD8" }}
        >
          <p className="text-xs font-bold mb-2" style={{ color: "#0A7A56" }}>
            Available
          </p>
          <p
            className="text-xl lg:text-2xl font-extrabold"
            style={{ color: "#00703C", letterSpacing: "-0.02em" }}
          >
            {balance ? formatKobo(balance.available_kobo) : "..."}
          </p>
          <p className="text-xs font-medium mt-1" style={{ color: "#0A7A56" }}>
            Settled and withdrawable
          </p>
        </div>
        <div
          className="rounded-xl p-4 lg:p-5"
          style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}
        >
          <p className="text-xs font-bold mb-2" style={{ color: "#92400E" }}>
            Pending
          </p>
          <p
            className="text-xl lg:text-2xl font-extrabold"
            style={{ color: "#B45309", letterSpacing: "-0.02em" }}
          >
            {balance ? formatKobo(balance.pending_kobo) : "..."}
          </p>
          <p className="text-xs font-medium mt-1" style={{ color: "#92400E" }}>
            Settling today (T+1)
          </p>
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg px-4 py-3 mb-4 text-sm font-semibold"
          style={{ background: "#FEE2E2", color: "#991B1B" }}
        >
          {error}
        </div>
      )}

      {/* Payout history */}
      <div
        className="bg-white border rounded-xl overflow-hidden"
        style={{ borderColor: "#EAECEF" }}
      >
        {isLoading ? (
          <div className="p-10 text-center text-sm font-medium" style={{ color: "#8A94A6" }}>
            Loading...
          </div>
        ) : payouts.length === 0 ? (
          <div className="p-10 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-building-bank" style={{ fontSize: 22 }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No payouts yet
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr style={{ background: "#F8F9FA", borderBottom: "1px solid #EAECEF" }}>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Amount</th>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Bank</th>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Account</th>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Status</th>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Requested</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p: Payout) => {
                  const badge = statusBadge(p.status);
                  return (
                    <tr key={p.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td className="px-5 py-3.5 font-bold" style={{ color: "#0F1728" }}>
                        {formatKobo(p.amount_kobo)}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: "#4B5563" }}>
                        {p.bank_name}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: "#4B5563" }}>
                        {p.account_name}
                        <span className="block text-xs" style={{ color: "#9CA3AF" }}>
                          {p.account_number}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                          style={{ background: badge.bg, color: badge.color }}
                        >
                          {badge.label}
                        </span>
                        {p.status === "failed" && p.failure_reason && (
                          <span className="block text-[11px] mt-0.5" style={{ color: "#DC2626" }}>
                            {p.failure_reason}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: "#8A94A6" }}>
                        {formatDateTime(p.requested_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showRequest && (
        <RequestPayoutModal
          availableKobo={balance?.available_kobo ?? 0}
          banks={banks}
          onClose={() => setShowRequest(false)}
          onSubmit={(input) => request.mutate(input)}
          submitting={request.isPending}
        />
      )}
    </div>
  );
}

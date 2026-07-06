"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getRecoveryCenter,
  retrySubscriptionNow,
  sendPayLink,
  getMe,
  type RecoveryItem,
} from "@/lib/api";
import { formatKobo, formatDateTime, avatarFor } from "@/lib/utils";
import { can, type Role } from "@/lib/permissions";

function railBadge(rail: string) {
  switch (rail) {
    case "wallet":
      return {
        label: "Wallet",
        bg: "#ECFDF5",
        color: "#047857",
        icon: "ti-wallet",
      };
    case "card":
      return {
        label: "Card",
        bg: "#EEF2FF",
        color: "#4338CA",
        icon: "ti-credit-card",
      };
    case "mandate":
      return {
        label: "Direct debit",
        bg: "#F0FDF4",
        color: "#15803D",
        icon: "ti-building-bank",
      };
    case "manual":
      return {
        label: "Pay link sent",
        bg: "#FEF9C3",
        color: "#854D0E",
        icon: "ti-link",
      };
    default:
      return {
        label: rail || "Card",
        bg: "#F1F3F5",
        color: "#6B7280",
        icon: "ti-credit-card",
      };
  }
}

function RecoveryRow({
  item,
  showActions,
  onRetry,
  onPayLink,
  busyId,
}: {
  item: RecoveryItem;
  showActions: boolean;
  onRetry: (id: string) => void;
  onPayLink: (id: string) => void;
  busyId: string | null;
}) {
  const av = avatarFor(item.customer_email);
  const rail = railBadge(item.recovery_rail);
  const busy = busyId === item.subscription_id;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderTop: "0.5px solid #F2F4F6" }}
    >
      <span
        className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[11px] font-bold flex-shrink-0"
        style={{ background: av.bg, color: av.color }}
      >
        {av.initials}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="text-xs font-semibold truncate"
          style={{ color: "#1F2733" }}
        >
          {item.customer_email}
        </p>
        <p className="text-[11px] font-medium" style={{ color: "#98A2B3" }}>
          {item.plan_name} · {formatKobo(item.amount_kobo)}
        </p>
      </div>

      <span
        className="text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0"
        style={{ background: rail.bg, color: rail.color }}
      >
        <i className={`ti ${rail.icon}`} style={{ fontSize: 11 }} />
        {rail.label}
      </span>

      {item.dunning_attempt > 0 && (
        <span
          className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0"
          style={{ background: "#FEF2F2", color: "#B91C1C" }}
        >
          Attempt {item.dunning_attempt}
        </span>
      )}

      {item.next_retry_at && (
        <span
          className="text-[10px] font-medium hidden md:block flex-shrink-0"
          style={{ color: "#98A2B3" }}
        >
          Next: {formatDateTime(item.next_retry_at)}
        </span>
      )}

      {showActions && (
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={() => onRetry(item.subscription_id)}
            disabled={busy}
            className="text-[11px] px-2.5 py-1 rounded-md font-bold border hover:opacity-75 transition-opacity"
            style={{
              borderColor: "#00B37E",
              color: "#00B37E",
              cursor: "pointer",
            }}
          >
            {busy ? "..." : "Retry now"}
          </button>
          <button
            onClick={() => onPayLink(item.subscription_id)}
            disabled={busy}
            className="text-[11px] px-2.5 py-1 rounded-md font-bold border hover:opacity-75 transition-opacity"
            style={{
              borderColor: "#E5E7EB",
              color: "#6B7280",
              cursor: "pointer",
            }}
          >
            Send pay link
          </button>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  items,
  accent,
  showActions,
  onRetry,
  onPayLink,
  busyId,
  emptyText,
}: {
  title: string;
  subtitle: string;
  items: RecoveryItem[];
  accent: string;
  showActions: boolean;
  onRetry: (id: string) => void;
  onPayLink: (id: string) => void;
  busyId: string | null;
  emptyText: string;
}) {
  return (
    <div
      className="bg-white border rounded-xl mb-4"
      style={{ borderColor: "#EAECEF" }}
    >
      <div
        className="px-4 py-3.5 flex items-center justify-between"
        style={{ borderBottom: "0.5px solid #F0F2F4" }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: accent }}
          />
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
              {title}
            </h2>
            <p className="text-[11px] font-medium" style={{ color: "#98A2B3" }}>
              {subtitle}
            </p>
          </div>
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ background: "#F8F9FA", color: "#6B7280" }}
        >
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-xs font-medium" style={{ color: "#C4CACD" }}>
            {emptyText}
          </p>
        </div>
      ) : (
        items.map((item) => (
          <RecoveryRow
            key={item.subscription_id}
            item={item}
            showActions={showActions}
            onRetry={onRetry}
            onPayLink={onPayLink}
            busyId={busyId}
          />
        ))
      )}
    </div>
  );
}

export default function RecoveryPage() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["recovery-center"],
    queryFn: getRecoveryCenter,
    refetchInterval: 15000, // live — refresh every 15s
  });
  const rc = data?.data;

  const { data: meData } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const role = ((meData?.data?.member_role as Role) || "owner");
  const canManageRecovery = can(role, "manage_recovery");

  const retry = useMutation({
    mutationFn: (id: string) => {
      setBusyId(id);
      return retrySubscriptionNow(id);
    },
    onSettled: () => {
      setBusyId(null);
      qc.invalidateQueries({ queryKey: ["recovery-center"] });
    },
  });

  const payLink = useMutation({
    mutationFn: (id: string) => {
      setBusyId(id);
      return sendPayLink(id);
    },
    onSettled: () => {
      setBusyId(null);
      qc.invalidateQueries({ queryKey: ["recovery-center"] });
    },
  });

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1
          className="text-xl lg:text-2xl font-extrabold"
          style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
        >
          Recovery
        </h1>
        <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
          Every naira at risk, every recovery in progress, live.
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div
          className="bg-white border rounded-xl p-4"
          style={{ borderColor: "#EAECEF" }}
        >
          <p
            className="text-xs font-semibold mb-1"
            style={{ color: "#8A94A6" }}
          >
            At risk
          </p>
          <p
            className="text-2xl font-extrabold"
            style={{ color: "#DC2626", letterSpacing: "-0.02em" }}
          >
            {rc ? formatKobo(rc.at_risk_kobo) : "—"}
          </p>
          <p
            className="text-[11px] font-medium mt-0.5"
            style={{ color: "#98A2B3" }}
          >
            {rc?.at_risk_count ?? 0} at risk · {rc?.recovering_count ?? 0}{" "}
            recovering
          </p>
        </div>
        <div
          className="bg-white border rounded-xl p-4"
          style={{ borderColor: "#EAECEF" }}
        >
          <p
            className="text-xs font-semibold mb-1"
            style={{ color: "#8A94A6" }}
          >
            Recovered
          </p>
          <p
            className="text-2xl font-extrabold"
            style={{ color: "#00B37E", letterSpacing: "-0.02em" }}
          >
            {rc ? formatKobo(rc.recovered_kobo) : "—"}
          </p>
          <p
            className="text-[11px] font-medium mt-0.5"
            style={{ color: "#98A2B3" }}
          >
            {rc?.recovered_count ?? 0} subscriptions brought back
          </p>
        </div>
        <div
          className="bg-white border rounded-xl p-4"
          style={{ borderColor: "#EAECEF" }}
        >
          <p
            className="text-xs font-semibold mb-1"
            style={{ color: "#8A94A6" }}
          >
            Recovery rate
          </p>
          <p
            className="text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            {rc ? `${rc.recovery_rate_pct.toFixed(0)}%` : "—"}
          </p>
          <p
            className="text-[11px] font-medium mt-0.5"
            style={{ color: "#98A2B3" }}
          >
            of at-risk revenue recovered
          </p>
        </div>
      </div>

      {isLoading ? (
        <div
          className="p-12 text-center text-sm font-medium"
          style={{ color: "#8A94A6" }}
        >
          Loading recovery pipeline...
        </div>
      ) : (
        <>
          <Section
            title="At risk"
            subtitle="Payment failed, recovery not yet scheduled"
            items={rc?.at_risk ?? []}
            accent="#DC2626"
            showActions={canManageRecovery}
            onRetry={(id) => retry.mutate(id)}
            onPayLink={(id) => payLink.mutate(id)}
            busyId={busyId}
            emptyText="Nothing at risk. Every subscription is healthy."
          />
          <Section
            title="Recovering"
            subtitle="In the recovery ladder, retry scheduled"
            items={rc?.recovering ?? []}
            accent="#D97706"
            showActions={canManageRecovery}
            onRetry={(id) => retry.mutate(id)}
            onPayLink={(id) => payLink.mutate(id)}
            busyId={busyId}
            emptyText="No active recoveries in progress."
          />
          <Section
            title="Recovered"
            subtitle="Brought back to active after a failed payment"
            items={rc?.recovered ?? []}
            accent="#00B37E"
            showActions={false}
            onRetry={() => {}}
            onPayLink={() => {}}
            busyId={busyId}
            emptyText="No recoveries yet this period."
          />
        </>
      )}
    </div>
  );
}

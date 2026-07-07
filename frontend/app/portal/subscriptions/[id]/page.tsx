"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { formatKobo, formatDate, formatDateTime } from "@/lib/utils";
import {
  portalFetch,
  resolvePortalToken,
  portalHref,
  humanStatusLabel,
  type PortalSubscription,
  type PortalHistoryEntry,
} from "@/lib/portal-api";
import { PortalNav, PortalFooter } from "@/components/portal-nav";

export default function PortalSubscriptionDetailPage() {
  const params = useSearchParams();
  const router = useRouter();
  const routeParams = useParams();
  const subId = routeParams.id as string;

  const [token, setToken] = useState("");
  const [sub, setSub] = useState<PortalSubscription | null>(null);
  const [history, setHistory] = useState<PortalHistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [justUpdatedPayment, setJustUpdatedPayment] = useState(false);

  useEffect(() => {
    const t = resolvePortalToken(params.get("token"));
    if (!t) {
      router.replace("/portal/login");
      return;
    }
    setToken(t);
    setJustUpdatedPayment(params.get("payment_method_updated") === "1");

    Promise.all([
      portalFetch<PortalSubscription>(`/v1/portal/subscriptions/${subId}`, t),
      portalFetch<PortalHistoryEntry[]>(`/v1/portal/subscriptions/${subId}/history`, t),
    ])
      .then(([subRes, historyRes]) => {
        setSub((subRes as { data: PortalSubscription }).data);
        setHistory((historyRes as { data: PortalHistoryEntry[] }).data ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load subscription"));
  }, [params, router, subId]);

  const act = async (action: "cancel" | "pause" | "resume", body?: object) => {
    setBusy(true);
    try {
      await portalFetch(`/v1/portal/subscriptions/${subId}/${action}`, token, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      const res = await portalFetch<PortalSubscription>(`/v1/portal/subscriptions/${subId}`, token);
      setSub((res as { data: PortalSubscription }).data);
      setShowCancelModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const updatePaymentMethod = async () => {
    setBusy(true);
    try {
      const res = await portalFetch<{ checkout_url: string }>(
        `/v1/portal/subscriptions/${subId}/update-payment-method`,
        token,
        { method: "POST" },
      );
      const url = (res as { data: { checkout_url: string } }).data.checkout_url;
      if (url) window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start payment method update");
      setBusy(false);
    }
  };

  if (error && !sub) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FAFAF8" }}>
        <div className="text-sm font-medium" style={{ color: "#DC2626" }}>
          {error}
        </div>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAFAF8" }}>
        <div className="text-sm font-medium" style={{ color: "#8A94A6" }}>
          Loading...
        </div>
      </div>
    );
  }

  const badge = humanStatusLabel(sub.status);
  const canUpdatePayment = sub.status === "ACTIVE" || sub.status === "DUNNING" || sub.status === "PAST_DUE";
  const canPause = sub.status === "ACTIVE" && !sub.cancel_at_period_end;
  const canResume = sub.status === "PAUSED";
  const canCancel = ["ACTIVE", "PAUSED", "TRIALING", "DUNNING", "PAST_DUE"].includes(sub.status) && !sub.cancel_at_period_end;

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      <PortalNav token={token} />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Link
          href={portalHref("/portal/subscriptions", token)}
          className="flex items-center gap-1.5 text-xs font-semibold mb-4"
          style={{ color: "#6B7280" }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 13 }} /> Subscriptions
        </Link>

        {justUpdatedPayment && (
          <div className="rounded-lg px-4 py-3 mb-4 text-sm font-semibold" style={{ background: "#E6F8F2", color: "#0A7A56" }}>
            Payment method updated successfully.
          </div>
        )}
        {error && (
          <div className="rounded-lg px-4 py-3 mb-4 text-sm font-semibold" style={{ background: "#FEE2E2", color: "#991B1B" }}>
            {error}
          </div>
        )}

        {/* Header card */}
        <div className="bg-white border rounded-xl p-5 mb-5" style={{ borderColor: "#EAECEF" }}>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-lg font-extrabold" style={{ color: "#0F1728" }}>
              {sub.plan?.name ?? "Unknown plan"}
            </h1>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
              style={{ background: badge.bg, color: badge.color }}
            >
              {badge.label}
            </span>
          </div>
          <p className="text-sm font-medium mb-4" style={{ color: "#6B7280" }}>
            {sub.plan ? `${formatKobo(sub.plan.amount)}/${sub.plan.interval}` : ""}
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: "#F0F2F4" }}>
            <div>
              <p className="text-[10px] font-semibold mb-0.5" style={{ color: "#8A94A6" }}>
                Current period
              </p>
              <p className="text-xs font-bold" style={{ color: "#0F1728" }}>
                {formatDate(sub.current_period_start)} – {formatDate(sub.current_period_end)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold mb-0.5" style={{ color: "#8A94A6" }}>
                {sub.status === "TRIALING" ? "Trial ends" : "Next renewal"}
              </p>
              <p className="text-xs font-bold" style={{ color: "#0F1728" }}>
                {formatDate(sub.trial_end ?? sub.current_period_end)}
              </p>
            </div>
          </div>

          {sub.cancel_at_period_end && (
            <div className="rounded-lg p-3 mt-4" style={{ background: "#FFF8E1", border: "1px solid #FDE68A" }}>
              <p className="text-xs font-bold" style={{ color: "#0F1728" }}>
                Cancels on {formatDate(sub.current_period_end)}
              </p>
              <p className="text-xs font-medium mt-0.5" style={{ color: "#6B7280" }}>
                You&apos;ll keep access until then.
              </p>
            </div>
          )}

          {(sub.status === "DUNNING" || sub.status === "PAST_DUE") && (
            <div className="rounded-lg p-3 mt-4" style={{ background: "#FFF8E1", border: "1px solid #FDE68A" }}>
              <p className="text-xs font-bold mb-0.5" style={{ color: "#0F1728" }}>
                Payment issue detected
              </p>
              <p className="text-xs font-medium" style={{ color: "#6B7280" }}>
                We had trouble charging your card. Update your payment method to keep your subscription active.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap mt-4 pt-4 border-t" style={{ borderColor: "#F0F2F4" }}>
            {canUpdatePayment && (
              <button
                onClick={updatePaymentMethod}
                disabled={busy}
                className="text-xs px-3.5 py-2 rounded-lg font-bold text-white disabled:opacity-50"
                style={{ background: "#00B37E" }}
              >
                Update payment method
              </button>
            )}
            {canPause && (
              <button
                onClick={() => act("pause")}
                disabled={busy}
                className="text-xs px-3.5 py-2 rounded-lg font-bold border disabled:opacity-50"
                style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
              >
                Pause
              </button>
            )}
            {canResume && (
              <button
                onClick={() => act("resume")}
                disabled={busy}
                className="text-xs px-3.5 py-2 rounded-lg font-bold border disabled:opacity-50"
                style={{ borderColor: "#00B37E", color: "#00B37E" }}
              >
                Resume
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={busy}
                className="text-xs px-3.5 py-2 rounded-lg font-bold border disabled:opacity-50"
                style={{ borderColor: "#FDCACA", color: "#DC2626" }}
              >
                Cancel subscription
              </button>
            )}
          </div>
        </div>

        {/* History timeline */}
        <h2 className="text-sm font-bold mb-3" style={{ color: "#0F1728" }}>
          Payment history
        </h2>
        {history.length === 0 ? (
          <div className="bg-white border rounded-xl p-6 text-center" style={{ borderColor: "#EAECEF" }}>
            <p className="text-xs font-medium" style={{ color: "#8A94A6" }}>
              No events yet
            </p>
          </div>
        ) : (
          <div className="bg-white border rounded-xl p-5" style={{ borderColor: "#EAECEF" }}>
            <div className="space-y-4">
              {history.map((h, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <span className="w-2 h-2 rounded-full mt-1.5" style={{ background: "#00B37E" }} />
                    {i < history.length - 1 && (
                      <span className="w-px flex-1 mt-1" style={{ background: "#E5E7EB" }} />
                    )}
                  </div>
                  <div className="pb-4 min-w-0">
                    <p className="text-xs font-bold" style={{ color: "#0F1728" }}>
                      {h.description}
                    </p>
                    <p className="text-[11px] font-medium mt-0.5" style={{ color: "#8A94A6" }}>
                      {formatDateTime(h.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <PortalFooter />
      </div>

      {/* Cancel modal */}
      {showCancelModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,40,0.5)" }}
        >
          <div className="bg-white rounded-xl max-w-sm w-full p-6">
            <h3 className="text-base font-extrabold mb-1" style={{ color: "#0F1728" }}>
              Cancel subscription?
            </h3>
            <p className="text-xs font-medium mb-4" style={{ color: "#6B7280" }}>
              You&apos;ll keep access until {formatDate(sub.current_period_end)}. This can&apos;t be undone.
            </p>
            <label className="block text-xs font-bold mb-1.5" style={{ color: "#4B5563" }}>
              Why are you cancelling? <span style={{ color: "#9CA3AF", fontWeight: 400 }}>optional</span>
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Tell us why — it helps us improve"
              rows={3}
              className="w-full text-sm px-3 py-2.5 rounded-lg border mb-4 outline-none resize-none"
              style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => act("cancel", cancelReason ? { reason: cancelReason } : undefined)}
                disabled={busy}
                className="flex-1 text-sm px-4 py-2.5 rounded-lg font-bold text-white disabled:opacity-50"
                style={{ background: "#DC2626" }}
              >
                {busy ? "Cancelling..." : "Confirm cancel"}
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-sm px-4 py-2.5 rounded-lg font-bold border"
                style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatKobo, formatDate } from "@/lib/utils";
import {
  portalFetch,
  resolvePortalToken,
  portalHref,
  humanStatusLabel,
  type PortalSubscription,
} from "@/lib/portal-api";
import { PortalNav, PortalFooter } from "@/components/portal-nav";

export default function PortalSubscriptionsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState("");
  const [subs, setSubs] = useState<PortalSubscription[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; action: "cancel" | "pause" | "resume" } | null>(null);

  const load = (t: string) => {
    portalFetch<{ data: PortalSubscription[] }>("/v1/portal/subscriptions", t)
      .then((res) => setSubs(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load subscriptions"));
  };

  useEffect(() => {
    const t = resolvePortalToken(params.get("token"));
    if (!t) {
      router.replace("/portal/login");
      return;
    }
    setToken(t);
    load(t);
  }, [params, router]);

  const act = async (id: string, action: "cancel" | "pause" | "resume") => {
    setBusy(id + action);
    try {
      await portalFetch(`/v1/portal/subscriptions/${id}/${action}`, token, { method: "POST" });
      load(token);
      setConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const updatePaymentMethod = async (id: string) => {
    setBusy(id + "update-payment-method");
    try {
      const res = await portalFetch<{ data: { checkout_url: string } }>(
        `/v1/portal/subscriptions/${id}/update-payment-method`,
        token,
        { method: "POST" },
      );
      const url = res.data.checkout_url;
      if (url) window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start payment method update");
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      <PortalNav token={token} />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-lg font-extrabold mb-5" style={{ color: "#0F1728" }}>
          Your subscriptions
        </h1>

        {error && (
          <div className="rounded-lg px-4 py-3 mb-4 text-sm font-semibold" style={{ background: "#FEE2E2", color: "#991B1B" }}>
            {error}
          </div>
        )}

        {subs === null ? (
          <div className="text-sm font-medium" style={{ color: "#8A94A6" }}>
            Loading...
          </div>
        ) : subs.length === 0 ? (
          <div className="bg-white border rounded-xl p-10 text-center" style={{ borderColor: "#EAECEF" }}>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No subscriptions
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {subs.map((sub) => {
              const badge = humanStatusLabel(sub.status);
              const isBusy = (a: string) => busy === sub.id + a;
              return (
                <div key={sub.id} className="bg-white border rounded-xl p-4 sm:p-5" style={{ borderColor: "#EAECEF" }}>
                  <Link href={portalHref(`/portal/subscriptions/${sub.id}`, token)} className="block mb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-extrabold" style={{ color: "#0F1728" }}>
                            {sub.plan?.name ?? "Unknown plan"}
                          </h3>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-xs font-medium" style={{ color: "#6B7280" }}>
                          {sub.plan ? `${formatKobo(sub.plan.amount)}/${sub.plan.interval}` : ""}
                        </p>
                        {sub.cancel_at_period_end && (
                          <p className="text-[11px] font-semibold mt-1" style={{ color: "#B8860B" }}>
                            Cancels on {formatDate(sub.current_period_end)}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] font-semibold mb-0.5" style={{ color: "#8A94A6" }}>
                          {sub.status === "TRIALING" ? "Trial ends" : "Next renewal"}
                        </p>
                        <p className="text-xs font-bold" style={{ color: "#0F1728" }}>
                          {formatDate(sub.trial_end ?? sub.current_period_end)}
                        </p>
                      </div>
                    </div>
                  </Link>

                  {confirm?.id === sub.id ? (
                    <div className="rounded-lg p-3.5 border" style={{ borderColor: "#E5E7EB", background: "#F8F9FA" }}>
                      <p className="text-xs font-bold mb-1" style={{ color: "#0F1728" }}>
                        {confirm.action === "cancel"
                          ? "Cancel subscription?"
                          : confirm.action === "pause"
                            ? "Pause subscription?"
                            : "Resume subscription?"}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => act(sub.id, confirm.action)}
                          disabled={!!busy}
                          className="text-xs px-3 py-1.5 rounded-lg font-bold text-white"
                          style={{ background: confirm.action === "cancel" ? "#DC2626" : "#0F1728" }}
                        >
                          {isBusy(confirm.action) ? "Processing..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirm(null)}
                          className="text-xs px-3 py-1.5 rounded-lg font-bold border"
                          style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {sub.status === "ACTIVE" && !sub.cancel_at_period_end && (
                        <>
                          <button
                            onClick={() => setConfirm({ id: sub.id, action: "pause" })}
                            className="text-[11px] px-3 py-1.5 rounded-lg font-bold border"
                            style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
                          >
                            Pause
                          </button>
                          <button
                            onClick={() => setConfirm({ id: sub.id, action: "cancel" })}
                            className="text-[11px] px-3 py-1.5 rounded-lg font-bold border"
                            style={{ borderColor: "#FDCACA", color: "#DC2626" }}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {sub.status === "PAUSED" && (
                        <>
                          <button
                            onClick={() => setConfirm({ id: sub.id, action: "resume" })}
                            className="text-[11px] px-3 py-1.5 rounded-lg font-bold border"
                            style={{ borderColor: "#00B37E", color: "#00B37E" }}
                          >
                            Resume
                          </button>
                          <button
                            onClick={() => setConfirm({ id: sub.id, action: "cancel" })}
                            className="text-[11px] px-3 py-1.5 rounded-lg font-bold border"
                            style={{ borderColor: "#FDCACA", color: "#DC2626" }}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {(sub.status === "DUNNING" || sub.status === "PAST_DUE") && (
                        <button
                          onClick={() => updatePaymentMethod(sub.id)}
                          disabled={isBusy("update-payment-method")}
                          className="text-[11px] px-3 py-1.5 rounded-lg font-bold text-white"
                          style={{ background: "#00B37E" }}
                        >
                          {isBusy("update-payment-method") ? "Redirecting..." : "Update payment method"}
                        </button>
                      )}
                      {sub.status === "TRIALING" && (
                        <button
                          onClick={() => setConfirm({ id: sub.id, action: "cancel" })}
                          className="text-[11px] px-3 py-1.5 rounded-lg font-bold border"
                          style={{ borderColor: "#FDCACA", color: "#DC2626" }}
                        >
                          Cancel trial
                        </button>
                      )}
                      {sub.status === "SUSPENDED" && (
                        <p className="text-[11px] font-medium" style={{ color: "#6B7280" }}>
                          Suspended due to payment failure. Contact support to restart.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <PortalFooter />
      </div>
    </div>
  );
}

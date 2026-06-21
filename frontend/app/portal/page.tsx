"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatKobo, formatDate, avatarFor } from "@/lib/utils";
import { StatusPill } from "@/components/status-pill";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Plan {
  id: string;
  name: string;
  amount: number;
  interval: string;
  trial_period_days: number;
}

interface Subscription {
  id: string;
  status: string;
  current_period_end: string;
  dunning_attempt: number;
  plan: Plan | null;
}

interface Customer {
  id: string;
  email: string;
  name?: string;
}

interface PortalData {
  customer: Customer;
  subscriptions: Subscription[];
}

async function portalFetch(
  path: string,
  token: string,
  options: RequestInit = {},
) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${API_BASE}${path}${sep}token=${token}`, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Request failed");
  }
  return res.json();
}

export default function PortalPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    subId: string;
    action: "cancel" | "pause" | "resume";
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing portal token.");
      setLoading(false);
      return;
    }
    portalFetch("/v1/portal", token)
      .then((res) => setData(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const act = async (subId: string, action: "cancel" | "pause" | "resume") => {
    setActing(subId + action);
    try {
      await portalFetch(`/v1/portal/subscriptions/${subId}/${action}`, token, {
        method: "POST",
      });
      const res = await portalFetch("/v1/portal", token);
      setData(res.data);
      setConfirmAction(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#FAFAF8" }}
      >
        <div className="text-sm font-medium" style={{ color: "#8A94A6" }}>
          Loading your billing portal...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#FAFAF8" }}
      >
        <div
          className="bg-white border rounded-xl p-8 max-w-md w-full text-center"
          style={{ borderColor: "#EAECEF" }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "#FDECEC", color: "#DC2626" }}
          >
            <i className="ti ti-lock" style={{ fontSize: 22 }} />
          </div>
          <h1
            className="text-lg font-extrabold mb-2"
            style={{ color: "#0F1728" }}
          >
            Portal link invalid
          </h1>
          <p className="text-sm font-medium" style={{ color: "#6B7280" }}>
            {error ||
              "This portal link has expired or is invalid. Contact support to get a new link."}
          </p>
        </div>
      </div>
    );
  }

  const av = avatarFor(data.customer.email);

  return (
    <div
      className="min-h-screen"
      style={{ background: "#FAFAF8", fontFamily: "'Satoshi', sans-serif" }}
    >
      <link
        rel="stylesheet"
        href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800&display=swap"
      />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.0.0/dist/tabler-icons.min.css"
      />

      {/* Header */}
      <div className="border-b bg-white" style={{ borderColor: "#EAECEF" }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ background: "#0F1728" }}
          >
            <svg viewBox="0 0 14 14" className="w-4 h-4">
              <path
                d="M7 1L11.5 3.75V8.25L7 11L2.5 8.25V3.75L7 1Z"
                fill="#00B37E"
              />
            </svg>
          </div>
          <span className="text-lg font-extrabold" style={{ color: "#0F1728" }}>
            Tori
          </span>
          <span
            className="text-sm font-medium ml-auto"
            style={{ color: "#8A94A6" }}
          >
            Billing portal
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Customer info */}
        <div
          className="bg-white border rounded-xl p-5 mb-5 flex items-center gap-4"
          style={{ borderColor: "#EAECEF" }}
        >
          <span
            className="w-12 h-12 rounded-full inline-flex items-center justify-center text-base font-extrabold flex-shrink-0"
            style={{ background: av.bg, color: av.color }}
          >
            {av.initials}
          </span>
          <div>
            <p
              className="text-base font-extrabold"
              style={{ color: "#0F1728" }}
            >
              {data.customer.name ?? data.customer.email}
            </p>
            <p className="text-sm font-medium" style={{ color: "#8A94A6" }}>
              {data.customer.email}
            </p>
          </div>
        </div>

        {/* Subscriptions */}
        <h2 className="text-sm font-bold mb-3" style={{ color: "#0F1728" }}>
          Your subscriptions
        </h2>

        {data.subscriptions.length === 0 ? (
          <div
            className="bg-white border rounded-xl p-10 text-center"
            style={{ borderColor: "#EAECEF" }}
          >
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No active subscriptions
            </p>
            <p
              className="text-xs font-medium mt-1"
              style={{ color: "#8A94A6" }}
            >
              Contact support if you believe this is an error.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="bg-white border rounded-xl p-5"
                style={{ borderColor: "#EAECEF" }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3
                        className="text-base font-extrabold"
                        style={{ color: "#0F1728" }}
                      >
                        {sub.plan?.name ?? "Unknown plan"}
                      </h3>
                      <StatusPill status={sub.status} />
                    </div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: "#6B7280" }}
                    >
                      {sub.plan
                        ? `${formatKobo(sub.plan.amount)}/${sub.plan.interval}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-xs font-semibold mb-0.5"
                      style={{ color: "#8A94A6" }}
                    >
                      Next billing date
                    </p>
                    <p
                      className="text-sm font-bold"
                      style={{ color: "#0F1728" }}
                    >
                      {formatDate(sub.current_period_end)}
                    </p>
                  </div>
                </div>

                {sub.dunning_attempt > 0 && (
                  <div
                    className="rounded-lg p-3 mb-4"
                    style={{
                      background: "#FFF8E1",
                      border: "1px solid #FDE68A",
                    }}
                  >
                    <p
                      className="text-xs font-bold mb-0.5"
                      style={{ color: "#0F1728" }}
                    >
                      Payment issue detected
                    </p>
                    <p
                      className="text-xs font-medium"
                      style={{ color: "#6B7280" }}
                    >
                      We had trouble charging your card. We are retrying
                      automatically. Please ensure your card details are up to
                      date.
                    </p>
                  </div>
                )}

                {/* Confirm action dialog */}
                {confirmAction?.subId === sub.id ? (
                  <div
                    className="rounded-lg p-4 border"
                    style={{ borderColor: "#E5E7EB", background: "#F8F9FA" }}
                  >
                    <p
                      className="text-sm font-bold mb-1"
                      style={{ color: "#0F1728" }}
                    >
                      {confirmAction.action === "cancel"
                        ? "Cancel subscription?"
                        : confirmAction.action === "pause"
                          ? "Pause subscription?"
                          : "Resume subscription?"}
                    </p>
                    <p
                      className="text-xs font-medium mb-3"
                      style={{ color: "#6B7280" }}
                    >
                      {confirmAction.action === "cancel"
                        ? "Your access will end immediately and this cannot be undone."
                        : confirmAction.action === "pause"
                          ? "Billing will stop but your data is preserved. You can resume anytime."
                          : "Billing will resume from your next cycle."}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => act(sub.id, confirmAction.action)}
                        disabled={!!acting}
                        className="text-sm px-4 py-2 rounded-lg font-bold text-white"
                        style={{
                          background:
                            confirmAction.action === "cancel"
                              ? "#DC2626"
                              : "#0F1728",
                        }}
                      >
                        {acting === sub.id + confirmAction.action
                          ? "Processing..."
                          : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmAction(null)}
                        className="text-sm px-4 py-2 rounded-lg font-bold border"
                        style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {sub.status === "ACTIVE" && (
                      <>
                        <button
                          onClick={() =>
                            setConfirmAction({ subId: sub.id, action: "pause" })
                          }
                          className="text-sm px-4 py-2 rounded-lg font-bold border"
                          style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
                        >
                          Pause subscription
                        </button>
                        <button
                          onClick={() =>
                            setConfirmAction({
                              subId: sub.id,
                              action: "cancel",
                            })
                          }
                          className="text-sm px-4 py-2 rounded-lg font-bold border"
                          style={{ borderColor: "#FDCACA", color: "#DC2626" }}
                        >
                          Cancel subscription
                        </button>
                      </>
                    )}
                    {sub.status === "PAUSED" && (
                      <>
                        <button
                          onClick={() =>
                            setConfirmAction({
                              subId: sub.id,
                              action: "resume",
                            })
                          }
                          className="text-sm px-4 py-2 rounded-lg font-bold border"
                          style={{ borderColor: "#00B37E", color: "#00B37E" }}
                        >
                          Resume subscription
                        </button>
                        <button
                          onClick={() =>
                            setConfirmAction({
                              subId: sub.id,
                              action: "cancel",
                            })
                          }
                          className="text-sm px-4 py-2 rounded-lg font-bold border"
                          style={{ borderColor: "#FDCACA", color: "#DC2626" }}
                        >
                          Cancel subscription
                        </button>
                      </>
                    )}
                    {sub.status === "DUNNING" && (
                      <button
                        onClick={() =>
                          setConfirmAction({ subId: sub.id, action: "cancel" })
                        }
                        className="text-sm px-4 py-2 rounded-lg font-bold border"
                        style={{ borderColor: "#FDCACA", color: "#DC2626" }}
                      >
                        Cancel subscription
                      </button>
                    )}
                    {sub.status === "SUSPENDED" && (
                      <div
                        className="text-xs font-medium"
                        style={{ color: "#6B7280" }}
                      >
                        This subscription is suspended due to payment failure.
                        Contact support to restart.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p
          className="text-xs font-medium text-center mt-8"
          style={{ color: "#C4CACD" }}
        >
          Powered by Tori · Secure billing portal
        </p>
      </div>
    </div>
  );
}

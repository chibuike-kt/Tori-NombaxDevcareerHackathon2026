"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatKobo, formatDate, avatarFor } from "@/lib/utils";
import {
  portalFetch,
  resolvePortalToken,
  portalHref,
  humanStatusLabel,
  type PortalOverview,
} from "@/lib/portal-api";
import { PortalNav, PortalFooter } from "@/components/portal-nav";

export default function PortalPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState("");
  const [data, setData] = useState<PortalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = resolvePortalToken(params.get("token"));
    if (!t) {
      router.replace("/portal/login");
      return;
    }
    setToken(t);
    portalFetch<PortalOverview>("/v1/portal", t)
      .then((res) => setData((res as { data: PortalOverview }).data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load portal"))
      .finally(() => setLoading(false));
  }, [params, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAFAF8" }}>
        <div className="text-sm font-medium" style={{ color: "#8A94A6" }}>
          Loading your billing portal...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FAFAF8" }}>
        <div className="bg-white border rounded-xl p-8 max-w-md w-full text-center" style={{ borderColor: "#EAECEF" }}>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "#FDECEC", color: "#DC2626" }}
          >
            <i className="ti ti-lock" style={{ fontSize: 22 }} />
          </div>
          <h1 className="text-lg font-extrabold mb-2" style={{ color: "#0F1728" }}>
            Portal link invalid
          </h1>
          <p className="text-sm font-medium mb-4" style={{ color: "#6B7280" }}>
            {error || "This portal link has expired or is invalid."}
          </p>
          <Link
            href="/portal/login"
            className="inline-block text-sm px-4 py-2.5 rounded-lg font-bold text-white"
            style={{ background: "#0F1728" }}
          >
            Sign in again
          </Link>
        </div>
      </div>
    );
  }

  const av = avatarFor(data.customer.email ?? data.customer.id);

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      <PortalNav token={token} merchantName={data.merchant_name} />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Customer info */}
        <div
          className="bg-white border rounded-xl p-4 sm:p-5 mb-5 flex items-center gap-4"
          style={{ borderColor: "#EAECEF" }}
        >
          <span
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full inline-flex items-center justify-center text-base font-extrabold flex-shrink-0"
            style={{ background: av.bg, color: av.color }}
          >
            {av.initials}
          </span>
          <div className="min-w-0">
            <p className="text-base font-extrabold truncate" style={{ color: "#0F1728" }}>
              {data.customer.name ?? data.customer.email}
            </p>
            <p className="text-sm font-medium truncate" style={{ color: "#8A94A6" }}>
              {data.customer.email}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link
            href={portalHref("/portal/subscriptions", token)}
            className="bg-white border rounded-xl p-4 flex items-center gap-3"
            style={{ borderColor: "#EAECEF" }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#E6F8F2", color: "#00B37E" }}
            >
              <i className="ti ti-refresh" style={{ fontSize: 18 }} />
            </div>
            <span className="text-xs font-bold" style={{ color: "#0F1728" }}>
              Manage subscription
            </span>
          </Link>
          <Link
            href={portalHref("/portal/invoices", token)}
            className="bg-white border rounded-xl p-4 flex items-center gap-3"
            style={{ borderColor: "#EAECEF" }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#EEF2FF", color: "#4338CA" }}
            >
              <i className="ti ti-receipt" style={{ fontSize: 18 }} />
            </div>
            <span className="text-xs font-bold" style={{ color: "#0F1728" }}>
              View all invoices
            </span>
          </Link>
        </div>

        {/* Subscriptions summary */}
        <h2 className="text-sm font-bold mb-3" style={{ color: "#0F1728" }}>
          Your subscriptions
        </h2>

        {data.subscriptions.length === 0 ? (
          <div className="bg-white border rounded-xl p-8 text-center mb-6" style={{ borderColor: "#EAECEF" }}>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No active subscriptions
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {data.subscriptions.map((sub) => {
              const badge = humanStatusLabel(sub.status);
              return (
                <Link
                  key={sub.id}
                  href={portalHref(`/portal/subscriptions/${sub.id}`, token)}
                  className="block bg-white border rounded-xl p-4 sm:p-5"
                  style={{ borderColor: "#EAECEF" }}
                >
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
              );
            })}
          </div>
        )}

        {/* Recent invoices */}
        <h2 className="text-sm font-bold mb-3" style={{ color: "#0F1728" }}>
          Recent invoices
        </h2>
        {data.recent_invoices.length === 0 ? (
          <div className="bg-white border rounded-xl p-8 text-center" style={{ borderColor: "#EAECEF" }}>
            <p className="text-sm font-medium" style={{ color: "#8A94A6" }}>
              No invoices yet
            </p>
          </div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: "#EAECEF" }}>
            {data.recent_invoices.map((inv, i) => (
              <div
                key={inv.id}
                className="flex items-center justify-between px-4 sm:px-5 py-3.5"
                style={{ borderTop: i > 0 ? "1px solid #F3F4F6" : undefined }}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold" style={{ color: "#0F1728" }}>
                    {inv.plan_name ?? "Subscription"}
                  </p>
                  <p className="text-[11px] font-medium" style={{ color: "#8A94A6" }}>
                    {formatDate(inv.created_at)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold" style={{ color: "#0F1728" }}>
                    {formatKobo(inv.amount)}
                  </p>
                  <p className="text-[11px] font-semibold uppercase" style={{ color: inv.status === "paid" ? "#0A7A56" : "#92400E" }}>
                    {inv.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <PortalFooter />
      </div>
    </div>
  );
}

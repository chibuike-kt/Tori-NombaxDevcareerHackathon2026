"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const NOMBA_CHECKOUT_BASE = "https://pay.nomba.com/checkout";

function CheckoutContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const merchant = searchParams.get("merchant") || "this merchant";
  const plan = searchParams.get("plan") || "your subscription";
  const amount = searchParams.get("amount");

  // The exact Nomba checkout URL is passed through in full, since its base
  // path varies by environment (production vs. sandbox) — fall back to a
  // guessed reconstruction only if it's missing.
  const nombaUrlParam = searchParams.get("nomba_url");
  const nombaCheckoutUrl = nombaUrlParam || `${NOMBA_CHECKOUT_BASE}/${token}`;

  return (
    <div className="min-h-screen" style={{ background: "#F8F9FA" }}>
      <div className="max-w-2xl mx-auto px-4 py-8 lg:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo-light.svg" alt="Tori" className="h-8 w-auto mx-auto mb-4" />
          <p className="text-sm font-semibold" style={{ color: "#8A94A6" }}>
            Secure checkout powered by Tori × Nomba
          </p>
        </div>

        {/* Order summary */}
        <div
          className="bg-white rounded-2xl border p-6 mb-6"
          style={{ borderColor: "#EAECEF" }}
        >
          <div
            className="flex items-start justify-between gap-4 flex-wrap mb-4 pb-4 border-b"
            style={{ borderColor: "#F0F2F4" }}
          >
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "#8A94A6" }}>
                You&apos;re subscribing to
              </p>
              <h1 className="text-xl font-extrabold" style={{ color: "#0F1728" }}>
                {plan}
              </h1>
              <p className="text-sm font-medium mt-0.5" style={{ color: "#6B7280" }}>
                from {merchant}
              </p>
            </div>
            {amount && (
              <div className="text-right">
                <p className="text-xs font-semibold mb-1" style={{ color: "#8A94A6" }}>
                  Amount due
                </p>
                <p className="text-2xl font-extrabold" style={{ color: "#00B37E" }}>
                  ₦
                  {Number(amount).toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            )}
          </div>

          <ul className="space-y-2.5">
            {[
              "Instant activation — access starts the moment payment clears",
              "Your card is securely tokenised by Nomba for future renewals",
              "Cancel or manage your subscription anytime from the customer portal",
            ].map((item) => (
              <li
                key={item}
                className="flex gap-2.5 text-sm"
                style={{ color: "#4B5563" }}
              >
                <i
                  className="ti ti-check flex-shrink-0"
                  style={{ fontSize: 16, color: "#00B37E", marginTop: 2 }}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Embedded Nomba checkout — card data never touches Tori */}
        <div
          className="bg-white rounded-2xl border overflow-hidden"
          style={{ borderColor: "#EAECEF" }}
        >
          <div
            className="px-5 py-3 border-b flex items-center gap-2"
            style={{ borderColor: "#F0F2F4", background: "#F8F9FA" }}
          >
            <i className="ti ti-lock" style={{ fontSize: 14, color: "#6B7280" }} />
            <span className="text-xs font-bold" style={{ color: "#6B7280" }}>
              Payment details — secured by Nomba
            </span>
          </div>
          <iframe
            src={nombaCheckoutUrl}
            width="100%"
            height="600px"
            style={{ border: "none", display: "block" }}
            title="Nomba secure checkout"
          />
        </div>

        <p
          className="text-center text-xs font-medium mt-6 px-4"
          style={{ color: "#9CA3AF" }}
        >
          Your card details are entered directly with Nomba — {merchant} and
          Tori never see or store your card number.
        </p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutContent />
    </Suspense>
  );
}

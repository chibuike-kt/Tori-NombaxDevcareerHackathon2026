"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function SuccessContent() {
  const params = useSearchParams();
  const sub = params.get("sub");

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#F8F9FA" }}
    >
      <div
        className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-sm border"
        style={{ borderColor: "#EAECEF" }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "#E3F7EF" }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path
              d="M6 16L13 23L26 9"
              stroke="#00B37E"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1
          className="text-2xl font-extrabold mb-2"
          style={{ color: "#0F1728" }}
        >
          Payment successful
        </h1>
        <p className="text-sm font-medium mb-6" style={{ color: "#6B7280" }}>
          Your subscription is now active. You can manage it anytime from the
          customer portal.
        </p>
        {sub && (
          <p
            className="text-xs font-mono mb-6 px-3 py-2 rounded-lg"
            style={{ background: "#F1F3F5", color: "#6B7280" }}
          >
            Subscription ID: {sub}
          </p>
        )}
        <Link
          href={`/portal`}
          className="block w-full py-3 rounded-lg font-bold text-white text-sm"
          style={{ background: "#00B37E" }}
        >
          Manage my subscription
        </Link>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function PayLinkPage() {
  const params = useParams();
  const id = params.id as string;

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pay = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/payment-links/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message || "This payment link is unavailable.");
      }
      const toriCheckoutUrl = body?.data?.tori_checkout_url;
      const checkoutUrl = body?.data?.checkout_url;
      window.location.href = toriCheckoutUrl || checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "This payment link is unavailable.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#F8F9FA" }}>
      <div
        className="bg-white rounded-2xl border max-w-md w-full p-6 lg:p-8"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="text-center mb-6">
          <img src="/logo-light.svg" alt="Tori" className="h-8 w-auto mx-auto mb-4" />
          <p className="text-sm font-semibold" style={{ color: "#8A94A6" }}>
            Secure payment powered by Tori × Nomba
          </p>
        </div>

        <label className="block text-xs font-bold mb-1.5" style={{ color: "#4B5563" }}>
          Email (optional)
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full text-sm px-3 py-2.5 rounded-lg border mb-4 outline-none"
          style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
        />

        {error && (
          <div
            className="rounded-lg px-4 py-3 mb-4 text-sm font-semibold"
            style={{ background: "#FEE2E2", color: "#991B1B" }}
          >
            {error}
          </div>
        )}

        <button
          onClick={pay}
          disabled={loading}
          className="w-full text-sm px-4 py-3 rounded-lg font-bold text-white disabled:opacity-50"
          style={{ background: "#0F1728" }}
        >
          {loading ? "Preparing checkout..." : "Continue to payment"}
        </button>

        <p className="text-center text-xs font-medium mt-5 px-2" style={{ color: "#9CA3AF" }}>
          You&apos;ll be redirected to a secure checkout page to enter your card details.
        </p>
      </div>
    </div>
  );
}

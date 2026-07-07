"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function PortalLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const requestCode = async () => {
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/portal/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Something went wrong");
      setMessage(json.data?.message ?? "If this email is associated with a subscription, a code has been sent.");
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/portal/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Invalid code");
      const token = json.data?.token;
      if (!token) throw new Error("No token returned");
      router.push(`/portal?token=${encodeURIComponent(token)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to verify code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FAFAF8" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3"
            style={{ background: "#0F1728" }}
          >
            <svg viewBox="0 0 14 14" className="w-5 h-5">
              <path d="M7 1L11.5 3.75V8.25L7 11L2.5 8.25V3.75L7 1Z" fill="#00B37E" />
            </svg>
          </div>
          <h1 className="text-lg font-extrabold" style={{ color: "#0F1728" }}>
            Billing portal
          </h1>
          <p className="text-sm font-medium mt-1" style={{ color: "#8A94A6" }}>
            {step === "email"
              ? "Enter your email to get a login code"
              : "Enter the 6-digit code we emailed you"}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-6" style={{ borderColor: "#EAECEF" }}>
          {step === "email" ? (
            <>
              <label className="block text-xs font-bold mb-1.5" style={{ color: "#4B5563" }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && requestCode()}
                placeholder="you@example.com"
                autoFocus
                className="w-full text-sm px-3.5 py-2.5 rounded-lg border mb-4 outline-none"
                style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
              />
              {error && (
                <p className="text-xs font-semibold mb-3" style={{ color: "#DC2626" }}>
                  {error}
                </p>
              )}
              <button
                onClick={requestCode}
                disabled={!email || loading}
                className="w-full text-sm px-4 py-3 rounded-lg font-bold text-white disabled:opacity-50"
                style={{ background: "#00B37E" }}
              >
                {loading ? "Sending..." : "Send login code"}
              </button>
            </>
          ) : (
            <>
              {message && (
                <p className="text-xs font-medium mb-4" style={{ color: "#6B7280" }}>
                  {message}
                </p>
              )}
              <label className="block text-xs font-bold mb-1.5" style={{ color: "#4B5563" }}>
                6-digit code
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                placeholder="000000"
                autoFocus
                className="w-full text-center text-2xl font-mono tracking-[0.5em] px-3.5 py-3 rounded-lg border mb-4 outline-none"
                style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
              />
              {error && (
                <p className="text-xs font-semibold mb-3" style={{ color: "#DC2626" }}>
                  {error}
                </p>
              )}
              <button
                onClick={verifyCode}
                disabled={code.length !== 6 || loading}
                className="w-full text-sm px-4 py-3 rounded-lg font-bold text-white disabled:opacity-50 mb-2"
                style={{ background: "#0F1728" }}
              >
                {loading ? "Verifying..." : "Continue"}
              </button>
              <button
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                }}
                className="w-full text-xs font-semibold py-2"
                style={{ color: "#8A94A6" }}
              >
                Use a different email
              </button>
            </>
          )}
        </div>

        <p className="text-xs font-medium text-center mt-6" style={{ color: "#C4CACD" }}>
          Powered by Tori · Secure billing portal
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { AuthNav } from "@/components/auth-nav";
import { AuthFooter } from "@/components/auth-footer";
import { LiveChat } from "@/components/live-chat";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const handleSignup = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{
        data: { access_token: string; refresh_token: string; api_key: string };
      }>("/v1/auth/register", { name, email, password });
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      setApiKey(res.data.api_key);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  if (apiKey) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "#fff" }}
      >
        <AuthNav showClose />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-md text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "#E6F8F2", color: "#00B37E" }}
            >
              <i className="ti ti-check" style={{ fontSize: 28 }} />
            </div>
            <h1
              className="text-3xl font-extrabold mb-2"
              style={{ color: "#0F1728" }}
            >
              You&apos;re all set
            </h1>
            <p
              className="text-sm mb-6 font-medium"
              style={{ color: "#6B7280" }}
            >
              Save your API key now — it won&apos;t be shown again.
            </p>
            <div
              className="rounded-lg p-4 mb-6 flex items-center justify-between gap-3"
              style={{ background: "#F8F9FA", border: "1px solid #E5E7EB" }}
            >
              <code
                className="text-xs font-mono break-all text-left"
                style={{ color: "#0F1728" }}
              >
                {apiKey}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(apiKey)}
                className="text-xs px-3 py-1.5 rounded font-bold text-white flex-shrink-0"
                style={{ background: "#00B37E" }}
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full py-3.5 rounded-lg font-bold text-white"
              style={{ background: "#0F1728" }}
            >
              Go to dashboard →
            </button>
          </div>
        </div>
        <AuthFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#fff" }}>
      <AuthNav showClose />
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-full border-4 flex items-center justify-center"
              style={{
                borderColor: "#00B37E",
                borderRightColor: "#E5E7EB",
                borderBottomColor: "#E5E7EB",
              }}
            >
              <div className="text-center">
                <div
                  className="text-[9px] font-medium"
                  style={{ color: "#9CA3AF" }}
                >
                  STEP
                </div>
                <div
                  className="text-sm font-extrabold"
                  style={{ color: "#0F1728" }}
                >
                  1/1
                </div>
              </div>
            </div>
          </div>

          <h1
            className="text-3xl font-extrabold text-center mb-2"
            style={{ color: "#0F1728" }}
          >
            Create a business account
          </h1>
          <p
            className="text-sm text-center mb-8 font-medium"
            style={{ color: "#6B7280" }}
          >
            You&apos;re about to open a{" "}
            <strong style={{ color: "#0F1728" }}>Tori account</strong>. Enter
            your business details to get started.
          </p>

          <div className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Business name"
              className="w-full rounded-lg px-4 py-3.5 text-sm outline-none font-medium"
              style={{ background: "#F8F9FA", color: "#0F1728" }}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-lg px-4 py-3.5 text-sm outline-none font-medium"
              style={{ background: "#F8F9FA", color: "#0F1728" }}
            />
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                placeholder="Password"
                className="w-full rounded-lg px-4 py-3.5 text-sm outline-none font-medium pr-16"
                style={{ background: "#F8F9FA", color: "#0F1728" }}
              />
              <button
                onClick={() => setShowPw(!showPw)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold"
                style={{ color: "#6B7280" }}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>

            {error && (
              <p className="text-sm font-medium" style={{ color: "#DC2626" }}>
                {error}
              </p>
            )}

            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full py-3.5 rounded-lg font-bold"
              style={{
                background: loading ? "#E5E7EB" : "#00B37E",
                color: loading ? "#9CA3AF" : "white",
              }}
            >
              {loading ? "Creating account..." : "Continue"}
            </button>
          </div>

          <p
            className="text-sm mt-6 text-center font-medium"
            style={{ color: "#6B7280" }}
          >
            Already have an account?{" "}
            <Link href="/login" style={{ color: "#00B37E", fontWeight: 600 }}>
              Login
            </Link>
          </p>
        </div>
      </div>
      <AuthFooter />
      <LiveChat />
    </div>
  );
}

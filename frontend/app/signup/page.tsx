"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { AuthNav } from "@/components/auth-nav";
import { AuthFooter } from "@/components/auth-footer";
import { LiveChat } from "@/components/live-chat";

export default function SignupPage() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) router.replace("/dashboard");
  }, [router]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{
        data: { access_token: string; refresh_token: string };
      }>("/v1/auth/register", { name, email, password });
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

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
              {loading ? "Creating account..." : "Create account"}
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

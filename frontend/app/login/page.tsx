"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/api";
import { AuthNav } from "@/components/auth-nav";
import { AuthFooter } from "@/components/auth-footer";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await login(email, password);
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#fff" }}>
      <AuthNav
        rightText="Don't have an account?"
        rightLink="/signup"
        rightLabel="Sign up"
      />
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1
            className="text-4xl font-extrabold text-center mb-2"
            style={{ color: "#0F1728" }}
          >
            Welcome
          </h1>
          <p
            className="text-sm text-center mb-8 font-medium"
            style={{ color: "#6B7280" }}
          >
            Login to your{" "}
            <strong style={{ color: "#0F1728" }}>business account</strong>.
            Please enter your details below.
          </p>

          <div className="space-y-4">
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
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
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

            <p className="text-sm font-medium" style={{ color: "#6B7280" }}>
              Forgot Password?{" "}
              <span
                style={{ color: "#00B37E", fontWeight: 600, cursor: "pointer" }}
              >
                Reset it
              </span>
            </p>

            {error && (
              <p className="text-sm font-medium" style={{ color: "#DC2626" }}>
                {error}
              </p>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3.5 rounded-lg font-bold"
              style={{
                background: loading ? "#E5E7EB" : "#00B37E",
                color: loading ? "#9CA3AF" : "white",
              }}
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </div>
        </div>
      </div>
      <AuthFooter />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--background-secondary)" }}
    >
      <div
        className="w-full max-w-sm rounded-xl border p-8"
        style={{
          borderColor: "var(--border)",
          background: "var(--background)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div className="mb-8">
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: "var(--heading)" }}
          >
            Tori
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Subscriptions engine · Powered by Nomba
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label
              className="text-sm font-medium block mb-1.5"
              style={{ color: "var(--body)" }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="dev@tori.ng"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--border)", color: "var(--body)" }}
            />
          </div>
          <div>
            <label
              className="text-sm font-medium block mb-1.5"
              style={{ color: "var(--body)" }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--body)" }}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white mt-2"
            style={{
              background: loading ? "var(--neutral)" : "var(--primary)",
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>

        <p
          className="text-xs mt-6 text-center"
          style={{ color: "var(--muted)" }}
        >
          Nomba × DevCareer Hackathon 2026
        </p>
      </div>
    </div>
  );
}

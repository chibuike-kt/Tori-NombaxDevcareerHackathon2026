"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { acceptInvite } from "@/lib/api";
import { AuthNav } from "@/components/auth-nav";
import { AuthFooter } from "@/components/auth-footer";

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleAccept = async () => {
    setError("");
    if (!token) {
      setError("This invitation link is missing its token");
      return;
    }
    if (!name.trim()) {
      setError("Your name is required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await acceptInvite(token, name, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to accept invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#fff" }}>
      <AuthNav rightText="Already have an account?" rightLink="/login" rightLabel="Login" />
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1
            className="text-3xl font-extrabold text-center mb-2"
            style={{ color: "#0F1728" }}
          >
            Join your team on Tori
          </h1>
          <p
            className="text-sm text-center mb-8 font-medium"
            style={{ color: "#6B7280" }}
          >
            Set your name and password to accept the invitation.
          </p>

          {done ? (
            <p
              className="text-sm text-center font-medium"
              style={{ color: "#00B37E" }}
            >
              Invitation accepted. Redirecting to login...
            </p>
          ) : (
            <div className="space-y-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-lg px-4 py-3.5 text-sm outline-none font-medium"
                style={{ background: "#F8F9FA", color: "#0F1728" }}
              />
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAccept()}
                  placeholder="Password (min. 8 characters)"
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
                onClick={handleAccept}
                disabled={loading}
                className="w-full py-3.5 rounded-lg font-bold"
                style={{
                  background: loading ? "#E5E7EB" : "#00B37E",
                  color: loading ? "#9CA3AF" : "white",
                }}
              >
                {loading ? "Joining..." : "Accept invitation"}
              </button>
            </div>
          )}
        </div>
      </div>
      <AuthFooter />
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}

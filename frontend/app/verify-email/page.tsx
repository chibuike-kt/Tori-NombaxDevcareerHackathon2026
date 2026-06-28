"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AuthNav } from "@/components/auth-nav";
import { AuthFooter } from "@/components/auth-footer";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [email] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("pending_email") || "";
  });
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/signup");
      return;
    }

    const emailVerified = localStorage.getItem("email_verified");
    if (emailVerified === "true") {
      router.replace("/dashboard");
      return;
    }

    // Focus first input
    inputs.current[0]?.focus();
  }, [router]);

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError("");

    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    if (value && index === 5) {
      const fullCode = newCode.join("");
      if (fullCode.length === 6) handleVerify(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      const fullCode = code.join("");
      if (fullCode.length === 6) handleVerify(fullCode);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      handleVerify(pasted);
    }
  };

  const handleVerify = async (fullCode?: string) => {
    const codeToVerify = fullCode || code.join("");
    if (codeToVerify.length !== 6) {
      setError("Enter the 6-digit code from your email");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.post("/v1/auth/verify-email", { code: codeToVerify });
      localStorage.setItem("email_verified", "true");
      localStorage.removeItem("pending_email");
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid or expired code");
      setCode(["", "", "", "", "", ""]);
      setTimeout(() => inputs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    setError("");

    try {
      await api.post("/v1/auth/resend-verification", {});
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  const maskedEmail = email
    ? email.replace(
        /(.{2})(.*)(@.*)/,
        (_: string, a: string, b: string, c: string) =>
          a + b.replace(/./g, "*") + c,
      )
    : "your email";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#fff" }}>
      <AuthNav showClose />
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Step indicator */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: "#E6F8F2", color: "#00B37E" }}
                >
                  ✓
                </div>
                <span
                  className="text-xs font-semibold"
                  style={{ color: "#9CA3AF" }}
                >
                  Account details
                </span>
              </div>
              <div className="w-8 h-px" style={{ background: "#00B37E" }} />
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: "#00B37E" }}
                >
                  2
                </div>
                <span
                  className="text-xs font-semibold"
                  style={{ color: "#0F1728" }}
                >
                  Verify email
                </span>
              </div>
            </div>
          </div>

          {/* Email icon */}
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "#E6F8F2" }}
            >
              <i
                className="ti ti-mail"
                style={{ fontSize: 28, color: "#00B37E" }}
              />
            </div>
          </div>

          <h1
            className="text-3xl font-extrabold text-center mb-2"
            style={{ color: "#0F1728" }}
          >
            Check your email
          </h1>
          <p
            className="text-sm text-center mb-8 font-medium"
            style={{ color: "#6B7280" }}
          >
            We sent a 6-digit verification code to{" "}
            <strong style={{ color: "#0F1728" }}>{maskedEmail}</strong>. Enter
            it below to verify your account.
          </p>

          {/* OTP inputs */}
          <div className="flex gap-3 justify-center mb-6">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className="w-12 h-14 rounded-xl text-center text-xl font-bold outline-none transition-all"
                style={{
                  background: "#F8F9FA",
                  color: "#0F1728",
                  border: error
                    ? "2px solid #DC2626"
                    : digit
                      ? "2px solid #00B37E"
                      : "2px solid #E5E7EB",
                }}
                disabled={loading}
              />
            ))}
          </div>

          {error && (
            <p
              className="text-sm font-medium text-center mb-4"
              style={{ color: "#DC2626" }}
            >
              {error}
            </p>
          )}

          <button
            onClick={() => handleVerify()}
            disabled={loading || code.join("").length !== 6}
            className="w-full py-3.5 rounded-lg font-bold mb-4"
            style={{
              background:
                loading || code.join("").length !== 6 ? "#E5E7EB" : "#00B37E",
              color:
                loading || code.join("").length !== 6 ? "#9CA3AF" : "white",
            }}
          >
            {loading ? "Verifying..." : "Verify email"}
          </button>

          <p
            className="text-sm text-center font-medium"
            style={{ color: "#6B7280" }}
          >
            Didn&apos;t receive the code?{" "}
            <button
              onClick={handleResend}
              disabled={resending || resendCooldown > 0}
              className="font-semibold"
              style={{
                color: resendCooldown > 0 ? "#9CA3AF" : "#00B37E",
                cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
              }}
            >
              {resending
                ? "Sending..."
                : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : "Resend code"}
            </button>
          </p>

          <p className="text-xs text-center mt-6" style={{ color: "#9CA3AF" }}>
            Code expires in 15 minutes. Check your spam folder if you don&apos;t
            see it.
          </p>
        </div>
      </div>
      <AuthFooter />
    </div>
  );
}

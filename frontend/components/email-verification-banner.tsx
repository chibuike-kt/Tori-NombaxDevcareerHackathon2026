"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

// Reads localStorage at component init time on the client only.
// This component is not rendered on the server so there is no hydration mismatch.
function getEmailVerified(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("email_verified") !== "false";
}

export function EmailVerificationBanner() {
  const router = useRouter();
  const [verified] = useState(getEmailVerified);
  const [resending, setResending] = useState(false);
  const [done, setDone] = useState(false);

  if (verified) return null;

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post("/v1/auth/resend-verification", {});
      setDone(true);
      router.push("/verify-email");
    } catch {
      setResending(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium"
      style={{ background: "#FEF9C3", borderBottom: "1px solid #FDE047" }}
    >
      <div className="flex items-center gap-2" style={{ color: "#854D0E" }}>
        <i className="ti ti-mail" style={{ fontSize: 16 }} />
        <span>
          Your email address is not verified. Some features may be limited.
        </span>
      </div>
      <button
        onClick={handleResend}
        disabled={resending || done}
        className="text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0"
        style={{ background: "#854D0E", color: "#fff" }}
      >
        {resending ? "Sending..." : done ? "Sent!" : "Verify now"}
      </button>
    </div>
  );
}

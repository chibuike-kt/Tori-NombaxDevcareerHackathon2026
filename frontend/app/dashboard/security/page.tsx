"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSessions, revokeSession, type Session } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

function parseDevice(userAgent: string): { label: string; icon: string } {
  const ua = userAgent.toLowerCase();
  if (!ua) return { label: "Unknown device", icon: "ti-device-unknown" };
  if (ua.includes("iphone") || ua.includes("android"))
    return { label: /iphone/.test(ua) ? "iPhone" : "Android device", icon: "ti-device-mobile" };
  if (ua.includes("ipad")) return { label: "iPad", icon: "ti-device-tablet" };
  if (ua.includes("curl") || ua.includes("postman") || ua.includes("python"))
    return { label: "API client", icon: "ti-terminal-2" };

  let browser = "Browser";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/")) browser = "Safari";

  let os = "";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";

  return { label: os ? `${browser} on ${os}` : browser, icon: "ti-device-laptop" };
}

function SessionRow({ session }: { session: Session }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const device = parseDevice(session.user_agent);

  const revoke = useMutation({
    mutationFn: () => revokeSession(session.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });

  return (
    <div
      className="flex items-center justify-between gap-4 px-5 py-4"
      style={{ borderTop: "0.5px solid #F2F4F6" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "#F1F3F5" }}
        >
          <i className={`ti ${device.icon}`} style={{ fontSize: 18, color: "#6B7280" }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: "#0F1728" }}>
              {device.label}
            </span>
            {session.is_current && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                style={{ background: "#E6F8F2", color: "#00B37E" }}
              >
                This session
              </span>
            )}
          </div>
          <p className="text-xs font-medium mt-0.5" style={{ color: "#8A94A6" }}>
            {session.ip_address} · Last active {formatDateTime(session.last_seen_at)}
          </p>
        </div>
      </div>

      {!session.is_current &&
        (confirming ? (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => revoke.mutate()}
              disabled={revoke.isPending}
              className="text-xs px-3 py-1.5 rounded-lg font-bold border"
              style={{ borderColor: "#FDCACA", color: "#DC2626" }}
            >
              {revoke.isPending ? "Revoking..." : "Confirm"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs px-3 py-1.5 rounded-lg font-bold border"
              style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-bold border flex-shrink-0"
            style={{ borderColor: "#FDCACA", color: "#DC2626" }}
          >
            Revoke
          </button>
        ))}
    </div>
  );
}

function ComingSoonCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div
      className="bg-white border rounded-xl p-5 flex items-start justify-between gap-4"
      style={{ borderColor: "#EAECEF" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "#F1F3F5" }}
        >
          <i className={`ti ${icon}`} style={{ fontSize: 18, color: "#6B7280" }} />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
            {title}
          </p>
          <p className="text-xs font-medium mt-0.5 max-w-md" style={{ color: "#8A94A6" }}>
            {description}
          </p>
        </div>
      </div>
      <button
        disabled
        className="text-xs px-3 py-1.5 rounded-lg font-bold border flex-shrink-0 cursor-not-allowed"
        style={{ borderColor: "#E5E7EB", color: "#9CA3AF" }}
      >
        Coming soon
      </button>
    </div>
  );
}

export default function SecurityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: getSessions,
  });

  const sessions = data?.data ?? [];

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1
          className="text-xl lg:text-2xl font-extrabold"
          style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
        >
          Security
        </h1>
        <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
          Manage active sessions and account protections.
        </p>
      </div>

      <div
        className="bg-white border rounded-xl mb-4"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            Active sessions
          </h2>
        </div>
        {isLoading ? (
          <div
            className="p-10 text-center text-sm font-medium"
            style={{ color: "#8A94A6" }}
          >
            Loading...
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-10 text-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-device-laptop" style={{ fontSize: 18 }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No active sessions
            </p>
          </div>
        ) : (
          <div>
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <ComingSoonCard
          title="Two-factor authentication"
          description="Require a one-time code from an authenticator app in addition to your password."
          icon="ti-shield-lock"
        />
        <ComingSoonCard
          title="Passkeys"
          description="Sign in with a device passkey instead of a password — no authenticator app required."
          icon="ti-fingerprint"
        />
      </div>
    </div>
  );
}

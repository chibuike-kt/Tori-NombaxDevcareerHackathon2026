"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createAPIKey,
  rotateAPIKey,
  createTestAPIKey,
  revokeAPIKey,
  getAPIKeyHints,
  getMe,
  type APIKeyInfo,
  type APIKeyReveal,
} from "@/lib/api";
import { can, type Role } from "@/lib/permissions";

type Mode = "live" | "test";

function RevealModal({
  reveal,
  onClose,
}: {
  reveal: APIKeyReveal;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const accent = reveal.mode === "live" ? "#00B37E" : "#D97706";

  const copy = () => {
    navigator.clipboard.writeText(reveal.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,40,0.5)" }}
    >
      <div
        className="bg-white rounded-xl border max-w-lg w-full p-6"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: accent }}
          >
            <i className="ti ti-key text-white" style={{ fontSize: 20 }} />
          </div>
          <div>
            <p className="text-sm font-extrabold" style={{ color: "#0F1728" }}>
              Your new {reveal.mode} key
            </p>
            <p className="text-xs font-bold uppercase" style={{ color: accent }}>
              {reveal.mode}
            </p>
          </div>
        </div>
        <p
          className="text-xs font-bold mb-4 rounded-lg px-3 py-2"
          style={{ background: "#FDECEC", color: "#DC2626" }}
        >
          Copy this key now. This key won&apos;t be shown again.
        </p>
        <div
          className="flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 border mb-4"
          style={{ borderColor: "#E5E7EB" }}
        >
          <code
            className="text-xs font-mono flex-1 break-all min-w-0"
            style={{ color: "#0F1728" }}
          >
            {reveal.key}
          </code>
          <button
            onClick={copy}
            className="text-xs font-bold px-3 py-1.5 rounded-md flex-shrink-0"
            style={{ background: copied ? "#0F1728" : accent, color: "white" }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full text-sm px-4 py-2.5 rounded-lg font-bold text-white"
          style={{ background: "#0F1728" }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function ModeKeyCard({
  mode,
  info,
  onGenerate,
  generating,
  onRevoke,
  revoking,
  canManage,
}: {
  mode: Mode;
  info: APIKeyInfo;
  onGenerate: () => void;
  generating: boolean;
  onRevoke: () => void;
  revoking: boolean;
  canManage: boolean;
}) {
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const accent = mode === "live" ? "#00B37E" : "#D97706";
  const accentBg = mode === "live" ? "#E6F8F2" : "#FEF3C7";
  const label = mode === "live" ? "Live key" : "Test key";

  return (
    <div
      className="bg-white border rounded-xl mb-4"
      style={{ borderColor: "#EAECEF" }}
    >
      <div
        className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "#F0F2F4" }}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            {label}
          </h2>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
            style={{ background: accentBg, color: accent }}
          >
            {mode}
          </span>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={onGenerate}
              disabled={generating}
              className="text-xs px-3 py-1.5 rounded-lg font-bold border"
              style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
            >
              {generating
                ? "Generating..."
                : info.exists
                  ? "Regenerate"
                  : "Generate"}
            </button>
            {info.exists && !confirmingRevoke && (
              <button
                onClick={() => setConfirmingRevoke(true)}
                className="text-xs px-3 py-1.5 rounded-lg font-bold border"
                style={{ borderColor: "#FDCACA", color: "#DC2626" }}
              >
                Revoke
              </button>
            )}
          </div>
        )}
      </div>
      <div className="p-5">
        {confirmingRevoke ? (
          <div
            className="rounded-lg p-4"
            style={{ background: "#FFF8E1", border: "1px solid #FDE68A" }}
          >
            <p className="text-sm font-bold mb-1" style={{ color: "#0F1728" }}>
              Revoke the {mode} key?
            </p>
            <p className="text-xs font-medium mb-3" style={{ color: "#6B7280" }}>
              Requests using this key will stop working immediately.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onRevoke();
                  setConfirmingRevoke(false);
                }}
                disabled={revoking}
                className="text-xs px-3 py-1.5 rounded-lg font-bold border"
                style={{ borderColor: "#FDCACA", color: "#DC2626" }}
              >
                {revoking ? "Revoking..." : "Confirm revoke"}
              </button>
              <button
                onClick={() => setConfirmingRevoke(false)}
                className="text-xs px-3 py-1.5 rounded-lg font-bold border"
                style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : info.exists ? (
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#F1F3F5" }}
            >
              <i className="ti ti-key" style={{ fontSize: 18, color: "#6B7280" }} />
            </div>
            <div className="flex-1 min-w-0">
              <code
                className="text-sm font-mono font-semibold truncate"
                style={{ color: "#0F1728" }}
              >
                {info.hint}
              </code>
              <p className="text-xs font-medium mt-0.5" style={{ color: "#8A94A6" }}>
                Only the prefix and suffix are shown. Regenerating invalidates
                the current {mode} key immediately.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-key-off" style={{ fontSize: 22 }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No key generated yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const EMPTY_HINTS = {
  live: { hint: null, exists: false },
  test: { hint: null, exists: false },
} as const;

export default function APIKeysPage() {
  const [hints, setHints] = useState<{ live: APIKeyInfo; test: APIKeyInfo }>(
    EMPTY_HINTS,
  );
  const [reveal, setReveal] = useState<APIKeyReveal | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: meData } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const role = ((meData?.data?.member_role as Role) || "owner");
  const canManageAPIKeys = can(role, "manage_api_keys");

  const load = () => {
    getAPIKeyHints()
      .then((res) => setHints(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const generateLive = useMutation({
    mutationFn: () => (hints.live.exists ? rotateAPIKey() : createAPIKey("Default")),
    onSuccess: (res) => {
      setReveal(res.data);
      setHints((h) => ({ ...h, live: { hint: res.data.hint, exists: true } }));
    },
  });

  const generateTest = useMutation({
    mutationFn: () => createTestAPIKey(),
    onSuccess: (res) => {
      setReveal(res.data);
      setHints((h) => ({ ...h, test: { hint: res.data.hint, exists: true } }));
    },
  });

  const revokeLive = useMutation({
    mutationFn: () => revokeAPIKey("live"),
    onSuccess: () =>
      setHints((h) => ({ ...h, live: { hint: null, exists: false } })),
  });

  const revokeTest = useMutation({
    mutationFn: () => revokeAPIKey("test"),
    onSuccess: () =>
      setHints((h) => ({ ...h, test: { hint: null, exists: false } })),
  });

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1
          className="text-xl lg:text-2xl font-extrabold"
          style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
        >
          API Keys
        </h1>
        <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
          Authenticate server-to-server Platform API requests. Live keys move
          real money; test keys always route to Nomba&apos;s sandbox.
        </p>
      </div>

      {loading ? (
        <div
          className="bg-white border rounded-xl p-10 text-center text-sm font-medium mb-4"
          style={{ borderColor: "#EAECEF", color: "#8A94A6" }}
        >
          Loading...
        </div>
      ) : (
        <>
          <ModeKeyCard
            mode="live"
            info={hints.live}
            onGenerate={() => generateLive.mutate()}
            generating={generateLive.isPending}
            onRevoke={() => revokeLive.mutate()}
            revoking={revokeLive.isPending}
            canManage={canManageAPIKeys}
          />
          <ModeKeyCard
            mode="test"
            info={hints.test}
            onGenerate={() => generateTest.mutate()}
            generating={generateTest.isPending}
            onRevoke={() => revokeTest.mutate()}
            revoking={revokeTest.isPending}
            canManage={canManageAPIKeys}
          />
        </>
      )}

      {/* Usage example */}
      <div
        className="bg-white border rounded-xl"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            How to use
          </h2>
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold mb-3" style={{ color: "#4B5563" }}>
            Pass your key in the{" "}
            <code
              className="px-1.5 py-0.5 rounded text-xs"
              style={{ background: "#F1F3F5" }}
            >
              X-API-Key
            </code>{" "}
            header. Requests signed with a test key are always routed to
            Nomba&apos;s sandbox, regardless of live credentials configured on
            the server:
          </p>
          <pre
            className="rounded-xl p-4 text-xs font-mono leading-relaxed overflow-x-auto"
            style={{ background: "#0F1728", color: "#E5E7EB" }}
          >
            {`curl https://api.tori.ng/v1/platform/checkout \\
  -H "X-API-Key: tori_test_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "amaka@startup.ng",
    "plan_id": "plan_...",
    "external_id": "your-user-123"
  }'`}
          </pre>
        </div>
      </div>

      {reveal && <RevealModal reveal={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}

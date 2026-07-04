"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  createAPIKey,
  rotateAPIKey,
  createTestAPIKey,
  getAPIKeyHints,
  type APIKeyInfo,
  type APIKeyReveal,
} from "@/lib/api";

type Mode = "live" | "test";

function ModeKeyCard({
  mode,
  hint,
  loading,
  onGenerate,
  generating,
  revealed,
  onDismissReveal,
}: {
  mode: Mode;
  hint: APIKeyInfo | null;
  loading: boolean;
  onGenerate: () => void;
  generating: boolean;
  revealed: APIKeyReveal | null;
  onDismissReveal: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const accent = mode === "live" ? "#00B37E" : "#D97706";
  const accentBg = mode === "live" ? "#E6F8F2" : "#FEF3C7";
  const label = mode === "live" ? "Live key" : "Test key";

  const copy = () => {
    if (!revealed) return;
    navigator.clipboard.writeText(revealed.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        <button
          onClick={onGenerate}
          disabled={generating}
          className="text-xs px-3 py-1.5 rounded-lg font-bold border"
          style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
        >
          {generating ? "Generating..." : hint ? "Regenerate" : "Generate"}
        </button>
      </div>
      <div className="p-5">
        {revealed && (
          <div
            className="rounded-xl border p-4 mb-4"
            style={{ borderColor: accent, background: accentBg }}
          >
            <p
              className="text-xs font-extrabold mb-0.5"
              style={{ color: "#0F1728" }}
            >
              Copy this key now
            </p>
            <p className="text-xs font-medium mb-3" style={{ color: "#374151" }}>
              This is the only time this key will be shown. Tori stores only a
              hash.
            </p>
            <div
              className="flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 border"
              style={{ borderColor: "#E5E7EB" }}
            >
              <code
                className="text-xs font-mono flex-1 break-all min-w-0"
                style={{ color: "#0F1728" }}
              >
                {revealed.key}
              </code>
              <button
                onClick={copy}
                className="text-xs font-bold px-3 py-1.5 rounded-md flex-shrink-0"
                style={{ background: copied ? "#0F1728" : accent, color: "white" }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={onDismissReveal}
                className="flex-shrink-0"
                style={{ color: "#6B7280" }}
              >
                <i className="ti ti-x" style={{ fontSize: 16 }} />
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-sm font-medium" style={{ color: "#8A94A6" }}>
            Loading...
          </div>
        ) : hint ? (
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
                {hint.hint}
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
              No {mode} key yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function APIKeysPage() {
  const [hints, setHints] = useState<{ live: APIKeyInfo | null; test: APIKeyInfo | null }>({
    live: null,
    test: null,
  });
  const [revealed, setRevealed] = useState<{ live: APIKeyReveal | null; test: APIKeyReveal | null }>({
    live: null,
    test: null,
  });
  const [loading, setLoading] = useState(true);

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
    mutationFn: () => (hints.live ? rotateAPIKey() : createAPIKey("Default")),
    onSuccess: (res) => {
      setRevealed((r) => ({ ...r, live: res.data }));
      setHints((h) => ({ ...h, live: { hint: res.data.hint, created_at: new Date().toISOString() } }));
    },
  });

  const generateTest = useMutation({
    mutationFn: () => createTestAPIKey(),
    onSuccess: (res) => {
      setRevealed((r) => ({ ...r, test: res.data }));
      setHints((h) => ({ ...h, test: { hint: res.data.hint, created_at: new Date().toISOString() } }));
    },
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

      <ModeKeyCard
        mode="live"
        hint={hints.live}
        loading={loading}
        onGenerate={() => generateLive.mutate()}
        generating={generateLive.isPending}
        revealed={revealed.live}
        onDismissReveal={() => setRevealed((r) => ({ ...r, live: null }))}
      />
      <ModeKeyCard
        mode="test"
        hint={hints.test}
        loading={loading}
        onGenerate={() => generateTest.mutate()}
        generating={generateTest.isPending}
        revealed={revealed.test}
        onDismissReveal={() => setRevealed((r) => ({ ...r, test: null }))}
      />

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
    </div>
  );
}

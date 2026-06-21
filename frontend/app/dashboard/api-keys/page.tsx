"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createAPIKey, rotateAPIKey } from "@/lib/api";

export default function APIKeysPage() {
  const [keyName, setKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedHint, setRevealedHint] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [activeHint, setActiveHint] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => createAPIKey(keyName || "Default"),
    onSuccess: (res) => {
      setRevealedKey(res.data.key);
      setRevealedHint(res.data.hint);
      setActiveHint(res.data.hint);
      setShowCreateForm(false);
      setKeyName("");
    },
  });

  const rotate = useMutation({
    mutationFn: rotateAPIKey,
    onSuccess: (res) => {
      setRevealedKey(res.data.key);
      setRevealedHint(res.data.hint);
      setActiveHint(res.data.hint);
      setShowRotateConfirm(false);
    },
  });

  const copy = () => {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
            API Keys
          </h1>
          <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
            Authenticate server-to-server Platform API requests
          </p>
        </div>
        {!showCreateForm && !revealedKey && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-lg font-bold text-white"
            style={{ background: "#00B37E" }}
          >
            <i className="ti ti-plus" /> Create key
          </button>
        )}
      </div>

      {/* One-time reveal banner */}
      {revealedKey && (
        <div className="rounded-xl border p-5 mb-5" style={{ borderColor: "#00B37E", background: "#E6F8F2" }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#00B37E" }}>
              <i className="ti ti-key text-white" style={{ fontSize: 20 }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold mb-0.5" style={{ color: "#0F1728" }}>
                Copy your API key now
              </p>
              <p className="text-xs font-medium mb-3" style={{ color: "#166534" }}>
                This is the only time this key will be shown. Tori stores only a hash. If you lose it, rotate it.
              </p>
              <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-3 border" style={{ borderColor: "#D1FAE5" }}>
                <code className="text-xs font-mono flex-1 break-all" style={{ color: "#0F1728" }}>
                  {revealedKey}
                </code>
                <button
                  onClick={copy}
                  className="text-xs font-bold px-3 py-1.5 rounded-md flex-shrink-0"
                  style={{ background: copied ? "#0F1728" : "#00B37E", color: "white" }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <button
              onClick={() => setRevealedKey(null)}
              style={{ color: "#6B7280", flexShrink: 0 }}
            >
              <i className="ti ti-x" style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
      )}

      {/* Create key form */}
      {showCreateForm && (
        <div className="bg-white border rounded-xl p-5 mb-5" style={{ borderColor: "#EAECEF" }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: "#0F1728" }}>New API key</h2>
          <div className="mb-3">
            <label className="text-xs font-semibold block mb-1.5" style={{ color: "#4B5563" }}>
              Key name
            </label>
            <input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g. Production server"
              className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
              style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
            />
          </div>
          <p className="text-xs font-medium mb-4" style={{ color: "#8A94A6" }}>
            The key will be shown once immediately after creation. Store it in your secret manager before closing this screen.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="text-sm px-4 py-2 rounded-lg font-bold text-white"
              style={{ background: create.isPending ? "#9CA3AF" : "#0F1728" }}
            >
              {create.isPending ? "Generating..." : "Generate key"}
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setKeyName(""); }}
              className="text-sm px-4 py-2 rounded-lg font-bold border"
              style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active key display */}
      <div className="bg-white border rounded-xl mb-4" style={{ borderColor: "#EAECEF" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>Active key</h2>
        </div>
        <div className="p-5">
          {activeHint ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#F1F3F5" }}>
                  <i className="ti ti-key" style={{ fontSize: 18, color: "#6B7280" }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <code className="text-sm font-mono font-semibold" style={{ color: "#0F1728" }}>
                      {activeHint}
                    </code>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#E3F7EF", color: "#0A7A56" }}>
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-xs font-medium" style={{ color: "#8A94A6" }}>
                    Only the prefix and suffix are shown. The full key was shown once at creation.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#F1F3F5", color: "#9CA3AF" }}>
                <i className="ti ti-key-off" style={{ fontSize: 22 }} />
              </div>
              <p className="text-sm font-bold mb-1" style={{ color: "#0F1728" }}>No API key yet</p>
              <p className="text-xs font-medium mb-4" style={{ color: "#8A94A6" }}>
                Create a key to start making Platform API calls from your server.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="text-sm px-4 py-2 rounded-lg font-bold text-white"
                style={{ background: "#0F1728" }}
              >
                Create your first key
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Usage example */}
      <div className="bg-white border rounded-xl mb-4" style={{ borderColor: "#EAECEF" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>How to use</h2>
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold mb-3" style={{ color: "#4B5563" }}>
            Pass your key in the <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "#F1F3F5" }}>X-API-Key</code> header on all Platform API requests:
          </p>
          <pre className="rounded-xl p-4 text-xs font-mono leading-relaxed overflow-x-auto" style={{ background: "#0F1728", color: "#E5E7EB" }}>
{`# One call to start a subscription — no separate customer creation needed
curl https://api.tori.ng/v1/platform/checkout \\
  -H "X-API-Key: tori_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "amaka@startup.ng",
    "plan_id": "plan_...",
    "external_id": "your-user-123"
  }'`}
          </pre>
        </div>
      </div>

      {/* Rotation */}
      <div className="bg-white border rounded-xl" style={{ borderColor: "#EAECEF" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>Key rotation</h2>
        </div>
        <div className="p-5">
          {showRotateConfirm ? (
            <div>
              <div className="rounded-lg p-4 mb-4" style={{ background: "#FFF8E1", border: "1px solid #FDE68A" }}>
                <p className="text-sm font-bold mb-1" style={{ color: "#0F1728" }}>
                  Your current key stops working immediately
                </p>
                <p className="text-xs font-medium" style={{ color: "#6B7280" }}>
                  Deploy the new key to your server before rotating. Any requests using the old key will fail with 401 the moment you confirm.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => rotate.mutate()}
                  disabled={rotate.isPending}
                  className="text-sm px-4 py-2 rounded-lg font-bold border"
                  style={{ borderColor: "#FDCACA", color: "#DC2626", background: rotate.isPending ? "#F9FAFB" : "white" }}
                >
                  {rotate.isPending ? "Rotating..." : "Confirm rotation"}
                </button>
                <button
                  onClick={() => setShowRotateConfirm(false)}
                  className="text-sm px-4 py-2 rounded-lg font-bold border"
                  style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: "#0F1728" }}>Rotate API key</p>
                <p className="text-xs font-medium mt-0.5" style={{ color: "#8A94A6" }}>
                  Generates a new key and immediately invalidates the current one. Deploy the new key to your server first.
                </p>
              </div>
              <button
                onClick={() => setShowRotateConfirm(true)}
                className="text-sm px-4 py-2 rounded-lg font-bold border flex-shrink-0 ml-4"
                style={{ borderColor: "#FDCACA", color: "#DC2626" }}
              >
                Rotate key
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";

export default function APIKeysPage() {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const devKey = "tori_live_••••••••-••••-••••-••••-••••••••••••";
  const maskedKey = showKey
    ? "tori_live_3f9a2c71-8b4e-4d2a-9c1f-7e5d8a0b6c34"
    : devKey;

  const copy = () => {
    navigator.clipboard.writeText(
      "tori_live_3f9a2c71-8b4e-4d2a-9c1f-7e5d8a0b6c34",
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            API Keys
          </h1>
          <p
            className="text-sm font-medium mt-0.5"
            style={{ color: "#8A94A6" }}
          >
            Authenticate server-to-server Platform API calls
          </p>
        </div>
      </div>

      <div
        className="rounded-xl border p-5 mb-5 flex items-start gap-3"
        style={{ borderColor: "#FDE68A", background: "#FFFBEB" }}
      >
        <i
          className="ti ti-alert-triangle"
          style={{
            fontSize: 18,
            color: "#B8860B",
            flexShrink: 0,
            marginTop: 1,
          }}
        />
        <div>
          <p className="text-sm font-bold mb-0.5" style={{ color: "#0F1728" }}>
            Keep your API key secret
          </p>
          <p className="text-xs font-medium" style={{ color: "#6B7280" }}>
            Never expose your key in client-side code, mobile apps, or public
            repositories. Rotate immediately if compromised.
          </p>
        </div>
      </div>

      <div
        className="bg-white border rounded-xl mb-4"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            Live key
          </h2>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium mb-3" style={{ color: "#6B7280" }}>
            Use this key in the{" "}
            <code
              className="px-1 py-0.5 rounded text-xs"
              style={{ background: "#F1F3F5" }}
            >
              X-API-Key
            </code>{" "}
            header for all Platform API requests.
          </p>
          <div
            className="flex items-center gap-2.5 rounded-lg px-4 py-3 border mb-3"
            style={{ background: "#F8F9FA", borderColor: "#E5E7EB" }}
          >
            <i
              className="ti ti-key"
              style={{ fontSize: 16, color: "#9CA3AF" }}
            />
            <code
              className="text-sm font-mono flex-1"
              style={{ color: "#0F1728" }}
            >
              {maskedKey}
            </code>
            <button
              onClick={() => setShowKey(!showKey)}
              className="text-xs font-semibold"
              style={{ color: "#6B7280" }}
            >
              {showKey ? "Hide" : "Reveal"}
            </button>
            <button
              onClick={copy}
              className="text-xs font-bold px-3 py-1.5 rounded-lg"
              style={{
                background: copied ? "#E3F7EF" : "#0F1728",
                color: copied ? "#0A7A56" : "white",
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div
            className="flex items-center gap-2 text-xs font-medium"
            style={{ color: "#8A94A6" }}
          >
            <i className="ti ti-clock" style={{ fontSize: 13 }} />
            <span>Generated {formatDate(new Date().toISOString())}</span>
            <span
              className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: "#E3F7EF", color: "#0A7A56" }}
            >
              ACTIVE
            </span>
          </div>
        </div>
      </div>

      <div
        className="bg-white border rounded-xl mb-4"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            How to use
          </h2>
        </div>
        <div className="p-5">
          <p
            className="text-xs font-semibold mb-2"
            style={{ color: "#4B5563" }}
          >
            Create a subscription via the Platform API:
          </p>
          <pre
            className="rounded-lg p-4 text-xs font-mono overflow-x-auto"
            style={{ background: "#0F1728", color: "#E5E7EB" }}
          >
            {`curl https://api.tori.ng/v1/platform/subscriptions \\
  -H "X-API-Key: tori_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_id": "cus_...",
    "plan_id": "plan_..."
  }'`}
          </pre>
        </div>
      </div>

      <div
        className="bg-white border rounded-xl"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            Key rotation
          </h2>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#0F1728" }}>
              Rotate API key
            </p>
            <p
              className="text-xs font-medium mt-0.5"
              style={{ color: "#8A94A6" }}
            >
              Generates a new key and immediately invalidates the current one.
              Deploy the new key first.
            </p>
          </div>
          <button
            className="text-sm px-4 py-2 rounded-lg font-bold border"
            style={{ borderColor: "#FDCACA", color: "#DC2626" }}
          >
            Rotate key
          </button>
        </div>
      </div>
    </div>
  );
}

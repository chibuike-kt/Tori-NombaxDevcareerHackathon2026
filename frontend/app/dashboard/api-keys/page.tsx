"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";

export default function APIKeysPage() {
  const [copied, setCopied] = useState(false);

  const devKey = "tori-dev-key-2026";

  const copy = () => {
    navigator.clipboard.writeText(devKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--heading)" }}>
          API Keys
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          Keys for Platform API server-to-server integration
        </p>
      </div>

      <div
        className="rounded-lg border p-5 mb-4"
        style={{
          borderColor: "var(--border)",
          background: "var(--background)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <p
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--heading)" }}
        >
          Development key
        </p>
        <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
          Use this key in the X-API-Key header for Platform API calls. Shown
          once — store it securely.
        </p>
        <div
          className="flex items-center gap-3 p-3 rounded-lg"
          style={{
            background: "var(--background-secondary)",
            border: `1px solid var(--border)`,
          }}
        >
          <code
            className="flex-1 text-sm font-mono"
            style={{ color: "var(--heading)" }}
          >
            {devKey}
          </code>
          <button
            onClick={copy}
            className="text-sm px-3 py-1.5 rounded font-medium"
            style={{
              background: copied ? "#E6F8F2" : "var(--primary)",
              color: copied ? "var(--primary)" : "white",
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div
        className="rounded-lg border"
        style={{
          borderColor: "var(--border)",
          background: "var(--background)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div
          className="px-5 py-3.5 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--heading)" }}
          >
            Active keys
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid var(--border)` }}>
              {["Name", "Created", "Last used", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-2.5 text-left text-sm font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                className="px-5 py-3 text-sm font-medium"
                style={{ color: "var(--body)" }}
              >
                Development key
              </td>
              <td
                className="px-5 py-3 text-sm"
                style={{ color: "var(--muted)" }}
              >
                {formatDate(new Date().toISOString())}
              </td>
              <td
                className="px-5 py-3 text-sm"
                style={{ color: "var(--muted)" }}
              >
                Just now
              </td>
              <td className="px-5 py-3">
                <span className="text-sm font-semibold text-green-600">
                  Active
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

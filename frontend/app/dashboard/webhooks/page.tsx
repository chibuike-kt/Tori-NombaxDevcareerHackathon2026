"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface Endpoint {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  api_version: string;
  created_at: string;
}

interface Delivery {
  id: string;
  event_type: string;
  status: string;
  attempt_count: number;
  created_at: string;
  response_status?: number;
}

export default function WebhooksPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const { data: endpointsData } = useQuery({
    queryKey: ["webhook-endpoints"],
    queryFn: () => api.get<{ data: Endpoint[] }>("/v1/webhooks/endpoints"),
  });

  const { data: deliveriesData } = useQuery({
    queryKey: ["webhook-deliveries"],
    queryFn: () => api.get<{ data: Delivery[] }>("/v1/webhooks/logs"),
  });

  const endpoints = endpointsData?.data ?? [];
  const deliveries = deliveriesData?.data ?? [];

  const create = useMutation({
    mutationFn: () =>
      api.post<{ data: { endpoint: Endpoint; secret: string } }>(
        "/v1/webhooks/endpoints",
        {
          url,
          events: ["*"],
        },
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["webhook-endpoints"] });
      setNewSecret(res.data.secret);
      setShowForm(false);
      setUrl("");
    },
  });

  const deliveryStatusColor = (status: string) => {
    if (status === "delivered") return "text-green-600";
    if (status === "failed") return "text-red-600";
    return "text-amber-600";
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--heading)" }}
          >
            Webhooks
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Manage endpoints and view delivery logs
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="text-sm px-4 py-2 rounded-lg font-medium text-white"
          style={{ background: "var(--primary)" }}
        >
          Add endpoint
        </button>
      </div>

      {newSecret && (
        <div
          className="rounded-lg border p-4 mb-4"
          style={{ borderColor: "var(--primary)", background: "#E6F8F2" }}
        >
          <p
            className="text-sm font-semibold mb-1"
            style={{ color: "var(--heading)" }}
          >
            Endpoint secret — save this now
          </p>
          <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
            This will not be shown again. Use it to verify webhook signatures.
          </p>
          <code
            className="text-sm font-mono block p-2 rounded"
            style={{ background: "var(--background)", color: "var(--heading)" }}
          >
            {newSecret}
          </code>
          <button
            onClick={() => setNewSecret(null)}
            className="text-xs mt-2"
            style={{ color: "var(--muted)" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {showForm && (
        <div
          className="rounded-lg border p-4 mb-4"
          style={{
            borderColor: "var(--border)",
            background: "var(--background)",
          }}
        >
          <h2
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--heading)" }}
          >
            New endpoint
          </h2>
          <div className="flex gap-3">
            <input
              placeholder="https://yourapp.com/webhooks/tori"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 border rounded px-3 py-1.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--body)" }}
            />
            <button
              onClick={() => create.mutate()}
              className="text-sm px-4 py-1.5 rounded font-medium text-white"
              style={{ background: "var(--primary)" }}
            >
              {create.isPending ? "Adding..." : "Add"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-sm px-3 py-1.5 rounded border"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div
        className="rounded-lg border mb-4"
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
            Endpoints
          </h2>
        </div>
        {endpoints.length === 0 ? (
          <div
            className="px-5 py-8 text-center text-sm"
            style={{ color: "var(--muted)" }}
          >
            No endpoints registered.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid var(--border)` }}>
                {["URL", "Events", "Version", "Status", "Created"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-2.5 text-left text-xs font-medium"
                    style={{ color: "var(--muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr
                  key={ep.id}
                  style={{ borderBottom: `1px solid var(--border)` }}
                >
                  <td
                    className="px-5 py-3 text-sm font-mono"
                    style={{ color: "var(--body)" }}
                  >
                    {ep.url}
                  </td>
                  <td
                    className="px-5 py-3 text-xs"
                    style={{ color: "var(--muted)" }}
                  >
                    {ep.events.join(", ")}
                  </td>
                  <td
                    className="px-5 py-3 text-xs font-mono"
                    style={{ color: "var(--muted)" }}
                  >
                    {ep.api_version}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-medium ${ep.is_active ? "text-green-600" : "text-gray-400"}`}
                    >
                      {ep.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td
                    className="px-5 py-3 text-xs"
                    style={{ color: "var(--muted)" }}
                  >
                    {formatDate(ep.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
            Delivery log
          </h2>
        </div>
        {deliveries.length === 0 ? (
          <div
            className="px-5 py-8 text-center text-sm"
            style={{ color: "var(--muted)" }}
          >
            No deliveries yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid var(--border)` }}>
                {["Event", "Status", "Attempts", "Response", "Time"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-2.5 text-left text-xs font-medium"
                      style={{ color: "var(--muted)" }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr
                  key={d.id}
                  style={{ borderBottom: `1px solid var(--border)` }}
                >
                  <td
                    className="px-5 py-3 text-sm font-mono"
                    style={{ color: "var(--body)" }}
                  >
                    {d.event_type}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-semibold ${deliveryStatusColor(d.status)}`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td
                    className="px-5 py-3 text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    {d.attempt_count}
                  </td>
                  <td
                    className="px-5 py-3 text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    {d.response_status ?? "—"}
                  </td>
                  <td
                    className="px-5 py-3 text-xs"
                    style={{ color: "var(--muted)" }}
                  >
                    {formatDate(d.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

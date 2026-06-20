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
  const [copied, setCopied] = useState(false);

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
    mutationFn: () => api.post<{ data: { endpoint: Endpoint; secret: string } }>("/v1/webhooks/endpoints", {
      url, events: ["*"],
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["webhook-endpoints"] });
      setNewSecret(res.data.secret);
      setShowForm(false);
      setUrl("");
    },
  });

  const copySecret = () => {
    if (!newSecret) return;
    navigator.clipboard.writeText(newSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const deliveryStatus = (status: string) => {
    if (status === "delivered") return { bg: "#E3F7EF", color: "#0A7A56" };
    if (status === "failed") return { bg: "#FDECEC", color: "#A32D2D" };
    return { bg: "#FDF0D5", color: "#8A5A00" };
  };

  const events = [
    "subscription.activated", "subscription.paused", "subscription.cancelled",
    "subscription.suspended", "payment.succeeded", "payment.failed",
    "dunning.started", "dunning.recovered", "dunning.exhausted",
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>Webhooks</h1>
          <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>Manage endpoints and monitor delivery logs</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-lg font-bold text-white" style={{ background: "#00B37E" }}>
          <i className="ti ti-plus" /> Add endpoint
        </button>
      </div>

      {newSecret && (
        <div className="rounded-xl border p-5 mb-5" style={{ borderColor: "#00B37E", background: "#E6F8F2" }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#00B37E" }}>
              <i className="ti ti-key text-white" style={{ fontSize: 18 }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold mb-0.5" style={{ color: "#0F1728" }}>Save your signing secret</p>
              <p className="text-xs font-medium mb-3" style={{ color: "#4B5563" }}>This will never be shown again. Use it to verify webhook signatures.</p>
              <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2.5 border" style={{ borderColor: "#D1FAE5" }}>
                <code className="text-xs font-mono flex-1 break-all" style={{ color: "#0F1728" }}>{newSecret}</code>
                <button onClick={copySecret} className="text-xs font-bold px-3 py-1.5 rounded-md flex-shrink-0" style={{ background: copied ? "#0F1728" : "#00B37E", color: "white" }}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <button onClick={() => setNewSecret(null)} className="text-sm" style={{ color: "#6B7280" }}>
              <i className="ti ti-x" style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white border rounded-xl p-5 mb-4" style={{ borderColor: "#EAECEF" }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: "#0F1728" }}>New webhook endpoint</h2>
          <div className="mb-3">
            <label className="text-xs font-semibold block mb-1.5" style={{ color: "#4B5563" }}>Endpoint URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://yourapp.ng/webhooks/tori" className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium" style={{ background: "#F8F9FA", color: "#0F1728" }} />
          </div>
          <p className="text-xs font-medium mb-3" style={{ color: "#8A94A6" }}>All events will be delivered to this endpoint. You can filter by event type after creation.</p>
          <div className="flex gap-2">
            <button onClick={() => create.mutate()} disabled={create.isPending} className="text-sm px-4 py-2 rounded-lg font-bold text-white" style={{ background: create.isPending ? "#9CA3AF" : "#0F1728" }}>
              {create.isPending ? "Adding..." : "Add endpoint"}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm px-4 py-2 rounded-lg font-bold border" style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl mb-4" style={{ borderColor: "#EAECEF" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>Endpoints</h2>
        </div>
        {endpoints.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#F1F3F5", color: "#9CA3AF" }}>
              <i className="ti ti-webhook" style={{ fontSize: 22 }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>No endpoints registered</p>
            <p className="text-xs font-medium mt-1 mb-4" style={{ color: "#8A94A6" }}>Add an endpoint to start receiving billing events.</p>
            <button onClick={() => setShowForm(true)} className="text-sm px-4 py-2 rounded-lg font-bold text-white" style={{ background: "#0F1728" }}>Add endpoint</button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: "#FAFBFC", borderBottom: "0.5px solid #EAECEF" }}>
                {["URL", "Events", "Version", "Status", "Created"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold" style={{ color: "#98A2B3" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {endpoints.map(ep => (
                <tr key={ep.id} style={{ borderTop: "0.5px solid #F2F4F6" }}>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#0F1728" }}>{ep.url}</td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: "#6B7280" }}>{ep.events.join(", ")}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "#98A2B3" }}>{ep.api_version}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: ep.is_active ? "#E3F7EF" : "#F1F3F5", color: ep.is_active ? "#0A7A56" : "#6B7280" }}>
                      {ep.is_active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: "#98A2B3" }}>{formatDate(ep.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white border rounded-xl p-5" style={{ borderColor: "#EAECEF" }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: "#0F1728" }}>Supported events</h2>
          <div className="space-y-2">
            {events.map(e => (
              <div key={e} className="flex items-center gap-2.5 py-1.5 border-b" style={{ borderColor: "#F4F6F8" }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#00B37E", flexShrink: 0 }} />
                <code className="text-xs font-mono" style={{ color: "#4B5563" }}>{e}</code>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border rounded-xl" style={{ borderColor: "#EAECEF" }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
            <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>Delivery log</h2>
          </div>
          {deliveries.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-bold" style={{ color: "#0F1728" }}>No deliveries yet</p>
              <p className="text-xs font-medium mt-1" style={{ color: "#8A94A6" }}>Deliveries appear here when billing events fire.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ background: "#FAFBFC" }}>
                  {["Event", "Status", "Attempts", "Time"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold" style={{ color: "#98A2B3" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deliveries.map(d => {
                  const s = deliveryStatus(d.status);
                  return (
                    <tr key={d.id} style={{ borderTop: "0.5px solid #F2F4F6" }}>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: "#0F1728" }}>{d.event_type}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>{d.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: "#6B7280" }}>{d.attempt_count}</td>
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: "#98A2B3" }}>{formatDate(d.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

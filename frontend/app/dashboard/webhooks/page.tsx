"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getMe } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { can, type Role } from "@/lib/permissions";

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
  endpoint_id: string;
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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  const { data: meData } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const role = ((meData?.data?.member_role as Role) || "owner");
  const canManageWebhooks = can(role, "manage_webhooks");

  const create = useMutation({
    mutationFn: () =>
      api.post<{ data: { endpoint: Endpoint; secret: string } }>(
        "/v1/webhooks/endpoints",
        { url, events: ["*"] },
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["webhook-endpoints"] });
      setNewSecret(res.data.secret);
      setShowForm(false);
      setUrl("");
    },
  });

  const deleteEndpoint = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/webhooks/endpoints/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhook-endpoints"] });
      setConfirmDelete(null);
    },
  });

  const retryDelivery = useMutation({
    mutationFn: (id: string) => api.post(`/v1/webhooks/logs/${id}/retry`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhook-deliveries"] }),
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
    "subscription.activated",
    "subscription.paused",
    "subscription.resumed",
    "subscription.cancelled",
    "subscription.suspended",
    "subscription.created",
    "payment.succeeded",
    "payment.failed",
    "dunning.started",
    "dunning.recovered",
    "dunning.exhausted",
  ];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1
            className="text-xl lg:text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            Webhooks
          </h1>
          <p
            className="text-sm font-medium mt-0.5"
            style={{ color: "#8A94A6" }}
          >
            Manage endpoints and monitor delivery logs
          </p>
        </div>
        {canManageWebhooks && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm px-3 lg:px-4 py-2.5 rounded-lg font-bold text-white"
            style={{ background: "#00B37E" }}
          >
            <i className="ti ti-plus" />{" "}
            <span className="hidden sm:inline">Add endpoint</span>
          </button>
        )}
      </div>

      {/* Signing secret */}
      {newSecret && (
        <div
          className="rounded-xl border p-5 mb-5"
          style={{ borderColor: "#00B37E", background: "#E6F8F2" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#00B37E" }}
            >
              <i className="ti ti-key text-white" style={{ fontSize: 18 }} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-bold mb-0.5"
                style={{ color: "#0F1728" }}
              >
                Save your signing secret now
              </p>
              <p
                className="text-xs font-medium mb-1"
                style={{ color: "#4B5563" }}
              >
                This is shown exactly once. Tori stores only a hash and cannot
                show it again.
              </p>
              <p
                className="text-xs font-medium mb-3"
                style={{ color: "#6B7280" }}
              >
                Your server uses this secret to verify that webhook deliveries
                are genuinely from Tori. Compute{" "}
                <code
                  className="px-1 rounded"
                  style={{ background: "#D1FAE5" }}
                >
                  sha256=HMAC(secret, payload)
                </code>{" "}
                and compare it to the{" "}
                <code
                  className="px-1 rounded"
                  style={{ background: "#D1FAE5" }}
                >
                  X-Tori-Signature
                </code>{" "}
                header using a timing-safe comparison.
              </p>
              <div
                className="flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 border"
                style={{ borderColor: "#D1FAE5" }}
              >
                <code
                  className="text-xs font-mono flex-1 break-all min-w-0"
                  style={{ color: "#0F1728" }}
                >
                  {newSecret}
                </code>
                <button
                  onClick={copySecret}
                  className="text-xs font-bold px-3 py-1.5 rounded-md flex-shrink-0"
                  style={{
                    background: copied ? "#0F1728" : "#00B37E",
                    color: "white",
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <button
              onClick={() => setNewSecret(null)}
              className="flex-shrink-0"
              style={{ color: "#6B7280" }}
            >
              <i className="ti ti-x" style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
      )}

      {/* Add endpoint form */}
      {showForm && canManageWebhooks && (
        <div
          className="bg-white border rounded-xl p-5 mb-4"
          style={{ borderColor: "#EAECEF" }}
        >
          <h2 className="text-sm font-bold mb-1" style={{ color: "#0F1728" }}>
            New webhook endpoint
          </h2>
          <p className="text-xs font-medium mb-4" style={{ color: "#8A94A6" }}>
            Tori will POST a signed JSON payload to this URL for every billing
            event.
          </p>
          <div className="mb-3">
            <label
              className="text-xs font-semibold block mb-1.5"
              style={{ color: "#4B5563" }}
            >
              Endpoint URL
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourapp.ng/webhooks/tori"
              className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
              style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending || !url}
              className="text-sm px-4 py-2 rounded-lg font-bold text-white"
              style={{
                background: create.isPending || !url ? "#9CA3AF" : "#0F1728",
              }}
            >
              {create.isPending ? "Adding..." : "Add endpoint"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setUrl("");
              }}
              className="text-sm px-4 py-2 rounded-lg font-bold border"
              style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Endpoints table */}
      <div
        className="bg-white border rounded-xl mb-4"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            Endpoints
          </h2>
        </div>
        {endpoints.length === 0 ? (
          <div className="p-12 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-webhook" style={{ fontSize: 22 }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No endpoints registered
            </p>
            <p
              className="text-xs font-medium mt-1 mb-4"
              style={{ color: "#8A94A6" }}
            >
              Add an endpoint to start receiving billing events on your server.
            </p>
            {canManageWebhooks && (
              <button
                onClick={() => setShowForm(true)}
                className="text-sm px-4 py-2 rounded-lg font-bold text-white"
                style={{ background: "#0F1728" }}
              >
                Add endpoint
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr
                  style={{
                    background: "#FAFBFC",
                    borderBottom: "0.5px solid #EAECEF",
                  }}
                >
                  {["URL", "Status", "Version", "Created", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-[11px] font-semibold"
                      style={{ color: "#98A2B3" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {endpoints.map((ep) => (
                  <tr key={ep.id} style={{ borderTop: "0.5px solid #F2F4F6" }}>
                    <td
                      className="px-4 py-3 font-mono text-xs max-w-[160px] truncate"
                      style={{ color: "#0F1728" }}
                    >
                      {ep.url}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: ep.is_active ? "#E3F7EF" : "#FDECEC",
                          color: ep.is_active ? "#0A7A56" : "#A32D2D",
                        }}
                      >
                        {ep.is_active ? "ACTIVE" : "DISABLED"}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-xs font-mono"
                      style={{ color: "#98A2B3" }}
                    >
                      {ep.api_version}
                    </td>
                    <td
                      className="px-4 py-3 text-xs font-medium"
                      style={{ color: "#98A2B3" }}
                    >
                      {formatDate(ep.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {canManageWebhooks && (confirmDelete === ep.id ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-medium"
                            style={{ color: "#6B7280" }}
                          >
                            Delete?
                          </span>
                          <button
                            onClick={() => deleteEndpoint.mutate(ep.id)}
                            className="text-[11px] font-bold px-2 py-1 rounded"
                            style={{ background: "#FDECEC", color: "#DC2626" }}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-[11px] font-bold px-2 py-1 rounded"
                            style={{ background: "#F1F3F5", color: "#6B7280" }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(ep.id)}
                          className="text-[11px] font-bold px-2.5 py-1 rounded border"
                          style={{ borderColor: "#FDCACA", color: "#DC2626" }}
                        >
                          Delete
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom grid — stacks on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Supported events */}
        <div
          className="bg-white border rounded-xl p-5"
          style={{ borderColor: "#EAECEF" }}
        >
          <h2 className="text-sm font-bold mb-1" style={{ color: "#0F1728" }}>
            Supported events
          </h2>
          <p className="text-xs font-medium mb-4" style={{ color: "#8A94A6" }}>
            All events are delivered to every active endpoint. Each delivery is
            signed and logged.
          </p>
          <div className="space-y-1.5">
            {events.map((e) => (
              <div
                key={e}
                className="flex items-center gap-2.5 py-1.5 border-b"
                style={{ borderColor: "#F4F6F8" }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "#00B37E" }}
                />
                <code
                  className="text-xs font-mono"
                  style={{ color: "#4B5563" }}
                >
                  {e}
                </code>
              </div>
            ))}
          </div>
          <div
            className="mt-4 rounded-lg p-3"
            style={{ background: "#F8F9FA" }}
          >
            <p
              className="text-xs font-semibold mb-1"
              style={{ color: "#4B5563" }}
            >
              Why the secret is shown once
            </p>
            <p className="text-xs font-medium" style={{ color: "#6B7280" }}>
              Tori stores only a hash of your signing secret, not the secret
              itself. If someone gains access to your dashboard, they cannot
              steal your secret and forge webhook events. If you lose it, delete
              the endpoint and create a new one.
            </p>
          </div>
        </div>

        {/* Delivery log */}
        <div
          className="bg-white border rounded-xl"
          style={{ borderColor: "#EAECEF" }}
        >
          <div
            className="px-5 py-4 border-b"
            style={{ borderColor: "#F0F2F4" }}
          >
            <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
              Delivery log
            </h2>
          </div>
          {deliveries.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
                No deliveries yet
              </p>
              <p
                className="text-xs font-medium mt-1"
                style={{ color: "#8A94A6" }}
              >
                Deliveries appear here when billing events fire.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[380px]">
                <thead>
                  <tr style={{ background: "#FAFBFC" }}>
                    {["Event", "Status", "Attempts", "Time", ""].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-[11px] font-semibold"
                        style={{ color: "#98A2B3" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => {
                    const s = deliveryStatus(d.status);
                    return (
                      <tr
                        key={d.id}
                        style={{ borderTop: "0.5px solid #F2F4F6" }}
                      >
                        <td
                          className="px-4 py-3 text-xs font-mono"
                          style={{ color: "#0F1728" }}
                        >
                          {d.event_type}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: s.bg, color: s.color }}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 text-xs font-medium"
                          style={{ color: "#6B7280" }}
                        >
                          {d.attempt_count}
                        </td>
                        <td
                          className="px-4 py-3 text-xs font-medium"
                          style={{ color: "#98A2B3" }}
                        >
                          {formatDateTime(d.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          {d.status === "failed" && (
                            <button
                              onClick={() => retryDelivery.mutate(d.id)}
                              className="text-[11px] font-bold px-2.5 py-1 rounded border"
                              style={{
                                borderColor: "#E5E7EB",
                                color: "#6B7280",
                              }}
                            >
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

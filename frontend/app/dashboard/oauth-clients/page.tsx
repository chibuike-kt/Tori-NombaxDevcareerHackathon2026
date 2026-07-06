"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOAuthClient,
  revokeOAuthClient,
  getOAuthClients,
  getMe,
  type OAuthClient,
  type OAuthClientReveal,
} from "@/lib/api";
import { can, type Role } from "@/lib/permissions";

function RevealModal({
  reveal,
  onClose,
}: {
  reveal: OAuthClientReveal;
  onClose: () => void;
}) {
  const [copiedField, setCopiedField] = useState<"client_id" | "client_secret" | null>(null);
  const accent = reveal.mode === "live" ? "#00B37E" : "#D97706";

  const copy = (field: "client_id" | "client_secret", value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
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
            <i className="ti ti-shield-lock text-white" style={{ fontSize: 20 }} />
          </div>
          <div>
            <p className="text-sm font-extrabold" style={{ color: "#0F1728" }}>
              {reveal.name}
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
          This secret will not be shown again. Copy it now.
        </p>

        <p className="text-[11px] font-bold uppercase mb-1.5" style={{ color: "#9CA3AF" }}>
          Client ID
        </p>
        <div
          className="flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 border mb-4"
          style={{ borderColor: "#E5E7EB" }}
        >
          <code
            className="text-xs font-mono flex-1 break-all min-w-0"
            style={{ color: "#0F1728" }}
          >
            {reveal.client_id}
          </code>
          <button
            onClick={() => copy("client_id", reveal.client_id)}
            className="text-xs font-bold px-3 py-1.5 rounded-md flex-shrink-0"
            style={{ background: copiedField === "client_id" ? "#0F1728" : accent, color: "white" }}
          >
            {copiedField === "client_id" ? "Copied" : "Copy"}
          </button>
        </div>

        <p className="text-[11px] font-bold uppercase mb-1.5" style={{ color: "#9CA3AF" }}>
          Client secret
        </p>
        <div
          className="flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 border mb-4"
          style={{ borderColor: "#E5E7EB" }}
        >
          <code
            className="text-xs font-mono flex-1 break-all min-w-0"
            style={{ color: "#0F1728" }}
          >
            {reveal.client_secret}
          </code>
          <button
            onClick={() => copy("client_secret", reveal.client_secret)}
            className="text-xs font-bold px-3 py-1.5 rounded-md flex-shrink-0"
            style={{ background: copiedField === "client_secret" ? "#0F1728" : accent, color: "white" }}
          >
            {copiedField === "client_secret" ? "Copied" : "Copy"}
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

function CreateClientModal({
  onClose,
  onCreate,
  creating,
}: {
  onClose: () => void;
  onCreate: (name: string, mode: "live" | "test") => void;
  creating: boolean;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"live" | "test">("live");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,40,0.5)" }}
    >
      <div
        className="bg-white rounded-xl border max-w-md w-full p-6"
        style={{ borderColor: "#EAECEF" }}
      >
        <h2 className="text-base font-extrabold mb-4" style={{ color: "#0F1728" }}>
          Create OAuth client
        </h2>

        <label className="block text-xs font-bold mb-1.5" style={{ color: "#4B5563" }}>
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. ClassPay integration"
          className="w-full text-sm px-3 py-2.5 rounded-lg border mb-4 outline-none"
          style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
        />

        <label className="block text-xs font-bold mb-1.5" style={{ color: "#4B5563" }}>
          Mode
        </label>
        <div
          className="flex items-center rounded-lg p-1 gap-1 mb-5"
          style={{ background: "#F1F3F5" }}
        >
          <button
            onClick={() => setMode("live")}
            className="flex-1 text-xs font-bold px-3 py-1.5 rounded-md transition-colors"
            style={{
              background: mode === "live" ? "#0F1728" : "transparent",
              color: mode === "live" ? "#fff" : "#6B7280",
            }}
          >
            Live
          </button>
          <button
            onClick={() => setMode("test")}
            className="flex-1 text-xs font-bold px-3 py-1.5 rounded-md transition-colors"
            style={{
              background: mode === "test" ? "#D97706" : "transparent",
              color: mode === "test" ? "#fff" : "#6B7280",
            }}
          >
            Test
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => name.trim() && onCreate(name.trim(), mode)}
            disabled={!name.trim() || creating}
            className="flex-1 text-sm px-4 py-2.5 rounded-lg font-bold text-white disabled:opacity-50"
            style={{ background: "#0F1728" }}
          >
            {creating ? "Creating..." : "Create client"}
          </button>
          <button
            onClick={onClose}
            className="text-sm px-4 py-2.5 rounded-lg font-bold border"
            style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function RevokeConfirm({
  client,
  onConfirm,
  onCancel,
  revoking,
}: {
  client: OAuthClient;
  onConfirm: () => void;
  onCancel: () => void;
  revoking: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,40,0.5)" }}
    >
      <div
        className="bg-white rounded-xl border max-w-sm w-full p-6"
        style={{ borderColor: "#EAECEF" }}
      >
        <p className="text-sm font-bold mb-1" style={{ color: "#0F1728" }}>
          Revoke &quot;{client.name}&quot;?
        </p>
        <p className="text-xs font-medium mb-4" style={{ color: "#6B7280" }}>
          New tokens can no longer be issued for this client. Tokens already
          issued remain valid until they expire (up to 30 minutes).
        </p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={revoking}
            className="flex-1 text-xs px-3 py-2 rounded-lg font-bold border"
            style={{ borderColor: "#FDCACA", color: "#DC2626" }}
          >
            {revoking ? "Revoking..." : "Confirm revoke"}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 text-xs px-3 py-2 rounded-lg font-bold border"
            style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OAuthClientsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [reveal, setReveal] = useState<OAuthClientReveal | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<OAuthClient | null>(null);

  const { data: meData } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const role = (meData?.data?.member_role as Role) || "owner";
  const canManage = can(role, "manage_api_keys");

  const { data, isLoading } = useQuery({
    queryKey: ["oauth-clients"],
    queryFn: getOAuthClients,
  });
  const clients = data?.data ?? [];

  const create = useMutation({
    mutationFn: ({ name, mode }: { name: string; mode: "live" | "test" }) =>
      createOAuthClient(name, mode),
    onSuccess: (res) => {
      setReveal(res.data);
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["oauth-clients"] });
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeOAuthClient(id),
    onSuccess: () => {
      setRevokeTarget(null);
      qc.invalidateQueries({ queryKey: ["oauth-clients"] });
    },
  });

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-xl lg:text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            OAuth Clients
          </h1>
          <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
            Production-grade client_credentials tokens for the Platform API —
            an alternative to raw API keys.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="text-sm px-4 py-2.5 rounded-lg font-bold text-white flex-shrink-0"
            style={{ background: "#0F1728" }}
          >
            <i className="ti ti-plus mr-1.5" style={{ fontSize: 14 }} />
            Create client
          </button>
        )}
      </div>

      <div
        className="bg-white border rounded-xl overflow-hidden"
        style={{ borderColor: "#EAECEF" }}
      >
        {isLoading ? (
          <div className="p-10 text-center text-sm font-medium" style={{ color: "#8A94A6" }}>
            Loading...
          </div>
        ) : clients.length === 0 ? (
          <div className="p-10 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-shield-lock" style={{ fontSize: 22 }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No OAuth clients yet
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr style={{ background: "#F8F9FA", borderBottom: "1px solid #EAECEF" }}>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Name</th>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Client ID</th>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Mode</th>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Created</th>
                  <th className="text-left px-5 py-3 font-bold text-xs" style={{ color: "#6B7280" }}>Last used</th>
                  {canManage && <th className="px-5 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const accent = c.mode === "live" ? "#00B37E" : "#D97706";
                  const accentBg = c.mode === "live" ? "#E6F8F2" : "#FEF3C7";
                  return (
                    <tr key={c.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td className="px-5 py-3.5 font-semibold" style={{ color: "#0F1728" }}>
                        {c.name}
                        {!c.is_active && (
                          <span
                            className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                            style={{ background: "#FEE2E2", color: "#991B1B" }}
                          >
                            Revoked
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <code
                          className="text-xs font-mono cursor-pointer"
                          style={{ color: "#4B5563" }}
                          onClick={() => navigator.clipboard.writeText(c.client_id)}
                          title="Click to copy"
                        >
                          {c.client_id}
                        </code>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                          style={{ background: accentBg, color: accent }}
                        >
                          {c.mode}
                        </span>
                      </td>
                      <td className="px-5 py-3.5" style={{ color: "#8A94A6" }}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: "#8A94A6" }}>
                        {c.last_used_at ? new Date(c.last_used_at).toLocaleDateString() : "Never"}
                      </td>
                      {canManage && (
                        <td className="px-5 py-3.5 text-right">
                          {c.is_active && (
                            <button
                              onClick={() => setRevokeTarget(c)}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg border"
                              style={{ borderColor: "#FDCACA", color: "#DC2626" }}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        className="bg-white border rounded-xl mt-5"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            How to use
          </h2>
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold mb-3" style={{ color: "#4B5563" }}>
            Exchange your client_id and client_secret for a short-lived (30
            minute) bearer token, then pass it in the{" "}
            <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "#F1F3F5" }}>
              Authorization
            </code>{" "}
            header on any Platform API request:
          </p>
          <pre
            className="rounded-xl p-4 text-xs font-mono leading-relaxed overflow-x-auto"
            style={{ background: "#0F1728", color: "#E5E7EB" }}
          >
            {`curl https://api.tori.ng/v1/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "client_credentials",
    "client_id": "oauth_client_...",
    "client_secret": "oauth_secret_..."
  }'

curl https://api.tori.ng/v1/platform/checkout \\
  -H "Authorization: Bearer tori_oauth_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "amaka@startup.ng", "plan_id": "plan_..." }'`}
          </pre>
        </div>
      </div>

      {showCreate && (
        <CreateClientModal
          onClose={() => setShowCreate(false)}
          onCreate={(name, mode) => create.mutate({ name, mode })}
          creating={create.isPending}
        />
      )}
      {reveal && <RevealModal reveal={reveal} onClose={() => setReveal(null)} />}
      {revokeTarget && (
        <RevokeConfirm
          client={revokeTarget}
          onConfirm={() => revoke.mutate(revokeTarget.id)}
          onCancel={() => setRevokeTarget(null)}
          revoking={revoke.isPending}
        />
      )}
    </div>
  );
}

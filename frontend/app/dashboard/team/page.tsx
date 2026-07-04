"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTeamMembers,
  getAuditLog,
  inviteMember,
  updateMemberRole,
  removeMember,
  revokeInvitation,
  type Member,
  type Invitation,
  type AuditEntry,
} from "@/lib/api";
import { formatDateTime, avatarFor } from "@/lib/utils";

const ROLES = ["owner", "admin", "developer", "viewer"];

function roleBadge(role: string) {
  switch (role) {
    case "owner":
      return { bg: "#FEF3C7", color: "#92400E" };
    case "admin":
      return { bg: "#EDE9FE", color: "#5B21B6" };
    case "developer":
      return { bg: "#EEF2FF", color: "#3730A3" };
    case "viewer":
      return { bg: "#F1F3F5", color: "#6B7280" };
    default:
      return { bg: "#F1F3F5", color: "#6B7280" };
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "active":
      return { bg: "#E3F7EF", color: "#0A7A56", label: "Active" };
    case "invited":
      return { bg: "#FEF9C3", color: "#854D0E", label: "Invited" };
    case "suspended":
      return { bg: "#FEE2E2", color: "#B91C1C", label: "Suspended" };
    default:
      return { bg: "#F1F3F5", color: "#6B7280", label: status };
  }
}

export default function TeamPage() {
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("developer");
  const [showInvite, setShowInvite] = useState(false);
  const [error, setError] = useState("");

  const { data: teamData, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: getTeamMembers,
  });

  const { data: auditData } = useQuery({
    queryKey: ["audit-log"],
    queryFn: getAuditLog,
  });


const members: Member[] = teamData?.data?.members ?? [];
const invitations: Invitation[] = teamData?.data?.invitations ?? [];
const auditEntries: AuditEntry[] = Array.isArray(auditData?.data?.data)
  ? auditData!.data.data
  : [];

  const invite = useMutation({
    mutationFn: () => inviteMember(inviteEmail, inviteRole),
    onSuccess: () => {
      setInviteEmail("");
      setShowInvite(false);
      setError("");
      qc.invalidateQueries({ queryKey: ["team"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (e: Error) => setError(e?.message ?? "Failed to send invite"),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      updateMemberRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
  });

  const remove = useMutation({
    mutationFn: removeMember,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
  });

  const revoke = useMutation({
    mutationFn: revokeInvitation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1
            className="text-xl lg:text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            Team & Roles
          </h1>
          <p
            className="text-sm font-medium mt-0.5"
            style={{ color: "#8A94A6" }}
          >
            Invite members, assign roles and review workspace activity.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: "#0F1728", cursor: "pointer" }}
        >
          <i className="ti ti-user-plus" style={{ fontSize: 16 }} />
          Invite member
        </button>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowInvite(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="text-base font-bold mb-4"
              style={{ color: "#0F1728" }}
            >
              Invite a team member
            </h2>
            <div className="mb-3">
              <label
                className="text-xs font-semibold block mb-1"
                style={{ color: "#6B7280" }}
              >
                Email address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
              />
            </div>
            <div className="mb-4">
              <label
                className="text-xs font-semibold block mb-1"
                style={{ color: "#6B7280" }}
              >
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={{
                  borderColor: "#E5E7EB",
                  color: "#0F1728",
                  cursor: "pointer",
                }}
              >
                {ROLES.filter((r) => r !== "owner").map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            {error && (
              <p
                className="text-xs font-medium mb-3"
                style={{ color: "#DC2626" }}
              >
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => invite.mutate()}
                disabled={!inviteEmail || invite.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{
                  background: "#0F1728",
                  cursor: "pointer",
                  opacity: !inviteEmail ? 0.5 : 1,
                }}
              >
                {invite.isPending ? "Sending..." : "Send invite"}
              </button>
              <button
                onClick={() => setShowInvite(false)}
                className="py-2.5 px-4 rounded-xl text-sm font-bold border"
                style={{
                  borderColor: "#E5E7EB",
                  color: "#6B7280",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members table */}
      <div
        className="bg-white border rounded-xl mb-5"
        style={{ borderColor: "#EAECEF" }}
      >
        <div
          className="px-4 py-3.5"
          style={{ borderBottom: "0.5px solid #F0F2F4" }}
        >
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            Members
          </h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm" style={{ color: "#8A94A6" }}>
            Loading team...
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr
                style={{
                  background: "#FAFBFC",
                  borderBottom: "0.5px solid #EAECEF",
                }}
              >
                {["Member", "Role", "Status", "Last login", ""].map((h) => (
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
              {members.map((m) => {
                const av = avatarFor(m.email);
                const rb = roleBadge(m.role);
                const sb = statusBadge(m.status);
                return (
                  <tr key={m.id} style={{ borderTop: "0.5px solid #F2F4F6" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background: av.bg, color: av.color }}
                        >
                          {av.initials}
                        </span>
                        <div>
                          <p
                            className="text-xs font-semibold"
                            style={{ color: "#1F2733" }}
                          >
                            {m.name || m.email}
                          </p>
                          <p
                            className="text-[11px]"
                            style={{ color: "#98A2B3" }}
                          >
                            {m.name ? m.email : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {m.role === "owner" ? (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: rb.bg, color: rb.color }}
                        >
                          Owner
                        </span>
                      ) : (
                        <select
                          value={m.role}
                          onChange={(e) =>
                            changeRole.mutate({
                              id: m.id,
                              role: e.target.value,
                            })
                          }
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full border-0 outline-none"
                          style={{
                            background: rb.bg,
                            color: rb.color,
                            cursor: "pointer",
                          }}
                        >
                          {ROLES.filter((r) => r !== "owner").map((r) => (
                            <option key={r} value={r}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: sb.bg, color: sb.color }}
                      >
                        {sb.label}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-xs font-medium"
                      style={{ color: "#6B7280" }}
                    >
                      {m.last_login_at ? formatDateTime(m.last_login_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {m.role !== "owner" && (
                        <button
                          onClick={() => remove.mutate(m.id)}
                          className="text-[11px] px-2 py-1 rounded-md hover:opacity-75 transition-opacity"
                          style={{ color: "#DC2626", cursor: "pointer" }}
                        >
                          <i className="ti ti-trash" style={{ fontSize: 14 }} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Pending invitations */}
              {invitations.map((inv) => {
                const av = avatarFor(inv.email);
                const rb = roleBadge(inv.role);
                return (
                  <tr
                    key={inv.id}
                    style={{ borderTop: "0.5px solid #F2F4F6", opacity: 0.7 }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background: av.bg, color: av.color }}
                        >
                          {av.initials}
                        </span>
                        <p
                          className="text-xs font-semibold"
                          style={{ color: "#1F2733" }}
                        >
                          {inv.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: rb.bg, color: rb.color }}
                      >
                        {inv.role.charAt(0).toUpperCase() + inv.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "#FEF9C3", color: "#854D0E" }}
                      >
                        Invited
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-xs font-medium"
                      style={{ color: "#98A2B3" }}
                    >
                      —
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => revoke.mutate(inv.id)}
                        className="text-[11px] px-2 py-1 rounded-md hover:opacity-75 transition-opacity"
                        style={{ color: "#DC2626", cursor: "pointer" }}
                      >
                        <i className="ti ti-trash" style={{ fontSize: 14 }} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Audit log */}
      <div
        className="bg-white border rounded-xl"
        style={{ borderColor: "#EAECEF" }}
      >
        <div
          className="px-4 py-3.5"
          style={{ borderBottom: "0.5px solid #F0F2F4" }}
        >
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            Audit log
          </h2>
          <p
            className="text-[11px] font-medium mt-0.5"
            style={{ color: "#98A2B3" }}
          >
            Recent administrative activity in this workspace.
          </p>
        </div>
        {auditEntries.length === 0 ? (
          <div
            className="p-8 text-center text-xs font-medium"
            style={{ color: "#C4CACD" }}
          >
            No activity yet.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr
                style={{
                  background: "#FAFBFC",
                  borderBottom: "0.5px solid #EAECEF",
                }}
              >
                {["Action", "Target", "IP", "Time"].map((h) => (
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
              {auditEntries.map((e) => (
                <tr key={e.id} style={{ borderTop: "0.5px solid #F2F4F6" }}>
                  <td className="px-4 py-3">
                    <span
                      className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded"
                      style={{ background: "#F1F3F5", color: "#374151" }}
                    >
                      {e.action}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3 text-xs font-medium"
                    style={{ color: "#4B5563" }}
                  >
                    {e.target || "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-xs font-mono"
                    style={{ color: "#98A2B3" }}
                  >
                    {e.ip_address || "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-xs font-medium"
                    style={{ color: "#6B7280" }}
                  >
                    {formatDateTime(e.created_at)}
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

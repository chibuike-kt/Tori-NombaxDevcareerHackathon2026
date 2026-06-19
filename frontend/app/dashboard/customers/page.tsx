"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCustomers, createCustomer } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function CustomersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });
  const customers = data?.data ?? [];
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => createCustomer({ email, name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setShowForm(false);
      setEmail("");
      setName("");
    },
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--heading)" }}
          >
            Customers
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            {customers.length} total
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="text-sm px-4 py-2 rounded-lg font-medium text-white"
          style={{ background: "var(--primary)" }}
        >
          Add customer
        </button>
      </div>

      {showForm && (
        <div
          className="rounded-lg border p-4 mb-4"
          style={{
            borderColor: "var(--border)",
            background: "var(--background)",
          }}
        >
          <h2
            className="text-sm font-medium mb-3"
            style={{ color: "var(--heading)" }}
          >
            New customer
          </h2>
          <div className="flex gap-3">
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 border rounded px-3 py-1.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--body)" }}
            />
            <input
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 border rounded px-3 py-1.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--body)" }}
            />
            <button
              onClick={() => create.mutate()}
              className="text-sm px-4 py-1.5 rounded font-medium text-white"
              style={{ background: "var(--primary)" }}
            >
              {create.isPending ? "Creating..." : "Create"}
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
        className="rounded-lg border"
        style={{
          borderColor: "var(--border)",
          background: "var(--background)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {isLoading ? (
          <div
            className="px-5 py-10 text-center text-sm"
            style={{ color: "var(--muted)" }}
          >
            Loading...
          </div>
        ) : customers.length === 0 ? (
          <div
            className="px-5 py-10 text-center text-sm"
            style={{ color: "var(--muted)" }}
          >
            No customers yet. Add your first customer above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid var(--border)` }}>
                {["Email", "Name", "External ID", "Created"].map((h) => (
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
              {customers.map((c) => (
                <tr
                  key={c.id}
                  style={{ borderBottom: `1px solid var(--border)` }}
                >
                  <td
                    className="px-5 py-3 text-sm"
                    style={{ color: "var(--body)" }}
                  >
                    {c.email}
                  </td>
                  <td
                    className="px-5 py-3 text-sm"
                    style={{ color: "var(--body)" }}
                  >
                    {c.name || "—"}
                  </td>
                  <td
                    className="px-5 py-3 font-mono text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    {c.external_id || "—"}
                  </td>
                  <td
                    className="px-5 py-3 text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    {formatDate(c.created_at)}
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

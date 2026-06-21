"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getCustomers, createCustomer } from "@/lib/api";
import { formatDate, avatarFor } from "@/lib/utils";

export default function CustomersPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });
  const customers = data?.data ?? [];
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createCustomer({ email, name, external_id: externalId || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setShowForm(false);
      setEmail("");
      setName("");
      setExternalId("");
      setError("");
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Failed to create customer"),
  });

  const filtered = customers.filter(
    (c) =>
      !search ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            Customers
          </h1>
          <p
            className="text-sm font-medium mt-0.5"
            style={{ color: "#8A94A6" }}
          >
            {customers.length} total customers
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-lg font-bold text-white"
          style={{ background: "#00B37E" }}
        >
          <i className="ti ti-plus" /> Add customer
        </button>
      </div>

      {showForm && (
        <div
          className="bg-white border rounded-xl p-5 mb-4"
          style={{ borderColor: "#EAECEF" }}
        >
          <h2 className="text-sm font-bold mb-1" style={{ color: "#0F1728" }}>
            New customer
          </h2>
          <p className="text-xs font-medium mb-4" style={{ color: "#8A94A6" }}>
            Adding a customer here does not start a subscription. Go to
            Subscriptions and click &quot;New subscription&quot; to subscribe them to a
            plan.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label
                className="text-xs font-semibold block mb-1.5"
                style={{ color: "#4B5563" }}
              >
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@business.ng"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
                style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
              />
            </div>
            <div>
              <label
                className="text-xs font-semibold block mb-1.5"
                style={{ color: "#4B5563" }}
              >
                Name (optional)
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Amaka Obi"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
                style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
              />
            </div>
            <div>
              <label
                className="text-xs font-semibold block mb-1.5"
                style={{ color: "#4B5563" }}
              >
                External ID (optional)
                <span
                  className="ml-1.5 font-normal"
                  style={{ color: "#9CA3AF" }}
                >
                  your own user ID
                </span>
              </label>
              <input
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="user_12345"
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
                style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
              />
            </div>
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
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="text-sm px-4 py-2 rounded-lg font-bold text-white"
              style={{ background: create.isPending ? "#9CA3AF" : "#0F1728" }}
            >
              {create.isPending ? "Creating..." : "Create customer"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setError("");
              }}
              className="text-sm px-4 py-2 rounded-lg font-bold border"
              style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div
        className="flex items-center gap-2 mb-4 border rounded-lg px-3.5 py-2.5 bg-white w-80"
        style={{ borderColor: "#E5E7EB" }}
      >
        <i
          className="ti ti-search"
          style={{ fontSize: 14, color: "#9CA3AF" }}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers..."
          className="outline-none text-sm font-medium flex-1"
          style={{ color: "#0F1728" }}
        />
      </div>

      <div
        className="bg-white border rounded-xl"
        style={{ borderColor: "#EAECEF" }}
      >
        {isLoading ? (
          <div
            className="p-12 text-center text-sm font-medium"
            style={{ color: "#8A94A6" }}
          >
            Loading customers...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-users" style={{ fontSize: 22 }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No customers yet
            </p>
            <p
              className="text-xs font-medium mt-1 mb-4"
              style={{ color: "#8A94A6" }}
            >
              Add your first customer to start billing.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="text-sm px-4 py-2 rounded-lg font-bold text-white"
              style={{ background: "#0F1728" }}
            >
              Add customer
            </button>
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
                {["Customer", "Name", "External ID", "Created", ""].map((h) => (
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
              {filtered.map((c) => {
                const av = avatarFor(c.email);
                return (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/dashboard/customers/${c.id}`)}
                    style={{
                      borderTop: "0.5px solid #F2F4F6",
                      cursor: "pointer",
                    }}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-8 h-8 rounded-full inline-flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: av.bg, color: av.color }}
                        >
                          {av.initials}
                        </span>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: "#1F2733" }}
                        >
                          {c.email}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-xs font-medium"
                      style={{ color: "#4B5563" }}
                    >
                      {c.name ?? "Not set"}
                    </td>
                    <td
                      className="px-4 py-3 text-xs font-mono"
                      style={{ color: "#98A2B3" }}
                    >
                      {c.external_id ?? "Not set"}
                    </td>
                    <td
                      className="px-4 py-3 text-xs font-medium"
                      style={{ color: "#98A2B3" }}
                    >
                      {formatDate(c.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: "#00B37E" }}
                      >
                        View
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

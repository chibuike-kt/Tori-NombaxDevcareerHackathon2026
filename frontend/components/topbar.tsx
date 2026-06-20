"use client";

import { useEffect, useState } from "react";
import { getMe, type Tenant } from "@/lib/api";

export function Topbar() {
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    getMe()
      .then((res) => setTenant(res.data))
      .catch(() => {});
  }, []);

  const initials = tenant?.name
    ? tenant.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "T";

  return (
    <header
      className="flex items-center justify-between px-6 py-3.5 bg-white border-b"
      style={{ borderColor: "#EAECEF" }}
    >
      <div
        className="flex items-center gap-2.5 rounded-lg px-3.5 py-2 w-80"
        style={{ background: "#F1F3F5" }}
      >
        <i
          className="ti ti-search"
          style={{ fontSize: 16, color: "#9CA3AF" }}
        />
        <input
          placeholder="Search customers, subscriptions..."
          className="bg-transparent outline-none text-sm font-medium flex-1"
          style={{ color: "#0F1728" }}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: "#F1F3F5", color: "#6B7280" }}
        >
          <i className="ti ti-bell" style={{ fontSize: 18 }} />
        </button>
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
            style={{ background: "#E6F8F2", color: "#00B37E" }}
          >
            {initials}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold" style={{ color: "#0F1728" }}>
              {tenant?.name ?? "Loading..."}
            </div>
            <div className="text-xs font-medium" style={{ color: "#9CA3AF" }}>
              {tenant?.email ?? ""}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

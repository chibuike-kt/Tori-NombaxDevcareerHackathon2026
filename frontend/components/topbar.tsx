"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getMe, type Tenant } from "@/lib/api";
import { getMode, setMode as persistMode, type NombaMode } from "@/lib/mode";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [mode, setModeState] = useState<NombaMode>("live");
  const queryClient = useQueryClient();

  useEffect(() => {
    getMe()
      .then((res) => setTenant(res.data))
      .catch(() => {});
    setModeState(getMode());
  }, []);

  const switchMode = (next: NombaMode) => {
    persistMode(next);
    setModeState(next);
    // Every data-fetching hook is keyed off data that depends on the active
    // mode header — clear the cache so switching Live/Test refetches
    // immediately instead of showing stale data until a manual refresh.
    queryClient.clear();
  };

  const initials = tenant?.name
    ? tenant.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "T";

  const roleBadgeColors: Record<string, { bg: string; color: string }> = {
    owner: { bg: "#E6F8F2", color: "#0F6E56" },
    admin: { bg: "#EAF2FF", color: "#1D4ED8" },
    developer: { bg: "#FEF3C7", color: "#B45309" },
    viewer: { bg: "#F1F3F5", color: "#6B7280" },
  };
  const role = tenant?.member_role ?? "owner";
  const roleColors = roleBadgeColors[role] ?? roleBadgeColors.owner;

  return (
    <header
      className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-white border-b"
      style={{ borderColor: "#EAECEF" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden flex-shrink-0 p-1.5 rounded-lg"
            style={{ color: "#0F1728" }}
          >
            <i className="ti ti-menu-2" style={{ fontSize: 22 }} />
          </button>
        )}
        <img
          src="/logo-light.svg"
          alt="Tori"
          className="h-6 w-auto lg:hidden flex-shrink-0"
        />
        <div
          className="hidden lg:flex items-center gap-2.5 rounded-lg px-3.5 py-2 w-80"
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
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Mode toggle is critical UI — always visible, on every screen size */}
        <div
          className="flex items-center rounded-lg p-1 gap-1"
          style={{ background: "#F1F3F5" }}
        >
          <button
            onClick={() => switchMode("live")}
            className="text-xs font-bold px-3 py-1.5 rounded-md transition-colors"
            style={{
              background: mode === "live" ? "#0F1728" : "transparent",
              color: mode === "live" ? "#fff" : "#6B7280",
            }}
          >
            Live
          </button>
          <button
            onClick={() => switchMode("test")}
            className="text-xs font-bold px-3 py-1.5 rounded-md transition-colors"
            style={{
              background: mode === "test" ? "#D97706" : "transparent",
              color: mode === "test" ? "#fff" : "#6B7280",
            }}
          >
            Test
          </button>
        </div>
        <button
          className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center"
          style={{ background: "#F1F3F5", color: "#6B7280" }}
        >
          <i className="ti ti-bell" style={{ fontSize: 18 }} />
        </button>
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ background: "#E6F8F2", color: "#00B37E" }}
          >
            {initials}
          </div>
          <div className="leading-tight hidden md:block">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold" style={{ color: "#0F1728" }}>
                {tenant?.name ?? "Loading..."}
              </span>
              {tenant && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                  style={{ background: roleColors.bg, color: roleColors.color }}
                >
                  {role}
                </span>
              )}
            </div>
            <div className="text-xs font-medium" style={{ color: "#9CA3AF" }}>
              {tenant?.email ?? ""}
            </div>
          </div>
          {tenant && (
            <span
              className="md:hidden text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0"
              style={{ background: roleColors.bg, color: roleColors.color }}
            >
              {role}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

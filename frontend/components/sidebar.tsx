"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const nav = [
  { href: "/dashboard", label: "Overview", icon: "ti-layout-dashboard" },
  {
    href: "/dashboard/subscriptions",
    label: "Subscriptions",
    icon: "ti-refresh",
  },
  { href: "/dashboard/health", label: "Billing health", icon: "ti-heartbeat" },
  { href: "/dashboard/recovery", label: "Recovery", icon: "ti-refresh-alert" },
  { href: "/dashboard/customers", label: "Customers", icon: "ti-users" },
  { href: "/dashboard/plans", label: "Plans", icon: "ti-file-text" },
  { href: "/dashboard/invoices", label: "Invoices", icon: "ti-receipt" },
  { href: "/dashboard/finance", label: "Finance", icon: "ti-chart-bar" },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: "ti-webhook" },
  { href: "/dashboard/api-keys", label: "API Keys", icon: "ti-key" },
  { href: "/dashboard/settings", label: "Settings", icon: "ti-settings" },
  { href: "/dashboard/team", label: "Team & Roles", icon: "ti-users-group" },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (token) {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/v1/auth/logout`,
          { method: "POST", headers: { Authorization: `Bearer ${token}` } },
        );
      }
    } catch {
      // proceed regardless
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      router.push("/login");
    }
  };

  const handleNav = () => {
    onClose?.();
  };

  return (
    <aside
      className="w-60 flex flex-col bg-white border-r"
      style={{
        borderColor: "#F0F0F0",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      <div
        className="px-5 py-5 border-b flex items-center gap-2 flex-shrink-0"
        style={{ borderColor: "#F0F0F0" }}
      >
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center"
          style={{ background: "#0F1728" }}
        >
          <svg viewBox="0 0 14 14" className="w-4 h-4">
            <path
              d="M7 1L11.5 3.75V8.25L7 11L2.5 8.25V3.75L7 1Z"
              fill="#00B37E"
            />
          </svg>
        </div>
        <span
          className="text-xl font-extrabold tracking-tight"
          style={{ color: "#0F1728" }}
        >
          Tori
        </span>
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded ml-1"
          style={{ background: "#E6F8F2", color: "#0F6E56" }}
        >
          Nomba
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto lg:hidden"
            style={{ color: "#6B7280" }}
          >
            <i className="ti ti-x" style={{ fontSize: 18 }} />
          </button>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 overflow-y-auto">
        {nav.map(({ href, label, icon }) => {
          const isExact = pathname === href;
          const isActive =
            href === "/dashboard"
              ? isExact
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={handleNav}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5"
              style={{
                color: isActive ? "#00B37E" : "#4B5563",
                background: isActive ? "#E6F8F2" : "transparent",
                fontWeight: isActive ? 700 : 500,
              }}
            >
              <i className={`ti ${icon}`} style={{ fontSize: 18 }} />
              {label}
            </Link>
          );
        })}

        <div className="mt-3 pt-3 border-t" style={{ borderColor: "#F0F0F0" }}>
          <Link
            href="/docs"
            onClick={handleNav}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
            style={{
              color: pathname.startsWith("/docs") ? "#00B37E" : "#4B5563",
              background: pathname.startsWith("/docs")
                ? "#E6F8F2"
                : "transparent",
              fontWeight: pathname.startsWith("/docs") ? 700 : 500,
            }}
          >
            <i className="ti ti-book" style={{ fontSize: 18 }} />
            Documentation
          </Link>
        </div>
      </nav>

      <div
        className="px-2 py-3 border-t flex-shrink-0"
        style={{ borderColor: "#F0F0F0" }}
      >
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold w-full"
          style={{ color: "#DC2626" }}
        >
          <i className="ti ti-logout" style={{ fontSize: 18 }} />
          Log out
        </button>
      </div>
    </aside>
  );
}

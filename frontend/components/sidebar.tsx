"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Overview", icon: "ti-layout-dashboard" },
  {
    href: "/dashboard/subscriptions",
    label: "Subscriptions",
    icon: "ti-refresh",
  },
  { href: "/dashboard/health", icon: "ti-heartbeat", label: "Billing health" },
  { href: "/dashboard/customers", label: "Customers", icon: "ti-users" },
  { href: "/dashboard/plans", label: "Plans", icon: "ti-file-text" },
  { href: "/dashboard/invoices", label: "Invoices", icon: "ti-receipt" },
  { href: "/dashboard/finance", label: "Finance", icon: "ti-chart-bar" },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: "ti-webhook" },
  { href: "/dashboard/api-keys", label: "API Keys", icon: "ti-key" },
  { href: "/dashboard/settings", label: "Settings", icon: "ti-settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside
      className="w-60 min-h-screen border-r flex flex-col bg-white"
      style={{ borderColor: "#F0F0F0" }}
    >
      <div
        className="px-5 py-5 border-b flex items-center gap-2"
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
      </div>

      <nav className="flex-1 py-4 px-2">
        {nav.map(({ href, label, icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href + "/"));
          const isExact = pathname === href;
          const shouldHighlight = href === "/dashboard" ? isExact : active;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5"
              style={{
                color: shouldHighlight ? "#00B37E" : "#4B5563",
                background: shouldHighlight ? "#E6F8F2" : "transparent",
                fontWeight: shouldHighlight ? 700 : 500,
              }}
            >
              <i className={`ti ${icon}`} style={{ fontSize: 18 }} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t" style={{ borderColor: "#F0F0F0" }}>
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

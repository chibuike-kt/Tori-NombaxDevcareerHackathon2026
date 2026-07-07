"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getMe } from "@/lib/api";
import { can, type Role } from "@/lib/permissions";

type NavItem = { href: string; label: string; icon: string };
type NavSection = { label: string | null; items: NavItem[] };

const sections: NavSection[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Overview", icon: "ti-layout-dashboard" },
    ],
  },
  {
    label: "Billing",
    items: [
      { href: "/dashboard/subscriptions", label: "Subscriptions", icon: "ti-refresh" },
      { href: "/dashboard/health", label: "Billing health", icon: "ti-heartbeat" },
      { href: "/dashboard/recovery", label: "Recovery", icon: "ti-refresh-alert" },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/dashboard/customers", label: "Customers", icon: "ti-users" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/dashboard/plans", label: "Plans", icon: "ti-file-text" },
      { href: "/dashboard/promo-codes", label: "Promo Codes", icon: "ti-discount" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/dashboard/invoices", label: "Invoices", icon: "ti-receipt" },
      { href: "/dashboard/finance", label: "Finance", icon: "ti-chart-bar" },
      { href: "/dashboard/payouts", label: "Payouts", icon: "ti-building-bank" },
    ],
  },
  {
    label: "Developers",
    items: [
      { href: "/dashboard/webhooks", label: "Webhooks", icon: "ti-webhook" },
      { href: "/dashboard/api-keys", label: "API Keys", icon: "ti-key" },
      { href: "/dashboard/oauth-clients", label: "OAuth Clients", icon: "ti-shield-lock" },
      { href: "/dashboard/email-templates", label: "Email Templates", icon: "ti-mail" },
      { href: "/docs", label: "Documentation", icon: "ti-book" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: "ti-settings" },
      { href: "/dashboard/team", label: "Team & Roles", icon: "ti-users-group" },
      { href: "/dashboard/security", label: "Security", icon: "ti-shield-lock" },
    ],
  },
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<Role>("owner");

  useEffect(() => {
    getMe()
      .then((res) => setRole((res.data.member_role as Role) || "owner"))
      .catch(() => {});
  }, []);

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.href === "/dashboard/webhooks") return can(role, "view_webhooks");
        if (item.href === "/dashboard/api-keys") return can(role, "view_api_keys");
        if (item.href === "/dashboard/oauth-clients") return can(role, "view_api_keys");
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

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
        <img src="/logo-light.svg" alt="Tori" className="h-7 w-auto" />
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
        {visibleSections.map((section, i) => (
          <div key={section.label ?? `section-${i}`} className={i > 0 ? "mt-4" : ""}>
            {section.label && (
              <div
                className="px-3 mb-1.5 text-[10px] font-bold tracking-wider uppercase"
                style={{ color: "#9CA3AF" }}
              >
                {section.label}
              </div>
            )}
            {section.items.map(({ href, label, icon }) => {
              const isActive = isNavActive(pathname, href);
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
          </div>
        ))}
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

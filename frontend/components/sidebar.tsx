"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  Users,
  FileText,
  BarChart2,
  Webhook,
  Key,
  Settings,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  {
    href: "/dashboard/subscriptions",
    label: "Subscriptions",
    icon: CreditCard,
  },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/plans", label: "Plans", icon: FileText },
  { href: "/dashboard/finance", label: "Finance", icon: BarChart2 },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/dashboard/api-keys", label: "API Keys", icon: Key },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-60 min-h-screen border-r flex flex-col"
      style={{ borderColor: "var(--border)", background: "var(--background)" }}
    >
      <div
        className="px-5 py-5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="font-bold text-lg" style={{ color: "var(--heading)" }}>
          Tori
        </span>
        <span
          className="text-xs ml-2 px-1.5 py-0.5 rounded font-medium"
          style={{ background: "#E6F8F2", color: "var(--primary)" }}
        >
          by Nomba
        </span>
      </div>
      <nav className="flex-1 py-4">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors"
              style={{
                color: active ? "var(--primary)" : "var(--body)",
                background: active ? "#E6F8F2" : "transparent",
                fontWeight: active ? 600 : 400,
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div
        className="px-5 py-4 border-t text-xs font-medium"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      >
        Tori v1.0 · Nomba × DevCareer 2026
      </div>
    </aside>
  );
}

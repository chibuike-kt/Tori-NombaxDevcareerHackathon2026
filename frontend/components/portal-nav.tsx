"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { portalHref } from "@/lib/portal-api";

const LINKS = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/subscriptions", label: "Subscriptions" },
  { href: "/portal/invoices", label: "Invoices" },
];

export function PortalNav({ token, merchantName }: { token: string; merchantName?: string }) {
  const pathname = usePathname();

  return (
    <div className="border-b bg-white sticky top-0 z-10" style={{ borderColor: "#EAECEF" }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-2 sm:gap-3">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "#0F1728" }}
        >
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5">
            <path d="M7 1L11.5 3.75V8.25L7 11L2.5 8.25V3.75L7 1Z" fill="#00B37E" />
          </svg>
        </div>
        <span
          className="text-sm font-extrabold truncate min-w-0"
          style={{ color: "#0F1728" }}
        >
          {merchantName || "Billing portal"}
        </span>
        <nav className="ml-auto flex gap-0.5 sm:gap-1 flex-shrink-0">
          {LINKS.map((l) => {
            const active = l.href === "/portal" ? pathname === l.href : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={portalHref(l.href, token)}
                className="text-xs font-bold px-2 sm:px-3 py-1.5 rounded-lg whitespace-nowrap"
                style={{
                  background: active ? "#E6F8F2" : "transparent",
                  color: active ? "#00B37E" : "#6B7280",
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function PortalFooter() {
  return (
    <p className="text-xs font-medium text-center py-8" style={{ color: "#C4CACD" }}>
      Powered by Tori · Secure billing portal
    </p>
  );
}

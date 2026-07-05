"use client";

import Link from "next/link";

export function AuthNav({
  rightText,
  rightLink,
  rightLabel,
  showClose,
}: {
  rightText?: string;
  rightLink?: string;
  rightLabel?: string;
  showClose?: boolean;
}) {
  return (
    <nav
      className="flex items-center justify-between px-10 py-5 border-b"
      style={{ borderColor: "#F0F0F0" }}
    >
      <Link href="/" className="flex items-center gap-2">
        <img src="/logo-light.svg" alt="Tori" className="h-8 w-auto" />
      </Link>
      <div className="flex items-center gap-5">
        {rightText && (
          <span className="text-sm font-medium" style={{ color: "#6B7280" }}>
            {rightText}{" "}
            <Link
              href={rightLink!}
              style={{ color: "#00B37E", fontWeight: 600 }}
            >
              {rightLabel}
            </Link>
          </span>
        )}
        <div
          className="flex items-center gap-2 border rounded-lg px-3 py-1.5"
          style={{ borderColor: "#E5E7EB" }}
        >
          <svg
            viewBox="0 0 18 12"
            className="w-[18px] h-3 rounded-sm overflow-hidden"
          >
            <rect width="6" height="12" x="0" fill="#008751" />
            <rect width="6" height="12" x="6" fill="#FFFFFF" />
            <rect width="6" height="12" x="12" fill="#008751" />
          </svg>
          <span className="text-sm font-medium" style={{ color: "#0F1728" }}>
            Nigeria (English)
          </span>
          <i
            className="ti ti-chevron-down"
            style={{ fontSize: 14, color: "#6B7280" }}
          />
        </div>
        {showClose && (
          <Link
            href="/"
            className="w-9 h-9 rounded-full flex items-center justify-center border"
            style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
          >
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </Link>
        )}
      </div>
    </nav>
  );
}

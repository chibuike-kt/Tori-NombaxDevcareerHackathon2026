"use client";
import { useState, Suspense, lazy } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

// Lazy load the banners so they only render on the client after hydration
const EmailVerificationBanner = lazy(() =>
  import("@/components/email-verification-banner").then((m) => ({
    default: m.EmailVerificationBanner,
  })),
);
const TestModeBanner = lazy(() =>
  import("@/components/test-mode-banner").then((m) => ({
    default: m.TestModeBanner,
  })),
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ background: "#F8F9FB" }}>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={`
        fixed inset-y-0 left-0 z-30 lg:static lg:z-auto
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="hidden lg:block">
          <Topbar />
        </div>
        {/* Banners rendered client-side only via Suspense — no SSR, no hydration mismatch */}
        <Suspense fallback={null}>
          <TestModeBanner />
        </Suspense>
        <Suspense fallback={null}>
          <EmailVerificationBanner />
        </Suspense>

        {/* Mobile top bar */}
        <div
          className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b"
          style={{ borderColor: "#F0F0F0" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg"
            style={{ color: "#0F1728" }}
          >
            <i className="ti ti-menu-2" style={{ fontSize: 22 }} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo-light.svg" alt="Tori" className="h-6 w-auto" />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

export function LiveChat() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div
          className="mb-3 w-72 rounded-xl bg-white border shadow-lg overflow-hidden"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="px-4 py-3" style={{ background: "#0F1728" }}>
            <p className="text-sm font-bold text-white">Tori Support</p>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>
              We&apos;re online! How can we help?
            </p>
          </div>
          <div className="p-4">
            <div
              className="rounded-lg p-3 text-sm font-medium"
              style={{ background: "#F8F9FA", color: "#4B5563" }}
            >
              Hi! Need help getting started with Tori? Ask us anything about
              recurring billing.
            </div>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg ml-auto"
        style={{ background: "#00B37E" }}
      >
        <i
          className="ti ti-message-circle text-white"
          style={{ fontSize: 24 }}
        />
      </button>
    </div>
  );
}

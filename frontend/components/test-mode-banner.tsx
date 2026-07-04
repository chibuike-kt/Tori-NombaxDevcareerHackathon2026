"use client";
import { useEffect, useState } from "react";
import { getMode, onModeChange, type NombaMode } from "@/lib/mode";

export function TestModeBanner() {
  const [mode, setMode] = useState<NombaMode>("live");

  useEffect(() => {
    setMode(getMode());
    return onModeChange(setMode);
  }, []);

  if (mode !== "test") return null;

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold"
      style={{ background: "#FEF3C7", borderBottom: "1px solid #FBBF24", color: "#92400E" }}
    >
      <i className="ti ti-flask" style={{ fontSize: 16 }} />
      <span>You&apos;re in test mode. No real charges will be made.</span>
    </div>
  );
}

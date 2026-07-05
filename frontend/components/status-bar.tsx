"use client";
import { useEffect, useState } from "react";

const STATUS_URL = "https://api-production-3847.up.railway.app/v1/status";

type Health = "ok" | "down";

interface StatusState {
  api: Health;
  database: Health;
  nomba: Health;
  worker: Health;
}

/**
 * Thin live status strip. Fetches /v1/status once on mount with a 5s timeout.
 * Only ever renders "Checking status..." or real dots — never a broken-looking
 * error state, since a failed fetch just means the check never resolved.
 */
export function StatusBar() {
  const [status, setStatus] = useState<StatusState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch(STATUS_URL, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("status check failed"))))
      .then((json) => {
        const data = json?.data ?? json ?? {};
        const checks = data.checks ?? {};
        setStatus({
          api: checks.api === "ok" ? "ok" : "down",
          database: checks.database === "ok" ? "ok" : "down",
          nomba: checks.nomba === "connected" || checks.nomba === "ok" ? "ok" : "down",
          worker: data.worker ? "ok" : "down",
        });
      })
      .catch(() => {
        // Network error, timeout, or non-2xx — leave status null, shows "Checking status..."
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const items: { label: string; state: Health }[] = status
    ? [
        { label: "API operational", state: status.api },
        { label: "Database connected", state: status.database },
        { label: "Nomba connected", state: status.nomba },
        { label: "Worker running", state: status.worker },
      ]
    : [];

  return (
    <div className="border-t border-b py-3" style={{ borderColor: "#F0F0F0", background: "#FAFAF8" }}>
      <div className="section-container px-6 lg:px-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
        {!status ? (
          <span className="text-xs font-semibold flex items-center gap-2" style={{ color: "#9CA3AF" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "#D1D5DB" }} />
            Checking status...
          </span>
        ) : (
          items.map((item) => (
            <span key={item.label} className="text-xs font-semibold flex items-center gap-2" style={{ color: "#4B5563" }}>
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: item.state === "ok" ? "#00B37E" : "#EF4444" }}
              />
              {item.label}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

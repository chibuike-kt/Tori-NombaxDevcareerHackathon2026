"use client";

import { useQuery } from "@tanstack/react-query";
import { getEvents, type TenantEvent } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

function eventIcon(eventType: string): string {
  if (eventType.startsWith("payout")) return "ti-building-bank";
  if (eventType.startsWith("payment_link")) return "ti-link";
  if (eventType.startsWith("oauth_client")) return "ti-shield-lock";
  return "ti-activity";
}

export default function ActivityPage() {
  const { data, isLoading } = useQuery({ queryKey: ["events"], queryFn: () => getEvents(100) });
  const events = data?.data ?? [];

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1
          className="text-xl lg:text-2xl font-extrabold"
          style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
        >
          Activity
        </h1>
        <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
          A live feed of admin actions taken on this account.
        </p>
      </div>

      <div
        className="bg-white border rounded-xl overflow-hidden"
        style={{ borderColor: "#EAECEF" }}
      >
        {isLoading ? (
          <div className="p-10 text-center text-sm font-medium" style={{ color: "#8A94A6" }}>
            Loading...
          </div>
        ) : events.length === 0 ? (
          <div className="p-10 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-activity" style={{ fontSize: 22 }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No activity yet
            </p>
          </div>
        ) : (
          <ul>
            {events.map((e: TenantEvent, i: number) => (
              <li
                key={e.id}
                className="flex items-start gap-3 px-5 py-4"
                style={i > 0 ? { borderTop: "1px solid #F3F4F6" } : undefined}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "#F1F3F5", color: "#6B7280" }}
                >
                  <i className={`ti ${eventIcon(e.event_type)}`} style={{ fontSize: 15 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#0F1728" }}>
                    {e.description}
                  </p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: "#9CA3AF" }}>
                    {formatDateTime(e.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

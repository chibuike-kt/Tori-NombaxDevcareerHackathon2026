"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSubscriptions,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
} from "@/lib/api";
import { StatusPill } from "@/components/status-pill";
import { formatDate } from "@/lib/utils";

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: getSubscriptions,
  });
  const subs = data?.data ?? [];

  const cancel = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
  const pause = useMutation({
    mutationFn: pauseSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
  const resume = useMutation({
    mutationFn: resumeSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1
          className="text-xl font-semibold"
          style={{ color: "var(--heading)" }}
        >
          Subscriptions
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          All active and historical billing relationships
        </p>
      </div>

      <div
        className="rounded-lg border"
        style={{
          borderColor: "var(--border)",
          background: "var(--background)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {isLoading ? (
          <div
            className="px-5 py-10 text-center text-sm"
            style={{ color: "var(--muted)" }}
          >
            Loading...
          </div>
        ) : subs.length === 0 ? (
          <div
            className="px-5 py-10 text-center text-sm"
            style={{ color: "var(--muted)" }}
          >
            No subscriptions yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid var(--border)` }}>
                {[
                  "ID",
                  "Status",
                  "Plan",
                  "Period End",
                  "Dunning",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-2.5 text-left text-sm font-medium"
                    style={{ color: "var(--muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => (
                <tr
                  key={sub.id}
                  style={{ borderBottom: `1px solid var(--border)` }}
                >
                  <td
                    className="px-5 py-3 font-mono text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    {sub.id.slice(0, 8)}…
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill status={sub.status} />
                  </td>
                  <td
                    className="px-5 py-3 text-sm font-mono"
                    style={{ color: "var(--muted)" }}
                  >
                    {sub.plan_id.slice(0, 8)}…
                  </td>
                  <td
                    className="px-5 py-3 text-sm"
                    style={{ color: "var(--body)" }}
                  >
                    {formatDate(sub.current_period_end)}
                  </td>
                  <td
                    className="px-5 py-3 text-sm"
                    style={{
                      color:
                        sub.dunning_attempt > 0
                          ? "var(--warning)"
                          : "var(--muted)",
                    }}
                  >
                    {sub.dunning_attempt > 0
                      ? `Attempt ${sub.dunning_attempt}`
                      : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      {sub.status === "ACTIVE" && (
                        <>
                          <button
                            onClick={() => pause.mutate(sub.id)}
                            className="text-sm px-2 py-1 rounded border"
                            style={{
                              borderColor: "var(--border)",
                              color: "var(--muted)",
                            }}
                          >
                            Pause
                          </button>
                          <button
                            onClick={() => cancel.mutate(sub.id)}
                            className="text-sm px-2 py-1 rounded border"
                            style={{
                              borderColor: "var(--danger)",
                              color: "var(--danger)",
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {sub.status === "PAUSED" && (
                        <button
                          onClick={() => resume.mutate(sub.id)}
                          className="text-sm px-2 py-1 rounded border"
                          style={{
                            borderColor: "var(--primary)",
                            color: "var(--primary)",
                          }}
                        >
                          Resume
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

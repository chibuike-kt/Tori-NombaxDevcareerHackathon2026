"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getMe, updateMe, updateDunningConfig, type Tenant } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Dunning config state
  const [maxAttempts, setMaxAttempts] = useState(4);
  const [suspensionAction, setSuspensionAction] = useState("suspend");
  const [retryDays, setRetryDays] = useState([3, 7, 14, 21]);
  const [dunningSaved, setDunningSaved] = useState(false);
  const [dunningError, setDunningError] = useState("");

  useEffect(() => {
    getMe()
      .then((res) => {
        setTenant(res.data);
        setName(res.data.name ?? "");
        setEmail(res.data.email ?? "");
        if (res.data.dunning_config) {
          const cfg = res.data.dunning_config;
          setMaxAttempts(cfg.max_attempts ?? 4);
          setSuspensionAction(cfg.suspension_action ?? "suspend");
          setRetryDays(cfg.retry_intervals_days ?? [3, 7, 14, 21]);
        }
      })
      .catch(() => {});
  }, []);

  const save = useMutation({
    mutationFn: () => updateMe(name, email),
    onSuccess: (res) => {
      setTenant(res.data);
      setSaved(true);
      setSaveError("");
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e: unknown) =>
      setSaveError(e instanceof Error ? e.message : "Failed to save changes"),
  });

  const saveDunning = useMutation({
    mutationFn: () =>
      updateDunningConfig({
        retry_intervals_days: retryDays,
        max_attempts: maxAttempts,
        suspension_action: suspensionAction,
        notify_customer: true,
        notify_merchant: true,
        smart_retry: true,
      }),
    onSuccess: (res) => {
      setTenant(res.data);
      setDunningSaved(true);
      setDunningError("");
      setTimeout(() => setDunningSaved(false), 2500);
    },
    onError: (e: unknown) =>
      setDunningError(
        e instanceof Error ? e.message : "Failed to save dunning config",
      ),
  });

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
      /* proceed */
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("email_verified");
      localStorage.removeItem("pending_email");
      router.push("/login");
    }
  };

  const retryDayOptions = [
    {
      label: "Day 3, 7, 14, 21 (Nigerian payday schedule)",
      value: [3, 7, 14, 21],
    },
    { label: "Day 7, 14, 21, 28 (term payment cycle)", value: [7, 14, 21, 28] },
    { label: "Day 3, 5, 10, 15 (aggressive)", value: [3, 5, 10, 15] },
    { label: "Day 7, 14 (lenient)", value: [7, 14] },
  ];

  const currentScheduleLabel =
    retryDayOptions.find(
      (o) => JSON.stringify(o.value) === JSON.stringify(retryDays),
    )?.label ?? `Custom: Day ${retryDays.join(", ")}`;

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1
          className="text-xl lg:text-2xl font-extrabold"
          style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
        >
          Settings
        </h1>
        <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
          Manage your account and billing preferences
        </p>
      </div>

      {/* Account details */}
      <div
        className="bg-white border rounded-xl mb-4"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            Account details
          </h2>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-extrabold flex-shrink-0"
              style={{ background: "#E6F8F2", color: "#00B37E" }}
            >
              {name?.slice(0, 2).toUpperCase() ?? "T"}
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: "#0F1728" }}>
                {tenant?.name ?? "..."}
              </p>
              <p className="text-sm font-medium" style={{ color: "#8A94A6" }}>
                {tenant?.email ?? "..."}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label
                className="text-xs font-semibold block mb-1.5"
                style={{ color: "#4B5563" }}
              >
                Business name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
                style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
              />
            </div>
            <div>
              <label
                className="text-xs font-semibold block mb-1.5"
                style={{ color: "#4B5563" }}
              >
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
                style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
              />
            </div>
          </div>
          {saveError && (
            <p
              className="text-xs font-medium mb-3"
              style={{ color: "#DC2626" }}
            >
              {saveError}
            </p>
          )}
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="text-sm px-4 py-2 rounded-lg font-bold text-white"
            style={{
              background: saved
                ? "#00B37E"
                : save.isPending
                  ? "#9CA3AF"
                  : "#0F1728",
            }}
          >
            {saved ? "Saved" : save.isPending ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {/* Dunning config */}
      <div
        className="bg-white border rounded-xl mb-4"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            Dunning configuration
          </h2>
        </div>
        <div className="p-5">
          <p className="text-sm font-medium mb-4" style={{ color: "#6B7280" }}>
            Configure how Tori handles failed payments for your subscriptions.
            Changes apply to all future dunning cycles.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label
                className="text-xs font-semibold block mb-1.5"
                style={{ color: "#4B5563" }}
              >
                Max retry attempts
              </label>
              <select
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(parseInt(e.target.value))}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
                style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
              >
                <option value={4}>4 attempts (recommended)</option>
                <option value={3}>3 attempts</option>
                <option value={2}>2 attempts</option>
                <option value={1}>1 attempt</option>
              </select>
            </div>
            <div>
              <label
                className="text-xs font-semibold block mb-1.5"
                style={{ color: "#4B5563" }}
              >
                After retries exhausted
              </label>
              <select
                value={suspensionAction}
                onChange={(e) => setSuspensionAction(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
                style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
              >
                <option value="suspend">Suspend subscription</option>
                <option value="cancel">Cancel subscription</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label
                className="text-xs font-semibold block mb-1.5"
                style={{ color: "#4B5563" }}
              >
                Retry schedule
              </label>
              <select
                value={JSON.stringify(retryDays)}
                onChange={(e) => setRetryDays(JSON.parse(e.target.value))}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
                style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
              >
                {retryDayOptions.map((o) => (
                  <option key={o.label} value={JSON.stringify(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className="rounded-lg p-3.5 mb-4"
            style={{ background: "#F8F9FA" }}
          >
            <p
              className="text-xs font-semibold mb-2"
              style={{ color: "#4B5563" }}
            >
              Current retry schedule
            </p>
            <div className="flex flex-wrap gap-2 mb-1">
              {retryDays.map((d) => (
                <span
                  key={d}
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "#E6F8F2", color: "#0A7A56" }}
                >
                  Day {d}
                </span>
              ))}
            </div>
            <p
              className="text-[11px] font-medium mt-2"
              style={{ color: "#9CA3AF" }}
            >
              {currentScheduleLabel}
            </p>
          </div>

          {dunningError && (
            <p
              className="text-xs font-medium mb-3"
              style={{ color: "#DC2626" }}
            >
              {dunningError}
            </p>
          )}
          <button
            onClick={() => saveDunning.mutate()}
            disabled={saveDunning.isPending}
            className="text-sm px-4 py-2 rounded-lg font-bold text-white"
            style={{
              background: dunningSaved
                ? "#00B37E"
                : saveDunning.isPending
                  ? "#9CA3AF"
                  : "#0F1728",
            }}
          >
            {dunningSaved
              ? "Saved"
              : saveDunning.isPending
                ? "Saving..."
                : "Save dunning config"}
          </button>
        </div>
      </div>

      {/* Nomba integration */}
      <div
        className="bg-white border rounded-xl mb-4"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#0F1728" }}>
            Nomba integration
          </h2>
        </div>
        <div className="p-5">
          <div
            className="rounded-lg p-4 flex items-start gap-3"
            style={{ background: "#E6F8F2" }}
          >
            <i
              className="ti ti-check flex-shrink-0"
              style={{ fontSize: 18, color: "#00B37E" }}
            />
            <div>
              <p
                className="text-sm font-bold mb-1"
                style={{ color: "#0F1728" }}
              >
                Nomba sandbox connected
              </p>
              <p className="text-xs font-medium" style={{ color: "#6B7280" }}>
                Your account is integrated with Nomba sandbox. Checkout,
                tokenised card charging, refunds, and reconciliation are active.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div
        className="bg-white border rounded-xl"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#DC2626" }}>
            Danger zone
          </h2>
        </div>
        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              Log out
            </p>
            <p
              className="text-xs font-medium mt-0.5"
              style={{ color: "#8A94A6" }}
            >
              Sign out of your Tori account.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm px-4 py-2 rounded-lg font-bold border flex-shrink-0"
            style={{ borderColor: "#FDCACA", color: "#DC2626" }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

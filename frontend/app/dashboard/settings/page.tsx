"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { getMe, updateMe, logout, type Tenant } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    getMe()
      .then((res) => {
        setTenant(res.data);
        setName(res.data.name ?? "");
        setEmail(res.data.email ?? "");
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
    onError: (e: unknown) => {
      setSaveError(e instanceof Error ? e.message : "Failed to save changes");
    },
  });

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1
          className="text-2xl font-extrabold"
          style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
        >
          Settings
        </h1>
        <p className="text-sm font-medium mt-0.5" style={{ color: "#8A94A6" }}>
          Manage your account and billing preferences
        </p>
      </div>

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
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-extrabold"
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
          <div className="grid grid-cols-2 gap-4 mb-4">
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
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label
                className="text-xs font-semibold block mb-1.5"
                style={{ color: "#4B5563" }}
              >
                Max retry attempts
              </label>
              <select
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
                style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
              >
                <option>4 attempts (recommended)</option>
                <option>3 attempts</option>
                <option>2 attempts</option>
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
                className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none font-medium border"
                style={{ borderColor: "#E5E7EB", color: "#0F1728" }}
              >
                <option>Suspend subscription</option>
                <option>Cancel subscription</option>
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
            <div className="flex gap-2">
              {["Day 3", "Day 7", "Day 14", "Day 21"].map((d) => (
                <span
                  key={d}
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "#E6F8F2", color: "#0A7A56" }}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

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
            style={{ background: "#FFF8E1" }}
          >
            <i
              className="ti ti-clock"
              style={{ fontSize: 18, color: "#B8860B", flexShrink: 0 }}
            />
            <div>
              <p
                className="text-sm font-bold mb-1"
                style={{ color: "#0F1728" }}
              >
                Payment integration pending
              </p>
              <p className="text-xs font-medium" style={{ color: "#8A94A6" }}>
                Connect your Nomba account to enable real card charging,
                tokenisation, and live payment processing. Currently running in
                demo mode.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        className="bg-white border rounded-xl"
        style={{ borderColor: "#EAECEF" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#F0F2F4" }}>
          <h2 className="text-sm font-bold" style={{ color: "#DC2626" }}>
            Danger zone
          </h2>
        </div>
        <div className="p-5 flex items-center justify-between">
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
            className="text-sm px-4 py-2 rounded-lg font-bold border"
            style={{ borderColor: "#FDCACA", color: "#DC2626" }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

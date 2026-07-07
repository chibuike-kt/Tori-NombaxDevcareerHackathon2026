"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatKobo, formatDate } from "@/lib/utils";
import { portalFetch, resolvePortalToken, type PortalInvoice } from "@/lib/portal-api";
import { downloadInvoicePDF, type DownloadableInvoice } from "@/lib/invoice-pdf";
import { PortalNav, PortalFooter } from "@/components/portal-nav";

type Filter = "ALL" | "PAID" | "UNPAID";

function statusStyle(status: string) {
  switch (status) {
    case "paid":
      return { bg: "#E3F7EF", color: "#0A7A56" };
    case "open":
      return { bg: "#EEF2FF", color: "#4338CA" };
    case "void":
      return { bg: "#F1F3F5", color: "#6B7280" };
    case "uncollectible":
      return { bg: "#FDECEC", color: "#A32D2D" };
    default:
      return { bg: "#F1F3F5", color: "#6B7280" };
  }
}

export default function PortalInvoicesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState("");
  const [invoices, setInvoices] = useState<PortalInvoice[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const t = resolvePortalToken(params.get("token"));
    if (!t) {
      router.replace("/portal/login");
      return;
    }
    setToken(t);
    portalFetch<PortalInvoice[]>("/v1/portal/invoices", t)
      .then((res) => setInvoices((res as { data: PortalInvoice[] }).data ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load invoices"));
  }, [params, router]);

  const download = async (id: string) => {
    setDownloading(id);
    try {
      const res = await portalFetch<DownloadableInvoice>(`/v1/portal/invoices/${id}/download`, token);
      await downloadInvoicePDF((res as { data: DownloadableInvoice }).data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate PDF");
    } finally {
      setDownloading(null);
    }
  };

  const filtered = (invoices ?? []).filter((inv) => {
    if (filter === "PAID") return inv.status === "paid";
    if (filter === "UNPAID") return inv.status !== "paid";
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      <PortalNav token={token} />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-lg font-extrabold mb-5" style={{ color: "#0F1728" }}>
          Invoices
        </h1>

        {error && (
          <div className="rounded-lg px-4 py-3 mb-4 text-sm font-semibold" style={{ background: "#FEE2E2", color: "#991B1B" }}>
            {error}
          </div>
        )}

        <div className="flex gap-1 p-1 rounded-lg mb-4 w-fit" style={{ background: "#F1F3F5" }}>
          {(["ALL", "PAID", "UNPAID"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-xs font-bold px-3 py-1.5 rounded-md"
              style={{
                background: filter === f ? "#fff" : "transparent",
                color: filter === f ? "#0F1728" : "#6B7280",
                boxShadow: filter === f ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {f === "ALL" ? "All" : f === "PAID" ? "Paid" : "Unpaid"}
            </button>
          ))}
        </div>

        {invoices === null ? (
          <div className="text-sm font-medium" style={{ color: "#8A94A6" }}>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border rounded-xl p-10 text-center" style={{ borderColor: "#EAECEF" }}>
            <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
              No invoices
            </p>
          </div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: "#EAECEF" }}>
            {filtered.map((inv, i) => {
              const s = statusStyle(inv.status);
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5"
                  style={{ borderTop: i > 0 ? "1px solid #F3F4F6" : undefined }}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold" style={{ color: "#0F1728" }}>
                      {inv.plan_name ?? "Subscription"}
                    </p>
                    <p className="text-[11px] font-medium" style={{ color: "#8A94A6" }}>
                      {formatDate(inv.due_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-bold" style={{ color: "#0F1728" }}>
                        {formatKobo(inv.amount)}
                      </p>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                        style={{ background: s.bg, color: s.color }}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <button
                      onClick={() => download(inv.id)}
                      disabled={downloading === inv.id}
                      title="Download PDF"
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "#F1F3F5", color: "#6B7280" }}
                    >
                      <i className={`ti ${downloading === inv.id ? "ti-loader-2" : "ti-download"}`} style={{ fontSize: 15 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <PortalFooter />
      </div>
    </div>
  );
}

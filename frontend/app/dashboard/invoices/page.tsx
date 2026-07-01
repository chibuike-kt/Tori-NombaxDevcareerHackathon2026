"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  getInvoices,
  getCustomers,
  getSubscriptions,
  getMe,
  type Invoice,
  type Customer,
  type Subscription,
} from "@/lib/api";
import { formatKobo, formatDate, formatDateTime, avatarFor } from "@/lib/utils";

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

function InvoiceModal({
  inv,
  cust,
  sub,
  tenantName,
  onClose,
}: {
  inv: Invoice;
  cust?: Customer;
  sub?: Subscription;
  tenantName: string;
  onClose: () => void;
}) {
  const s = statusStyle(inv.status);

const handleDownload = async () => {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const inv_short = inv.id.slice(0, 8).toUpperCase();

  // Colors
  const dark = [15, 23, 40];
  const green = [0, 179, 126];
  const gray = [138, 148, 166];
  const lightGray = [248, 249, 250];

  // Header bar
  doc.setFillColor(...(dark as [number, number, number]));
  doc.rect(0, 0, 210, 28, "F");

  // Logo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Tori", 15, 17);

  // Invoice label
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...(gray as [number, number, number]));
  doc.text("INVOICE", 168, 12);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(`#${inv_short}`, 168, 18);

  // Status badge
  const isPaid = inv.status === "paid";
  doc.setFillColor(isPaid ? 227 : 238, isPaid ? 247 : 242, isPaid ? 239 : 255);
  doc.roundedRect(160, 20, 35, 6, 2, 2, "F");
  doc.setTextColor(isPaid ? 10 : 67, isPaid ? 122 : 56, isPaid ? 86 : 202);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(inv.status.toUpperCase(), 177, 24.5, { align: "center" });

  // Amount
  doc.setTextColor(...(dark as [number, number, number]));
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  const amountStr = `NGN ${(inv.amount / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
  doc.text(amountStr, 15, 50);

  // From / To boxes
  doc.setFillColor(...(lightGray as [number, number, number]));
  doc.roundedRect(14, 58, 85, 28, 3, 3, "F");
  doc.roundedRect(111, 58, 85, 28, 3, 3, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...(gray as [number, number, number]));
  doc.text("FROM", 20, 65);
  doc.text("TO", 117, 65);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...(dark as [number, number, number]));
  doc.text("Tori", 20, 72);
  doc.text(tenantName.slice(0, 20), 117, 72);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...(gray as [number, number, number]));
  doc.text("Recurring Billing Infrastructure", 20, 78);
  doc.text((cust?.email ?? "—").slice(0, 28), 117, 78);

  // Details table
  let y = 98;
  const rows = [
    ["Invoice ID", inv.id],
    ["Subscription", sub?.id ?? inv.subscription_id],
    ["Currency", inv.currency],
    ["Due date", formatDate(inv.due_date)],
    ["Paid at", inv.paid_at ? formatDateTime(inv.paid_at) : "Unpaid"],
    ["Nomba reference", inv.nomba_charge_ref ?? "—"],
  ];

  doc.setFontSize(8);
  rows.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...(lightGray as [number, number, number]));
      doc.rect(14, y - 4, 182, 8, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...(gray as [number, number, number]));
    doc.text(label, 18, y);
    doc.setTextColor(...(dark as [number, number, number]));
    doc.setFont("helvetica", "normal");
    doc.text(value.slice(0, 55), 70, y);
    y += 9;
  });

  // Line items
  y += 6;
  doc.setFillColor(...(dark as [number, number, number]));
  doc.rect(14, y, 182, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Description", 18, y + 5.5);
  doc.text("Amount", 185, y + 5.5, { align: "right" });

  y += 10;
  doc.setFillColor(...(lightGray as [number, number, number]));
  doc.rect(14, y - 4, 182, 8, "F");
  doc.setTextColor(...(dark as [number, number, number]));
  doc.setFont("helvetica", "normal");
  doc.text("Subscription billing", 18, y);
  doc.text(
    `NGN ${(inv.amount / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
    185,
    y,
    { align: "right" },
  );

  y += 10;
  doc.setFillColor(...(green as [number, number, number]));
  doc.rect(14, y - 4, 182, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Total", 18, y + 1.5);
  doc.text(
    `NGN ${(inv.amount / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
    185,
    y + 1.5,
    { align: "right" },
  );

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...(gray as [number, number, number]));
  doc.text(
    `Generated by Tori · ${new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}`,
    105,
    285,
    { align: "center" },
  );

  doc.save(`tori-invoice-${inv_short}.pdf`);
};

  const handlePrint = () => {
    const html = generateInvoiceHTML(inv, cust, sub, tenantName);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: "#F0F2F4" }}
        >
          <div>
            <h2
              className="text-base font-extrabold"
              style={{ color: "#0F1728" }}
            >
              Invoice
            </h2>
            <p
              className="text-xs font-mono mt-0.5"
              style={{ color: "#9CA3AF" }}
            >
              {inv.id}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ color: "#9CA3AF", cursor: "pointer" }}
          >
            <i className="ti ti-x" style={{ fontSize: 20 }} />
          </button>
        </div>

        {/* Invoice body */}
        <div className="p-5">
          {/* Status + amount */}
          <div className="flex items-center justify-between mb-5">
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: s.bg, color: s.color }}
            >
              {inv.status.toUpperCase()}
            </span>
            <span
              className="text-2xl font-extrabold"
              style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
            >
              {formatKobo(inv.amount)}
            </span>
          </div>

          {/* From / To */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="rounded-xl p-4" style={{ background: "#F8F9FA" }}>
              <p
                className="text-[10px] font-semibold mb-2"
                style={{ color: "#9CA3AF" }}
              >
                FROM
              </p>
              <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
                Tori
              </p>
              <p
                className="text-xs font-medium mt-0.5"
                style={{ color: "#6B7280" }}
              >
                Recurring Billing Infrastructure
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "#F8F9FA" }}>
              <p
                className="text-[10px] font-semibold mb-2"
                style={{ color: "#9CA3AF" }}
              >
                TO
              </p>
              <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
                {tenantName}
              </p>
              <p
                className="text-xs font-medium mt-0.5"
                style={{ color: "#6B7280" }}
              >
                {cust?.email ?? "—"}
              </p>
            </div>
          </div>

          {/* Details */}
          <div
            className="rounded-xl overflow-hidden mb-5"
            style={{ border: "1px solid #EAECEF" }}
          >
            <table className="w-full">
              <tbody>
                {[
                  ["Invoice ID", inv.id.slice(0, 16) + "..."],
                  [
                    "Subscription",
                    sub
                      ? sub.id.slice(0, 16) + "..."
                      : inv.subscription_id.slice(0, 16) + "...",
                  ],
                  ["Currency", inv.currency],
                  ["Due date", formatDate(inv.due_date)],
                  [
                    "Paid at",
                    inv.paid_at ? formatDateTime(inv.paid_at) : "Unpaid",
                  ],
                  ["Nomba ref", inv.nomba_charge_ref ?? "—"],
                ].map(([label, value]) => (
                  <tr key={label} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td
                      className="px-4 py-2.5 text-xs font-semibold"
                      style={{ color: "#9CA3AF", width: "40%" }}
                    >
                      {label}
                    </td>
                    <td
                      className="px-4 py-2.5 text-xs font-medium font-mono"
                      style={{ color: "#0F1728" }}
                    >
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Line items */}
          <div
            className="rounded-xl overflow-hidden mb-5"
            style={{ border: "1px solid #EAECEF" }}
          >
            <div
              className="px-4 py-3"
              style={{
                background: "#FAFBFC",
                borderBottom: "1px solid #EAECEF",
              }}
            >
              <p
                className="text-[11px] font-semibold"
                style={{ color: "#9CA3AF" }}
              >
                LINE ITEMS
              </p>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium"
                  style={{ color: "#4B5563" }}
                >
                  Subscription billing
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ color: "#0F1728" }}
                >
                  {formatKobo(inv.amount)}
                </span>
              </div>
            </div>
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ background: "#F8F9FA", borderTop: "1px solid #EAECEF" }}
            >
              <span className="text-xs font-bold" style={{ color: "#0F1728" }}>
                Total
              </span>
              <span
                className="text-sm font-extrabold"
                style={{ color: "#0F1728" }}
              >
                {formatKobo(inv.amount)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
              style={{ background: "#0F1728", cursor: "pointer" }}
            >
              <i className="ti ti-printer" style={{ fontSize: 16 }} />
              Print / Save PDF
            </button>
            <button
              onClick={handleDownload}
              className="py-2.5 px-4 rounded-xl text-sm font-bold border flex items-center gap-2"
              style={{
                borderColor: "#E5E7EB",
                color: "#4B5563",
                cursor: "pointer",
              }}
            >
              <i className="ti ti-download" style={{ fontSize: 16 }} />
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function generateInvoiceHTML(
  inv: Invoice,
  cust?: Customer,
  sub?: Subscription,
  tenantName = "Tori Customer",
) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${inv.id.slice(0, 8)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0F1728; background: #fff; padding: 48px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
    .logo { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
    .logo span { color: #00B37E; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; background: ${inv.status === "paid" ? "#E3F7EF" : "#EEF2FF"}; color: ${inv.status === "paid" ? "#0A7A56" : "#4338CA"}; }
    .amount { font-size: 36px; font-weight: 900; letter-spacing: -1px; margin: 8px 0 32px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .card { background: #F8F9FA; border-radius: 12px; padding: 16px; }
    .card-label { font-size: 10px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .card-name { font-size: 14px; font-weight: 700; }
    .card-sub { font-size: 12px; color: #6B7280; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { text-align: left; padding: 10px 16px; font-size: 11px; color: #9CA3AF; font-weight: 600; background: #FAFBFC; border-bottom: 1px solid #EAECEF; }
    td { padding: 10px 16px; font-size: 12px; border-bottom: 1px solid #F3F4F6; }
    .total-row td { font-weight: 700; background: #F8F9FA; font-size: 14px; }
    .footer { margin-top: 48px; font-size: 11px; color: #9CA3AF; border-top: 1px solid #F3F4F6; padding-top: 16px; }
    @media print { body { padding: 24px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Tori<span>.</span></div>
    <span class="badge">${inv.status.toUpperCase()}</span>
  </div>
  <div class="amount">${(inv.amount / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN" })}</div>
  <div class="grid">
    <div class="card">
      <div class="card-label">From</div>
      <div class="card-name">Tori</div>
      <div class="card-sub">Recurring Billing Infrastructure</div>
    </div>
    <div class="card">
      <div class="card-label">To</div>
      <div class="card-name">${tenantName}</div>
      <div class="card-sub">${cust?.email ?? "—"}</div>
    </div>
  </div>
  <table>
    <tr><th>Field</th><th>Value</th></tr>
    <tr><td>Invoice ID</td><td style="font-family:monospace">${inv.id}</td></tr>
    <tr><td>Subscription</td><td style="font-family:monospace">${sub?.id ?? inv.subscription_id}</td></tr>
    <tr><td>Currency</td><td>${inv.currency}</td></tr>
    <tr><td>Due date</td><td>${formatDate(inv.due_date)}</td></tr>
    <tr><td>Paid at</td><td>${inv.paid_at ? formatDate(inv.paid_at) : "Unpaid"}</td></tr>
    <tr><td>Nomba reference</td><td style="font-family:monospace">${inv.nomba_charge_ref ?? "—"}</td></tr>
  </table>
  <table>
    <tr><th>Description</th><th style="text-align:right">Amount</th></tr>
    <tr>
      <td>Subscription billing</td>
      <td style="text-align:right">${(inv.amount / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN" })}</td>
    </tr>
    <tr class="total-row">
      <td>Total</td>
      <td style="text-align:right">${(inv.amount / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN" })}</td>
    </tr>
  </table>
  <div class="footer">
    Generated by Tori — Recurring billing infrastructure for Nomba · ${new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
  </div>
</body>
</html>`;
}

export default function InvoicesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: () => getInvoices(statusFilter || undefined),
  });
  const { data: customersData } = useQuery({
    queryKey: ["customers", 100],
    queryFn: () => getCustomers(100),
  });
  const { data: subsData } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: getSubscriptions,
  });
  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });

  const invoices = invoicesData?.data ?? [];
  const customers = customersData?.data ?? [];
  const subs = subsData?.data ?? [];
  const tenantName = meData?.data?.name ?? "Tori Customer";

  const custById = new Map(customers.map((c) => [c.id, c]));
  const subById = new Map(subs.map((s) => [s.id, s]));

  const statuses = ["", "open", "paid", "void", "uncollectible"];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {selectedInvoice && (
        <InvoiceModal
          inv={selectedInvoice}
          cust={custById.get(selectedInvoice.customer_id)}
          sub={subById.get(selectedInvoice.subscription_id)}
          tenantName={tenantName}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1
            className="text-xl lg:text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            Invoices
          </h1>
          <p
            className="text-sm font-medium mt-0.5"
            style={{ color: "#8A94A6" }}
          >
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold"
            style={{
              background: statusFilter === s ? "#0F1728" : "#fff",
              color: statusFilter === s ? "#fff" : "#6B7280",
              border: `1px solid ${statusFilter === s ? "#0F1728" : "#E5E7EB"}`,
              cursor: "pointer",
            }}
          >
            {s === "" ? "ALL" : s.toUpperCase()}
          </button>
        ))}
      </div>

      <div
        className="bg-white border rounded-xl"
        style={{ borderColor: "#EAECEF" }}
      >
        {isLoading ? (
          <div
            className="p-12 text-center text-sm font-medium"
            style={{ color: "#8A94A6" }}
          >
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#F1F3F5", color: "#9CA3AF" }}
            >
              <i className="ti ti-receipt" style={{ fontSize: 22 }} />
            </div>
            <p className="text-sm font-bold mb-1" style={{ color: "#0F1728" }}>
              No invoices yet
            </p>
            <p
              className="text-xs font-medium mb-4"
              style={{ color: "#8A94A6" }}
            >
              Invoices are generated automatically when a subscription charge
              succeeds.
            </p>
            <Link
              href="/dashboard/subscriptions"
              className="text-sm font-bold"
              style={{ color: "#00B37E" }}
            >
              View subscriptions →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr
                  style={{
                    background: "#FAFBFC",
                    borderBottom: "0.5px solid #EAECEF",
                  }}
                >
                  {[
                    "Customer",
                    "Subscription",
                    "Amount",
                    "Status",
                    "Due date",
                    "Paid at",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-[11px] font-semibold"
                      style={{ color: "#98A2B3" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: Invoice) => {
                  const cust = custById.get(inv.customer_id);
                  const sub = subById.get(inv.subscription_id);
                  const av = avatarFor(cust?.email ?? inv.customer_id);
                  const s = statusStyle(inv.status);
                  return (
                    <tr
                      key={inv.id}
                      style={{
                        borderTop: "0.5px solid #F2F4F6",
                        cursor: "pointer",
                      }}
                      className="hover:bg-gray-50 transition-colors"
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{ background: av.bg, color: av.color }}
                          >
                            {av.initials}
                          </span>
                          <span
                            className="text-xs font-semibold truncate max-w-[120px]"
                            style={{ color: "#1F2733" }}
                          >
                            {cust?.email ?? "Unknown"}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 text-xs font-mono"
                        style={{ color: "#98A2B3" }}
                      >
                        {sub
                          ? sub.id.slice(0, 8) + "..."
                          : inv.subscription_id.slice(0, 8) + "..."}
                      </td>
                      <td
                        className="px-4 py-3 text-xs font-bold"
                        style={{ color: "#0F1728" }}
                      >
                        {formatKobo(inv.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: s.bg, color: s.color }}
                        >
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-xs font-medium"
                        style={{ color: "#4B5563" }}
                      >
                        {formatDate(inv.due_date)}
                      </td>
                      <td
                        className="px-4 py-3 text-xs font-medium"
                        style={{ color: inv.paid_at ? "#00B37E" : "#C4CACD" }}
                      >
                        {inv.paid_at ? formatDate(inv.paid_at) : "Unpaid"}
                      </td>
                      <td className="px-4 py-3">
                        <i
                          className="ti ti-chevron-right"
                          style={{ fontSize: 14, color: "#C4CACD" }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

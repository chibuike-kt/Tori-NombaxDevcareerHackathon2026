"use client";

export default function InvoicesPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-extrabold"
            style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
          >
            Invoices
          </h1>
          <p
            className="text-sm font-medium mt-0.5"
            style={{ color: "#8A94A6" }}
          >
            All billing invoices across your subscriptions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          ["Total invoiced", "₦0", "#0F1728"],
          ["Paid", "₦0", "#00A36C"],
          ["Outstanding", "₦0", "#B8860B"],
        ].map(([label, val, color]) => (
          <div
            key={label}
            className="bg-white border rounded-xl p-5"
            style={{ borderColor: "#EAECEF" }}
          >
            <p
              className="text-xs font-semibold mb-2"
              style={{ color: "#8A94A6" }}
            >
              {label}
            </p>
            <p
              className="text-2xl font-extrabold"
              style={{ color: color, letterSpacing: "-0.02em" }}
            >
              {val}
            </p>
          </div>
        ))}
      </div>

      <div
        className="bg-white border rounded-xl"
        style={{ borderColor: "#EAECEF" }}
      >
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: "#F0F2F4" }}
        >
          <span className="text-sm font-bold" style={{ color: "#0F1728" }}>
            Invoice history
          </span>
          <div className="flex gap-2">
            {["All", "Paid", "Open", "Void"].map((f) => (
              <button
                key={f}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border"
                style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr
              style={{
                background: "#FAFBFC",
                borderBottom: "0.5px solid #EAECEF",
              }}
            >
              {[
                "Invoice ID",
                "Customer",
                "Amount",
                "Status",
                "Due date",
                "Actions",
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
            <tr>
              <td colSpan={6} className="px-4 py-14 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: "#F1F3F5", color: "#9CA3AF" }}
                >
                  <i className="ti ti-receipt" style={{ fontSize: 22 }} />
                </div>
                <p className="text-sm font-bold" style={{ color: "#0F1728" }}>
                  No invoices yet
                </p>
                <p
                  className="text-xs font-medium mt-1"
                  style={{ color: "#8A94A6" }}
                >
                  Invoices are generated automatically when subscriptions are
                  charged.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

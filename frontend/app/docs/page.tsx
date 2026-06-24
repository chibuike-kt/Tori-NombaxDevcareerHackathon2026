"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { TABS, type Block } from "@/lib/docs-data";

function InlineText({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded text-[13px] font-mono"
            style={{ background: "#F1F3F5", color: "#0F6E56" }}
          >
            {part}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "p":
      return (
        <p
          className="text-base mb-4 font-medium leading-relaxed"
          style={{ color: "#4B5563" }}
        >
          <InlineText text={block.text} />
        </p>
      );
    case "h2":
      return (
        <h2
          id={block.id}
          className="text-2xl font-extrabold mt-10 mb-3 scroll-mt-32"
          style={{ color: "#0F1728" }}
        >
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3
          className="text-lg font-bold mt-6 mb-2"
          style={{ color: "#0F1728" }}
        >
          {block.text}
        </h3>
      );
    case "code":
      return (
        <pre
          className="rounded-xl p-4 mb-5 overflow-x-auto text-[13px] font-mono leading-relaxed"
          style={{ background: "#0F1728", color: "#E5E7EB" }}
        >
          <code>{block.code}</code>
        </pre>
      );
    case "callout": {
      const colors = {
        info: ["#E6F1FB", "#185FA5"],
        warn: ["#FAEEDA", "#854F0B"],
        success: ["#E6F8F2", "#0F6E56"],
      }[block.variant ?? "info"];
      const icon = {
        info: "ti-info-circle",
        warn: "ti-alert-triangle",
        success: "ti-bulb",
      }[block.variant ?? "info"];
      return (
        <div
          className="rounded-xl p-4 mb-5 flex gap-3"
          style={{ background: colors[0] }}
        >
          <i
            className={`ti ${icon}`}
            style={{ fontSize: 20, color: colors[1], flexShrink: 0 }}
          />
          <p className="text-sm font-medium" style={{ color: colors[1] }}>
            <InlineText text={block.text} />
          </p>
        </div>
      );
    }
    case "table":
      return (
        <div
          className="rounded-xl border overflow-x-auto mb-5"
          style={{ borderColor: "#E5E7EB" }}
        >
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr style={{ background: "#F8F9FA" }}>
                {block.headers.map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 font-bold"
                    style={{ color: "#0F1728" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} style={{ borderTop: "1px solid #E5E7EB" }}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="px-4 py-2.5 font-medium"
                      style={{ color: "#4B5563" }}
                    >
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "list":
      return (
        <ul className="mb-5 space-y-2">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="flex gap-2.5 text-base font-medium"
              style={{ color: "#4B5563" }}
            >
              <i
                className="ti ti-point-filled"
                style={{ fontSize: 18, color: "#00B37E", flexShrink: 0 }}
              />
              <span>
                <InlineText text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
  }
}

export default function DocsPage() {
  const [search, setSearch] = useState("");
  const [activeTabId, setActiveTabId] = useState(TABS[0].id);
  const [activeSectionId, setActiveSectionId] = useState(
    TABS[0].groups[0].items[0].id,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeTab = useMemo(
    () => TABS.find((t) => t.id === activeTabId)!,
    [activeTabId],
  );
  const activeSection = useMemo(() => {
    for (const g of activeTab.groups) {
      const found = g.items.find((s) => s.id === activeSectionId);
      if (found) return found;
    }
    return activeTab.groups[0].items[0];
  }, [activeTab, activeSectionId]);

  const toc = activeSection.blocks.filter((b) => b.type === "h2") as Extract<
    Block,
    { type: "h2" }
  >[];

  const switchTab = (tabId: string) => {
    const tab = TABS.find((t) => t.id === tabId)!;
    setActiveTabId(tabId);
    setActiveSectionId(tab.groups[0].items[0].id);
  };

  const handleSectionClick = (id: string) => {
    setActiveSectionId(id);
    setSidebarOpen(false);
  };

  return (
    <div>
      <div
        className="text-center py-2.5 text-sm font-semibold"
        style={{ background: "#00B37E", color: "white" }}
      >
        <i className="ti ti-sparkles mr-1" /> Try the Tori API instantly.{" "}
        <span className="underline cursor-pointer">See how →</span>
      </div>

      <nav
        className="border-b sticky top-0 z-40 bg-white"
        style={{ borderColor: "#F0F0F0" }}
      >
        <div className="flex items-center gap-3 px-4 lg:px-8 py-3.5">
          {/* Mobile sidebar toggle */}
          <button
            className="lg:hidden p-1.5 rounded-lg flex-shrink-0"
            onClick={() => setSidebarOpen(true)}
            style={{ color: "#0F1728" }}
          >
            <i className="ti ti-menu-2" style={{ fontSize: 20 }} />
          </button>
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "#0F1728" }}
            >
              <svg viewBox="0 0 14 14" className="w-3.5 h-3.5">
                <path
                  d="M7 1L11.5 3.75V8.25L7 11L2.5 8.25V3.75L7 1Z"
                  fill="#00B37E"
                />
              </svg>
            </div>
            <span
              className="text-xl font-extrabold tracking-tight"
              style={{ color: "#0F1728" }}
            >
              Tori
            </span>
          </Link>
          <div className="flex-1 max-w-xl mx-auto hidden sm:block">
            <div
              className="flex items-center gap-2 rounded-lg px-3.5 py-2 border"
              style={{ background: "#F8F9FA", borderColor: "#E5E7EB" }}
            >
              <i
                className="ti ti-search"
                style={{ fontSize: 16, color: "#9CA3AF" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent outline-none text-sm font-medium"
                style={{ color: "#0F1728" }}
              />
              <span
                className="text-xs font-semibold px-1.5 py-0.5 rounded border hidden lg:block"
                style={{ color: "#9CA3AF", borderColor: "#E5E7EB" }}
              >
                Ctrl K
              </span>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm px-3 lg:px-4 py-2 rounded-lg font-bold text-white flex-shrink-0"
            style={{ background: "#0F1728" }}
          >
            <span className="hidden sm:inline">Dashboard</span>
            <i className="ti ti-chevron-right" style={{ fontSize: 14 }} />
          </Link>
        </div>
        <div className="flex gap-4 lg:gap-7 px-4 lg:px-8 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className="pb-3 text-sm font-semibold whitespace-nowrap flex-shrink-0"
              style={{
                color: tab.id === activeTabId ? "#0F1728" : "#6B7280",
                borderBottom:
                  tab.id === activeTabId
                    ? "2px solid #00B37E"
                    : "2px solid transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-72 bg-white h-full overflow-y-auto py-6 px-4 z-10">
            <div className="flex items-center justify-between mb-4 px-2">
              <span className="text-sm font-bold" style={{ color: "#0F1728" }}>
                Navigation
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{ color: "#6B7280" }}
              >
                <i className="ti ti-x" style={{ fontSize: 18 }} />
              </button>
            </div>
            {activeTab.groups.map((section) => (
              <div key={section.group} className="mb-6">
                <p
                  className="text-xs font-bold uppercase tracking-wider mb-2 px-2"
                  style={{ color: "#9CA3AF" }}
                >
                  {section.group}
                </p>
                {section.items.map((item) => {
                  const active = item.id === activeSectionId;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSectionClick(item.id)}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm font-medium mb-0.5 w-full text-left"
                      style={{
                        background: active ? "#E6F8F2" : "transparent",
                        color: active ? "#00B37E" : "#4B5563",
                      }}
                    >
                      <i
                        className={`ti ${item.icon}`}
                        style={{ fontSize: 15 }}
                      />{" "}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>
        </div>
      )}

      <div className="flex max-w-7xl mx-auto">
        {/* Desktop sidebar */}
        <aside
          className="hidden lg:block w-64 flex-shrink-0 border-r py-6 px-4 h-[calc(100vh-110px)] overflow-y-auto sticky top-[110px]"
          style={{ borderColor: "#F0F0F0" }}
        >
          {activeTab.groups.map((section) => (
            <div key={section.group} className="mb-6">
              <p
                className="text-xs font-bold uppercase tracking-wider mb-2 px-2"
                style={{ color: "#9CA3AF" }}
              >
                {section.group}
              </p>
              {section.items.map((item) => {
                const active = item.id === activeSectionId;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSectionId(item.id)}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm font-medium mb-0.5 w-full text-left"
                    style={{
                      background: active ? "#E6F8F2" : "transparent",
                      color: active ? "#00B37E" : "#4B5563",
                    }}
                  >
                    <i className={`ti ${item.icon}`} style={{ fontSize: 15 }} />{" "}
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        <main className="flex-1 px-4 lg:px-12 py-6 lg:py-8 min-w-0">
          <p className="text-sm font-bold mb-2" style={{ color: "#00B37E" }}>
            {activeTab.label}
          </p>
          <div className="flex items-start justify-between mb-2 gap-3">
            <h1
              className="text-2xl lg:text-4xl font-extrabold"
              style={{ color: "#0F1728", letterSpacing: "-0.02em" }}
            >
              {activeSection.label}
            </h1>
            <button
              className="flex items-center gap-1.5 text-sm px-3 lg:px-3.5 py-2 rounded-lg font-bold text-white flex-shrink-0"
              style={{ background: "#00B37E" }}
            >
              <i className="ti ti-sparkles" />{" "}
              <span className="hidden sm:inline">Open in Claude</span>
            </button>
          </div>
          <div className="mt-6 max-w-3xl">
            {activeSection.blocks.map((block, i) => (
              <BlockRenderer key={i} block={block} />
            ))}
          </div>
        </main>

        {/* TOC — desktop only */}
        <aside className="hidden xl:block w-56 flex-shrink-0 py-8 px-6 h-[calc(100vh-110px)] sticky top-[110px]">
          <p
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-3"
            style={{ color: "#9CA3AF" }}
          >
            <i className="ti ti-list" /> On this page
          </p>
          {toc.map((h) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              className="block text-sm font-medium py-1.5"
              style={{ color: "#6B7280" }}
            >
              {h.text}
            </a>
          ))}
        </aside>
      </div>

      <footer
        className="border-t mt-8"
        style={{ borderColor: "#F0F0F0", background: "#FAFAF8" }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 grid grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{ background: "#0F1728" }}
              >
                <svg viewBox="0 0 14 14" className="w-3.5 h-3.5">
                  <path
                    d="M7 1L11.5 3.75V8.25L7 11L2.5 8.25V3.75L7 1Z"
                    fill="#00B37E"
                  />
                </svg>
              </div>
              <span
                className="text-lg font-extrabold tracking-tight"
                style={{ color: "#0F1728" }}
              >
                Tori
              </span>
            </div>
            <p className="text-sm font-medium" style={{ color: "#6B7280" }}>
              Recurring billing infrastructure for Nomba.
            </p>
          </div>
          {[
            ["Product", ["Plans", "Subscriptions", "Dunning", "Ledger"]],
            [
              "Developers",
              ["Documentation", "API Reference", "Webhooks", "Changelog"],
            ],
            ["Use cases", ["SaaS billing", "Edtech fees", "Creator subs"]],
            ["Company", ["About", "Status", "Contact"]],
          ].map(([title, links]) => (
            <div key={title as string}>
              <p
                className="text-sm font-bold mb-3"
                style={{ color: "#0F1728" }}
              >
                {title}
              </p>
              {(links as string[]).map((link) => (
                <a
                  key={link}
                  href="#"
                  className="block text-sm font-medium py-1"
                  style={{ color: "#6B7280" }}
                >
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t" style={{ borderColor: "#F0F0F0" }}>
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5 flex flex-wrap gap-4 justify-between items-center">
            <span className="text-sm font-medium" style={{ color: "#9CA3AF" }}>
              2026 Tori · Built on Nomba · Nomba x DevCareer Hackathon 2026
            </span>
            <div className="flex gap-4">
              <a
                href="https://github.com/chibuike-kt"
                className="text-sm font-medium"
                style={{ color: "#9CA3AF" }}
              >
                GitHub
              </a>
              <a
                href="#"
                className="text-sm font-medium"
                style={{ color: "#9CA3AF" }}
              >
                Twitter
              </a>
            </div>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-6 right-6">
        <button
          className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg font-bold text-white text-sm"
          style={{ background: "#00B37E" }}
        >
          <i className="ti ti-message-circle" style={{ fontSize: 18 }} />
          <div className="text-left">
            <div>Chat with us</div>
            <div className="text-xs font-medium" style={{ opacity: 0.8 }}>
              AI assisted
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

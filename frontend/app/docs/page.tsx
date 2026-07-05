"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { TABS, type Block, type Section, type Group } from "@/lib/docs-data";

// ─── Inline code renderer ────────────────────────────────────────────────────
function InlineText({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="px-1.5 py-0.5 rounded text-[12px] font-mono" style={{ background: "#F1F3F5", color: "#0F6E56" }}>{part}</code>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ─── Method badge ─────────────────────────────────────────────────────────────
function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, [string, string]> = {
    GET:    ["#E3F7EF", "#00703C"],
    POST:   ["#FFF0E6", "#C05A00"],
    PUT:    ["#F3E8FF", "#6B21A8"],
    PATCH:  ["#EEF2FF", "#3730A3"],
    DELETE: ["#FEE2E2", "#991B1B"],
  };
  const [bg, fg] = colors[method] ?? ["#F3F4F6", "#374151"];
  return (
    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: bg, color: fg, letterSpacing: "0.05em" }}>
      {method}
    </span>
  );
}

// ─── Block renderer ───────────────────────────────────────────────────────────
function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "p":
      return <p className="text-[15px] mb-4 leading-relaxed" style={{ color: "#4B5563" }}><InlineText text={block.text} /></p>;

    case "h2":
      return (
        <h2 id={block.id} className="text-xl font-extrabold mt-10 mb-3 scroll-mt-32 pb-2" style={{ color: "#0F1728", borderBottom: "1px solid #F0F0F0" }}>
          {block.text}
        </h2>
      );

    case "h3":
      return <h3 className="text-[11px] font-extrabold uppercase tracking-widest mt-6 mb-3" style={{ color: "#9CA3AF" }}>{block.text}</h3>;

    case "code":
      return (
        <div className="rounded-xl mb-5 overflow-hidden border" style={{ borderColor: "#1E2A3A" }}>
          {block.lang && (
            <div className="flex items-center justify-between px-4 py-2" style={{ background: "#162030" }}>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6B8BAE" }}>{block.lang}</span>
              <button
                onClick={() => navigator.clipboard?.writeText(block.code)}
                className="text-[11px] font-semibold flex items-center gap-1 hover:text-white transition-colors"
                style={{ color: "#6B8BAE" }}
              >
                <i className="ti ti-copy" style={{ fontSize: 13 }} /> Copy
              </button>
            </div>
          )}
          <pre className="px-4 py-4 overflow-x-auto text-[13px] font-mono leading-relaxed" style={{ background: "#0F1728", color: "#E2E8F0" }}>
            <code>{block.code}</code>
          </pre>
        </div>
      );

    case "callout": {
      const cfg = {
        info:    { bg: "#EEF6FF", border: "#BFDBFE", fg: "#1E40AF", icon: "ti-info-circle" },
        warn:    { bg: "#FFFBEB", border: "#FDE68A", fg: "#92400E", icon: "ti-alert-triangle" },
        success: { bg: "#F0FDF4", border: "#BBF7D0", fg: "#166534", icon: "ti-bulb" },
      }[block.variant ?? "info"];
      return (
        <div className="rounded-xl p-4 mb-5 flex gap-3 border" style={{ background: cfg.bg, borderColor: cfg.border }}>
          <i className={`ti ${cfg.icon}`} style={{ fontSize: 18, color: cfg.fg, flexShrink: 0, marginTop: 1 }} />
          <p className="text-[13px] font-medium leading-relaxed" style={{ color: cfg.fg }}><InlineText text={block.text} /></p>
        </div>
      );
    }

    case "table":
      return (
        <div className="rounded-xl border overflow-x-auto mb-6" style={{ borderColor: "#E5E7EB" }}>
          <table className="w-full text-[13px] min-w-[400px]">
            <thead>
              <tr style={{ background: "#F8F9FA", borderBottom: "1px solid #E5E7EB" }}>
                {block.headers.map(h => (
                  <th key={h} className="text-left px-4 py-3 font-bold" style={{ color: "#0F1728" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} style={{ borderTop: i > 0 ? "1px solid #F3F4F6" : undefined }}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3" style={{ color: j === 0 ? "#0F1728" : "#4B5563", fontWeight: j === 0 ? 600 : 400 }}>
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
            <li key={i} className="flex gap-3 text-[14px]" style={{ color: "#4B5563" }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#E6F8F2" }}>
                <i className="ti ti-check" style={{ fontSize: 11, color: "#00B37E" }} />
              </div>
              <span className="leading-relaxed"><InlineText text={item} /></span>
            </li>
          ))}
        </ul>
      );

    case "param":
      return (
        <div className="border-b py-3.5" style={{ borderColor: "#F3F4F6" }}>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <code className="text-[13px] font-bold font-mono" style={{ color: "#0F1728" }}>{block.name}</code>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: "#F3F4F6", color: "#6B7280" }}>{block.paramType}</span>
            {block.required ? (
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "#FEE2E2", color: "#991B1B" }}>required</span>
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "#F3F4F6", color: "#9CA3AF" }}>optional</span>
            )}
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: "#6B7280" }}><InlineText text={block.description} /></p>
        </div>
      );

    case "response": {
      const first = String(block.status)[0];
      const statusCfg: Record<string, [string, string]> = {
        "2": ["#F0FDF4", "#166534"],
        "4": ["#FEF2F2", "#991B1B"],
        "5": ["#FFF7ED", "#9A3412"],
      };
      const [bg, fg] = statusCfg[first] ?? ["#F9FAFB", "#374151"];
      return (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded" style={{ background: bg, color: fg }}>{block.status}</span>
            <span className="text-[13px] font-semibold" style={{ color: "#6B7280" }}>{block.description}</span>
          </div>
          {block.body && (
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#1E2A3A" }}>
              <pre className="px-4 py-4 overflow-x-auto text-[13px] font-mono leading-relaxed" style={{ background: "#0F1728", color: "#E2E8F0" }}>
                <code>{block.body}</code>
              </pre>
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}

// ─── Sidebar component (defined outside DocsPage to avoid re-creation) ────────
function DocsSidebar({
  groups,
  activeSectionId,
  search,
  onSearch,
  onSelect,
}: {
  groups: Group[];
  activeSectionId: string;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (id: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups
      .map(g => ({
        ...g,
        items: g.items.filter(item =>
          item.label.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.items.length > 0);
  }, [groups, search]);

  return (
    <>
      <div className="px-3 mb-4">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 border" style={{ background: "#F8F9FA", borderColor: "#E5E7EB" }}>
          <i className="ti ti-search" style={{ fontSize: 14, color: "#9CA3AF" }} />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent outline-none text-[13px]"
            style={{ color: "#0F1728" }}
          />
        </div>
      </div>

      {filtered.map(group => (
        <div key={group.group} className="mb-5">
          <p className="text-[10px] font-extrabold uppercase tracking-widest mb-1.5 px-3" style={{ color: "#9CA3AF" }}>
            {group.group}
          </p>
          {group.items.map(item => {
            const active = item.id === activeSectionId;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] mb-0.5 w-full text-left transition-colors"
                style={{
                  background: active ? "#E6F8F2" : "transparent",
                  color: active ? "#00B37E" : "#4B5563",
                  fontWeight: active ? 700 : 500,
                }}
              >
                {item.method ? (
                  <MethodBadge method={item.method} />
                ) : (
                  <i className={`ti ${item.icon}`} style={{ fontSize: 14, flexShrink: 0 }} />
                )}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

// ─── Section content ──────────────────────────────────────────────────────────
function SectionContent({ section }: { section: Section & { groupLabel: string } }) {
  const methodBgColor: Record<string, string> = {
    GET: "#E3F7EF", POST: "#FFF0E6", PUT: "#F3E8FF", PATCH: "#EEF2FF", DELETE: "#FEE2E2",
  };
  const methodFgColor: Record<string, string> = {
    GET: "#00703C", POST: "#C05A00", PUT: "#6B21A8", PATCH: "#3730A3", DELETE: "#991B1B",
  };

  // Split blocks for two-column layout on API pages
  const hasMethod = !!section.method;
  const leftBlocks: Block[] = [];
  const rightBlocks: Block[] = [];

  if (hasMethod) {
    section.blocks.forEach(b => {
      if (b.type === "code" || b.type === "response") {
        rightBlocks.push(b);
      } else {
        leftBlocks.push(b);
      }
    });
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 pb-6" style={{ borderBottom: "1px solid #F0F0F0" }}>
        {section.groupLabel && (
          <p className="text-sm font-bold mb-1" style={{ color: "#00B37E" }}>{section.groupLabel}</p>
        )}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {section.method && (
            <span className="text-sm font-extrabold px-2.5 py-1 rounded-md" style={{
              background: methodBgColor[section.method] ?? "#F3F4F6",
              color: methodFgColor[section.method] ?? "#374151",
            }}>
              {section.method}
            </span>
          )}
          <h1 className="text-2xl lg:text-3xl font-extrabold" style={{ color: "#0F1728", letterSpacing: "-0.02em" }}>
            {section.label}
          </h1>
          <button className="ml-auto flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-bold text-white flex-shrink-0" style={{ background: "#00B37E" }}>
            <i className="ti ti-sparkles" style={{ fontSize: 14 }} />
            <span className="hidden sm:inline">Open in Claude</span>
          </button>
        </div>
        {section.endpoint && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl font-mono text-[13px]" style={{ background: "#F8F9FA", border: "1px solid #E5E7EB" }}>
            <span className="font-extrabold" style={{ color: methodFgColor[section.method ?? ""] ?? "#374151" }}>
              {section.method}
            </span>
            <span className="flex-1 truncate" style={{ color: "#0F1728" }}>{section.endpoint}</span>
            <button className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0" style={{ background: "#0F1728" }}>
              Try it <i className="ti ti-player-play" style={{ fontSize: 11 }} />
            </button>
          </div>
        )}
      </div>

      {/* Two-column or single-column */}
      {hasMethod && rightBlocks.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="min-w-0">
            {leftBlocks.map((block, i) => <BlockRenderer key={i} block={block} />)}
          </div>
          <div className="min-w-0">
            <div className="xl:sticky xl:top-32 space-y-4">
              {rightBlocks.map((block, i) => <BlockRenderer key={i} block={block} />)}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl">
          {section.blocks.map((block, i) => <BlockRenderer key={i} block={block} />)}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DocsPage() {
  const [search, setSearch] = useState("");
  const [activeTabId, setActiveTabId] = useState(TABS[0].id);
  const [activeSectionId, setActiveSectionId] = useState(TABS[0].groups[0].items[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeTab = TABS.find(t => t.id === activeTabId) ?? TABS[0];

  // Find active section and its group label without spreading in useMemo
  const activeSectionData = useMemo(() => {
    for (const g of activeTab.groups) {
      const found = g.items.find(s => s.id === activeSectionId);
      if (found) return { section: found, groupLabel: g.group };
    }
    return { section: activeTab.groups[0].items[0], groupLabel: activeTab.groups[0].group };
  }, [activeTab, activeSectionId]);

  const toc = useMemo(() =>
    activeSectionData.section.blocks.filter(b => b.type === "h2") as Extract<Block, { type: "h2" }>[],
    [activeSectionData.section]
  );

  const switchTab = (tabId: string) => {
    const tab = TABS.find(t => t.id === tabId) ?? TABS[0];
    setActiveTabId(tabId);
    setActiveSectionId(tab.groups[0].items[0].id);
    setSidebarOpen(false);
  };

  const handleSelect = (id: string) => {
    setActiveSectionId(id);
    setSidebarOpen(false);
  };

  // Inject groupLabel into section for SectionContent
  const sectionWithGroup = {
    ...activeSectionData.section,
    groupLabel: activeSectionData.groupLabel,
  };

  return (
    <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      {/* Top banner */}
      <div className="text-center py-2.5 text-[13px] font-semibold" style={{ background: "#00B37E", color: "white" }}>
        <i className="ti ti-sparkles mr-1.5" />
        Try the Tori API instantly — no account needed.{" "}
        <span className="underline cursor-pointer font-bold">See how →</span>
      </div>

      {/* Nav */}
      <nav className="border-b sticky top-0 z-40 bg-white" style={{ borderColor: "#F0F0F0" }}>
        <div className="flex items-center gap-3 px-4 lg:px-6 py-3">
          <button className="lg:hidden p-1.5 rounded-lg" onClick={() => setSidebarOpen(true)} style={{ color: "#0F1728" }}>
            <i className="ti ti-menu-2" style={{ fontSize: 20 }} />
          </button>
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <img src="/logo-light.svg" alt="Tori" className="h-7 w-auto" />
          </Link>
          <div className="flex-1 max-w-md mx-4 hidden lg:flex items-center gap-2 rounded-lg px-3 py-2 border" style={{ background: "#F8F9FA", borderColor: "#E5E7EB" }}>
            <i className="ti ti-search" style={{ fontSize: 14, color: "#9CA3AF" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search docs..."
              className="flex-1 bg-transparent outline-none text-[13px]"
              style={{ color: "#0F1728" }}
            />
            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded border" style={{ color: "#9CA3AF", borderColor: "#E5E7EB" }}>⌘K</span>
          </div>
          <Link href="/dashboard" className="flex items-center gap-1 text-sm px-4 py-2 rounded-lg font-bold text-white ml-auto flex-shrink-0" style={{ background: "#0F1728" }}>
            Dashboard <i className="ti ti-chevron-right" style={{ fontSize: 14 }} />
          </Link>
        </div>

        {/* Tab bar */}
        <div className="flex gap-6 px-4 lg:px-6 overflow-x-auto" style={{ borderTop: "1px solid #F8F9FA" }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className="pb-3 pt-1 text-[13px] font-semibold whitespace-nowrap flex-shrink-0"
              style={{
                color: tab.id === activeTabId ? "#0F1728" : "#6B7280",
                borderBottom: tab.id === activeTabId ? "2px solid #00B37E" : "2px solid transparent",
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
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 bg-white h-full overflow-y-auto pt-6 pb-8 z-10">
            <div className="flex items-center justify-between mb-4 px-3">
              <span className="text-sm font-bold" style={{ color: "#0F1728" }}>Navigation</span>
              <button onClick={() => setSidebarOpen(false)} style={{ color: "#6B7280" }}>
                <i className="ti ti-x" style={{ fontSize: 18 }} />
              </button>
            </div>
            <DocsSidebar
              groups={activeTab.groups}
              activeSectionId={activeSectionId}
              search={search}
              onSearch={setSearch}
              onSelect={handleSelect}
            />
          </aside>
        </div>
      )}

      {/* Body */}
      <div className="flex" style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Desktop sidebar */}
        <aside
          className="hidden lg:block flex-shrink-0 border-r overflow-y-auto pt-6 pb-8"
          style={{ width: 240, borderColor: "#F0F0F0", height: "calc(100vh - 106px)", position: "sticky", top: 106 }}
        >
          <DocsSidebar
            groups={activeTab.groups}
            activeSectionId={activeSectionId}
            search={search}
            onSearch={setSearch}
            onSelect={handleSelect}
          />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 lg:px-10 py-8">
          <SectionContent section={sectionWithGroup} />
        </main>

        {/* TOC */}
        <aside
          className="hidden xl:block flex-shrink-0 pt-8 px-6 overflow-y-auto"
          style={{ width: 200, height: "calc(100vh - 106px)", position: "sticky", top: 106 }}
        >
          {toc.length > 0 && (
            <>
              <p className="text-[10px] font-extrabold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "#9CA3AF" }}>
                <i className="ti ti-list" /> On this page
              </p>
              {toc.map(h => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  className="block text-[13px] py-1.5 font-medium"
                  style={{ color: "#6B7280" }}
                >
                  {h.text}
                </a>
              ))}
            </>
          )}
        </aside>
      </div>

      {/* Footer */}
      <footer className="border-t mt-8" style={{ borderColor: "#F0F0F0", background: "#FAFAF9" }}>
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <img src="/logo-light.svg" alt="Tori" className="h-6 w-auto" />
            </div>
            <p className="text-[13px]" style={{ color: "#6B7280" }}>Recurring billing infrastructure for Nomba.</p>
          </div>
          {([
            ["Product", ["Plans", "Subscriptions", "Dunning", "Ledger"]],
            ["Developers", ["Documentation", "API Reference", "Webhooks", "Changelog"]],
            ["Use cases", ["SaaS billing", "Edtech fees", "Creator subs"]],
            ["Company", ["About", "Status", "Contact"]],
          ] as [string, string[]][]).map(([title, links]) => (
            <div key={title}>
              <p className="text-[13px] font-bold mb-3" style={{ color: "#0F1728" }}>{title}</p>
              {links.map(link => (
                <a key={link} href="#" className="block text-[13px] py-1" style={{ color: "#6B7280" }}>{link}</a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid #F0F0F0" }}>
          <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap gap-4 justify-between items-center">
            <span className="text-[13px]" style={{ color: "#9CA3AF" }}>2026 Tori · Built on Nomba · Nomba × DevCareer Hackathon 2026</span>
            <div className="flex gap-4">
              <a href="https://github.com/chibuike-kt" className="text-[13px] font-medium" style={{ color: "#9CA3AF" }}>GitHub</a>
              <a href="#" className="text-[13px] font-medium" style={{ color: "#9CA3AF" }}>Twitter</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating chat */}
      <div className="fixed bottom-6 right-6 z-30">
        <button className="flex items-center gap-2.5 px-4 py-3 rounded-full shadow-xl font-bold text-white text-[13px]" style={{ background: "#0F1728" }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#00B37E" }}>
            <i className="ti ti-message-circle" style={{ fontSize: 16 }} />
          </div>
          <div className="text-left">
            <div className="font-bold">Chat with us</div>
            <div className="text-[11px] font-medium" style={{ opacity: 0.7 }}>AI assisted</div>
          </div>
        </button>
      </div>
    </div>
  );
}

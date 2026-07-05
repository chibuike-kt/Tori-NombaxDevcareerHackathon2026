"use client";
import { useState, type ReactNode } from "react";

/** IDE-style code block: window chrome, filename tab, line numbers, copy-to-clipboard. */
export function CodeEditor({
  filename,
  code,
  children,
}: {
  filename: string;
  code: string;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — fail silently, no crash
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: "#1E2736" }}>
      <div
        className="flex items-center px-4 py-3 relative flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ background: "#FF5F56" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#FFBD2E" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#27C93F" }} />
        </div>
        <div
          className="absolute left-1/2 -translate-x-1/2 text-xs font-medium font-mono"
          style={{ color: "#8B98AB" }}
        >
          {filename}
        </div>
        <button
          onClick={onCopy}
          className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-md transition-colors duration-200"
          style={{
            color: copied ? "#00B37E" : "#8B98AB",
            background: copied ? "rgba(0,179,126,0.12)" : "transparent",
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <pre className="text-[13px] font-mono leading-[1.7] py-4 m-0">{children}</pre>
      </div>
    </div>
  );
}

/** One numbered line inside a CodeEditor. */
export function CodeLine({ n, children }: { n: number; children?: ReactNode }) {
  return (
    <div className="px-4 flex">
      <span className="select-none pr-4 text-right flex-shrink-0" style={{ color: "#4A5568", minWidth: 28 }}>
        {n}
      </span>
      <span className="whitespace-pre">{children}</span>
    </div>
  );
}

// Token colors — one-dark-pro-ish palette against the #1E2736 background
export const tok = {
  plain: "#B7C4D6",
  keyword: "#C792EA",
  string: "#C3E88D",
  fn: "#82AAFF",
  prop: "#F78C6C",
  comment: "#546E7A",
};

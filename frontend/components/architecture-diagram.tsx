"use client";

const GREEN = "#00B37E";
const WHITE = "#FFFFFF";
const MUTED = "#9CA3AF";
const COMPONENT_FILL = "rgba(0,179,126,0.1)";

const COMPONENTS = [
  { x: 170, y: 258, title: "State Machine", desc: "9 states, pure function" },
  { x: 410, y: 258, title: "Dunning Engine", desc: "Day 3, 7, 14, 21 — payday aligned" },
  { x: 170, y: 368, title: "Double-entry Ledger", desc: "Append-only, immutable" },
  { x: 410, y: 368, title: "Recovery Ladder", desc: "Card → mandate → pay-link" },
];

/** Detailed two-layer architecture diagram: integration flow, then the Tori engine expanded. */
export function ArchitectureDiagram() {
  return (
    <div className="rounded-2xl px-4 py-8 lg:px-8 lg:py-10" style={{ background: "#0F1728", maxWidth: 800, margin: "0 auto" }}>
      <svg
        viewBox="0 0 800 660"
        className="w-full h-auto"
        role="img"
        aria-label="Architecture diagram: your product calls Tori, Tori talks to Nomba and the customer, and the Tori engine — state machine, dunning engine, ledger, recovery ladder — sends webhooks back to your product and data to the operator finance dashboard"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={GREEN} />
          </marker>
        </defs>

        {/* ── Top layer: integration flow ─────────────────────────────────── */}
        <text x={100} y={26} textAnchor="middle" fontSize={11} fontWeight={700} fill={MUTED} style={{ letterSpacing: "0.08em" }}>
          INTEGRATION FLOW
        </text>

        {/* Your Product */}
        <rect x={20} y={40} width={160} height={70} rx={12} fill={COMPONENT_FILL} stroke={GREEN} strokeWidth={1.5} />
        <text x={100} y={80} textAnchor="middle" fontSize={14} fontWeight={700} fill={WHITE}>Your Product</text>

        {/* Tori API */}
        <rect x={320} y={40} width={160} height={70} rx={12} fill={GREEN} stroke={GREEN} strokeWidth={1.5} />
        <text x={400} y={80} textAnchor="middle" fontSize={14} fontWeight={700} fill="#0F1728">Tori API</text>

        {/* Customer */}
        <rect x={620} y={40} width={160} height={70} rx={12} fill={COMPONENT_FILL} stroke={GREEN} strokeWidth={1.5} />
        <text x={700} y={80} textAnchor="middle" fontSize={14} fontWeight={700} fill={WHITE}>Customer</text>

        {/* Product -> Tori API */}
        <line x1={180} y1={75} x2={312} y2={75} stroke={GREEN} strokeWidth={1.5} markerEnd="url(#arrow)" />
        <text x={246} y={65} textAnchor="middle" fontSize={11} fill={MUTED} fontFamily="monospace">POST /checkout</text>

        {/* Tori API -> Customer (via Nomba checkout) */}
        <line x1={480} y1={75} x2={612} y2={75} stroke={GREEN} strokeWidth={1.5} markerEnd="url(#arrow)" />
        <text x={546} y={65} textAnchor="middle" fontSize={11} fill={MUTED} fontFamily="monospace">Nomba checkout</text>

        {/* Return path: Customer -> payment_success webhook -> Tori API */}
        <path
          d="M 700 110 L 700 150 L 400 150 L 400 112"
          fill="none"
          stroke={GREEN}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          markerEnd="url(#arrow)"
        />
        <text x={550} y={143} textAnchor="middle" fontSize={11} fill={MUTED} fontFamily="monospace">payment_success webhook</text>

        {/* Connector down into the expanded engine */}
        <line x1={400} y1={110} x2={400} y2={200} stroke={GREEN} strokeWidth={1.5} markerEnd="url(#arrow)" />
        <text x={430} y={185} fontSize={10} fill={MUTED} style={{ fontStyle: "italic" }}>expands to ▾</text>

        {/* ── Bottom layer: the Tori engine ───────────────────────────────── */}
        <rect x={130} y={205} width={540} height={300} rx={16} fill="rgba(0,179,126,0.04)" stroke={GREEN} strokeWidth={1.5} strokeDasharray="3 4" />
        <text x={150} y={230} fontSize={11} fontWeight={700} fill={MUTED} style={{ letterSpacing: "0.08em" }}>
          TORI ENGINE
        </text>

        {COMPONENTS.map((c) => (
          <g key={c.title}>
            <rect x={c.x} y={c.y} width={220} height={90} rx={10} fill={COMPONENT_FILL} stroke={GREEN} strokeWidth={1.5} />
            <text x={c.x + 110} y={c.y + 38} textAnchor="middle" fontSize={13} fontWeight={700} fill={WHITE}>{c.title}</text>
            <text x={c.x + 110} y={c.y + 60} textAnchor="middle" fontSize={11} fill={MUTED}>{c.desc}</text>
          </g>
        ))}

        {/* ── Outputs ──────────────────────────────────────────────────────── */}
        <line x1={280} y1={505} x2={280} y2={560} stroke={GREEN} strokeWidth={1.5} markerEnd="url(#arrow)" />
        <text x={280} y={580} textAnchor="middle" fontSize={12} fontWeight={700} fill={WHITE}>Outbound webhooks</text>
        <text x={280} y={598} textAnchor="middle" fontSize={11} fill={MUTED}>→ Your Product</text>

        <line x1={520} y1={505} x2={520} y2={560} stroke={GREEN} strokeWidth={1.5} markerEnd="url(#arrow)" />
        <text x={520} y={580} textAnchor="middle" fontSize={12} fontWeight={700} fill={WHITE}>Finance dashboard</text>
        <text x={520} y={598} textAnchor="middle" fontSize={11} fill={MUTED}>→ Operator</text>
      </svg>
    </div>
  );
}

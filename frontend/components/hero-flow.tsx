"use client";

const NODES = [
  { label: "Customer", x: 40 },
  { label: "Nomba", x: 300 },
  { label: "Tori", x: 560, accent: true },
  { label: "Product", x: 820 },
];

const NODE_W = 160;
const NODE_H = 72;
const NODE_Y = 34;

/** Minimal SVG flow diagram: Customer → Nomba → Tori → Product. */
export function HeroFlowDiagram() {
  return (
    <div className="rounded-2xl px-4 py-8 lg:px-10 lg:py-12" style={{ background: "#0F1728" }}>
      <svg
        viewBox="0 0 1020 140"
        className="w-full h-auto"
        role="img"
        aria-label="Payment flows from the customer through Nomba and Tori to your product"
      >
        {NODES.slice(0, -1).map((n, i) => {
          const x1 = n.x + NODE_W;
          const x2 = NODES[i + 1].x;
          const y = NODE_Y + NODE_H / 2;
          return (
            <g key={n.label}>
              <line x1={x1} y1={y} x2={x2 - 12} y2={y} stroke="#00B37E" strokeWidth={2} />
              <path d={`M ${x2 - 16} ${y - 6} L ${x2 - 4} ${y} L ${x2 - 16} ${y + 6} Z`} fill="#00B37E" />
            </g>
          );
        })}

        {NODES.map((n) => (
          <g key={n.label}>
            <rect
              x={n.x}
              y={NODE_Y}
              width={NODE_W}
              height={NODE_H}
              rx={14}
              fill={n.accent ? "#00B37E" : "rgba(255,255,255,0.04)"}
              stroke={n.accent ? "#00B37E" : "rgba(255,255,255,0.25)"}
              strokeWidth={1.5}
            />
            <text
              x={n.x + NODE_W / 2}
              y={NODE_Y + NODE_H / 2 + 5}
              textAnchor="middle"
              fontSize={17}
              fontWeight={700}
              fill={n.accent ? "#0F1728" : "#FFFFFF"}
              fontFamily="inherit"
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

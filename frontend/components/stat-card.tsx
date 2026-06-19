interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{
        borderColor: "var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        background: "var(--background)",
      }}
    >
      <p className="text-sm font-medium mb-2" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <p
        className="text-3xl font-semibold tracking-tight"
        style={{ color: accent ? "var(--primary)" : "var(--heading)" }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-sm mt-1.5" style={{ color: "var(--muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

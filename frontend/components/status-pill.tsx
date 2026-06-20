import { statusPill } from "@/lib/utils";

export function StatusPill({ status }: { status: string }) {
  const { bg, color } = statusPill(status);
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
      style={{ background: bg, color }}
    >
      {status}
    </span>
  );
}

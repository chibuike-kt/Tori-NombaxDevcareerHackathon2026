import { statusColor } from "@/lib/utils";

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${statusColor(status)}`}
    >
      {status}
    </span>
  );
}

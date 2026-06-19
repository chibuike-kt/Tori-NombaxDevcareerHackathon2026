export function formatKobo(amount: number, currency = "NGN"): string {
  const naira = amount / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(naira);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    TRIALING: "bg-indigo-100 text-indigo-700",
    PAST_DUE: "bg-amber-100 text-amber-700",
    DUNNING: "bg-orange-100 text-orange-700",
    PAUSED: "bg-blue-100 text-blue-700",
    SUSPENDED: "bg-red-100 text-red-700",
    CANCELLED: "bg-gray-100 text-gray-500",
  };
  return map[status] ?? "bg-gray-100 text-gray-500";
}

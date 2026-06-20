export function formatKobo(amount: number, currency = "NGN"): string {
  const naira = amount / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(naira);
}

export function formatKoboShort(amount: number): string {
  const naira = amount / 100;
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(2)}M`;
  if (naira >= 1_000) return `₦${(naira / 1_000).toFixed(1)}K`;
  return `₦${naira.toLocaleString()}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function statusPill(status: string): { bg: string; color: string } {
  const map: Record<string, { bg: string; color: string }> = {
    ACTIVE: { bg: "#E3F7EF", color: "#0A7A56" },
    TRIALING: { bg: "#EEEDFE", color: "#4F46B5" },
    PAST_DUE: { bg: "#FDF0D5", color: "#8A5A00" },
    DUNNING: { bg: "#FDF0D5", color: "#8A5A00" },
    PAUSED: { bg: "#E8EFF9", color: "#2563A8" },
    SUSPENDED: { bg: "#FDECEC", color: "#A32D2D" },
    CANCELLED: { bg: "#F1F3F5", color: "#6B7280" },
  };
  return map[status] ?? { bg: "#F1F3F5", color: "#6B7280" };
}

const avatarColors = [
  { bg: "#E3F7EF", color: "#0A7A56" },
  { bg: "#E8EFF9", color: "#2563A8" },
  { bg: "#EEEDFE", color: "#4F46B5" },
  { bg: "#FDF0D5", color: "#8A5A00" },
  { bg: "#FBEAF0", color: "#993556" },
];

export function avatarFor(seed: string): {
  bg: string;
  color: string;
  initials: string;
} {
  const initials = seed.slice(0, 2).toUpperCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const c = avatarColors[Math.abs(hash) % avatarColors.length];
  return { ...c, initials };
}

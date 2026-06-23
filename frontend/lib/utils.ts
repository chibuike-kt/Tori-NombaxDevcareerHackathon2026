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
  switch (status) {
    case "ACTIVE":
      return { bg: "#E3F7EF", color: "#0A7A56" };
    case "TRIALING":
      return { bg: "#EEF2FF", color: "#4338CA" };
    case "GRACE_PERIOD":
      return { bg: "#FEF9C3", color: "#854D0E" };
    case "PAST_DUE":
      return { bg: "#FEF3C7", color: "#92400E" };
    case "DUNNING":
      return { bg: "#FDF0D5", color: "#8A5A00" };
    case "PAUSED":
      return { bg: "#EFF6FF", color: "#1D4ED8" };
    case "SUSPENDED":
      return { bg: "#FDECEC", color: "#A32D2D" };
    case "CANCELLED":
      return { bg: "#F1F3F5", color: "#6B7280" };
    default:
      return { bg: "#F1F3F5", color: "#6B7280" };
  }
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

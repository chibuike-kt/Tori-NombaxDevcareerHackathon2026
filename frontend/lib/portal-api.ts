const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const TOKEN_STORAGE_KEY = "tori_portal_token";

export async function portalFetch<T = unknown>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${API_BASE}${path}${sep}token=${encodeURIComponent(token)}`, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Request failed");
  }
  return res.json();
}

// Reads the portal token from the URL if present (and persists it for
// same-tab navigation), otherwise falls back to whatever was persisted from
// an earlier page load in this session.
export function resolvePortalToken(urlToken: string | null): string {
  if (typeof window === "undefined") return urlToken ?? "";
  if (urlToken) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, urlToken);
    return urlToken;
  }
  return sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
}

// Appends the current portal token to an internal link's href so navigation
// between portal pages (and page refreshes) keep working without re-login.
export function portalHref(path: string, token: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}token=${encodeURIComponent(token)}`;
}

export interface PortalPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: string;
  trial_period_days: number;
}

export interface PortalSubscription {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
  cancel_at_period_end: boolean;
  dunning_attempt: number;
  recovery_rail?: string;
  plan: PortalPlan | null;
}

export interface PortalCustomer {
  id: string;
  email?: string;
  name?: string;
}

export interface PortalOverview {
  customer: PortalCustomer;
  subscriptions: PortalSubscription[];
  recent_invoices: PortalInvoice[];
  merchant_name: string;
}

export interface PortalInvoice {
  id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string;
  paid_at?: string;
  created_at: string;
  plan_name?: string;
}

export interface PortalHistoryEntry {
  description: string;
  created_at: string;
}

// Human, customer-facing status labels — distinct from the dashboard's
// raw uppercase StatusPill, which is written for operators.
export function humanStatusLabel(status: string): { label: string; bg: string; color: string } {
  switch (status) {
    case "ACTIVE":
      return { label: "Active", bg: "#E3F7EF", color: "#0A7A56" };
    case "TRIALING":
      return { label: "Trial", bg: "#EEF2FF", color: "#4338CA" };
    case "PENDING_PAYMENT":
      return { label: "Awaiting payment", bg: "#FFF7ED", color: "#C05A00" };
    case "GRACE_PERIOD":
      return { label: "Payment retrying", bg: "#FEF9C3", color: "#854D0E" };
    case "PAST_DUE":
      return { label: "Payment failed", bg: "#FEF3C7", color: "#92400E" };
    case "DUNNING":
      return { label: "Payment failed", bg: "#FDF0D5", color: "#8A5A00" };
    case "PAUSED":
      return { label: "Paused", bg: "#EFF6FF", color: "#1D4ED8" };
    case "SUSPENDED":
      return { label: "Suspended", bg: "#FDECEC", color: "#A32D2D" };
    case "CANCELLED":
      return { label: "Cancelled", bg: "#F1F3F5", color: "#6B7280" };
    default:
      return { label: status, bg: "#F1F3F5", color: "#6B7280" };
  }
}

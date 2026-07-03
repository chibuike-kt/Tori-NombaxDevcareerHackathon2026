const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (e: Error) => void;
}> = [];

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newToken = data.data?.access_token;
    if (newToken) {
      localStorage.setItem("access_token", newToken);
      if (data.data?.refresh_token) {
        localStorage.setItem("refresh_token", data.data.refresh_token);
      }
      return newToken;
    }
    return null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (isRefreshing) {
      return new Promise<T>((resolve, reject) => {
        refreshQueue.push({
          resolve: async (newToken: string) => {
            try {
              const retryHeaders = {
                ...headers,
                Authorization: `Bearer ${newToken}`,
              };
              const retryRes = await fetch(`${API_BASE}${path}`, {
                ...options,
                headers: retryHeaders,
              });
              if (!retryRes.ok)
                reject(new Error("Request failed after token refresh"));
              else resolve(await retryRes.json());
            } catch (e) {
              reject(e instanceof Error ? e : new Error("Request failed"));
            }
          },
          reject,
        });
      });
    }

    isRefreshing = true;
    const newToken = await refreshAccessToken();
    isRefreshing = false;

    if (newToken) {
      refreshQueue.forEach(({ resolve }) => resolve(newToken));
      refreshQueue = [];

      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: retryHeaders,
      });
      if (!retryRes.ok) {
        const error = await retryRes
          .json()
          .catch(() => ({ error: { message: retryRes.statusText } }));
        throw new Error(error.error?.message || "Request failed");
      }
      return retryRes.json();
    }

    // Refresh failed — drain queue with rejections
    refreshQueue.forEach(({ reject }) => reject(new Error("Session expired")));
    refreshQueue = [];

    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/login";
    }
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message || "Request failed");
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// Auth
export const login = async (email: string, password: string) => {
  const res = await api.post<{
    data: {
      access_token: string;
      refresh_token: string;
      email_verified: boolean;
    };
  }>("/v1/auth/login", { email, password });

  localStorage.setItem("access_token", res.data.access_token);
  localStorage.setItem("refresh_token", res.data.refresh_token);
  localStorage.setItem("email_verified", String(res.data.email_verified));

  if (!res.data.email_verified) {
    localStorage.setItem("pending_email", email);
  }

  return res;
};

export const logout = async (): Promise<void> => {
  try {
    const token = localStorage.getItem("access_token");
    if (token) {
      await api.post("/v1/auth/logout", {});
    }
  } catch {
    // proceed regardless
  } finally {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("email_verified");
    localStorage.removeItem("pending_email");
  }
};

export const getDunningConfig = () => api.get<{ data: Tenant }>("/v1/me");

export const updateDunningConfig = (config: {
  retry_intervals_days: number[];
  max_attempts: number;
  suspension_action: string;
  notify_customer: boolean;
  notify_merchant: boolean;
  smart_retry: boolean;
}) => api.patch<{ data: Tenant }>("/v1/dunning-config", config);

// Plans
export const getPlans = () => api.get<{ data: Plan[] }>("/v1/plans");
export const createPlan = (body: Partial<Plan>) => api.post<{ data: Plan }>("/v1/plans", body);
export const deactivatePlan = (id: string) => api.delete(`/v1/plans/${id}`);

// Customers
export const getCustomers = (limit = 50) =>
  api.get<{ data: Customer[] }>(`/v1/customers?limit=${limit}`);
export const getCustomer = (id: string) =>
  api.get<{ data: Customer }>(`/v1/customers/${id}`);
export const createCustomer = (body: Partial<Customer>) =>
  api.post<{ data: Customer }>("/v1/customers", body);
export const getCustomerSubscriptions = (id: string) =>
  api.get<{ data: Subscription[] }>(`/v1/subscriptions?customer_id=${id}`);

// Subscriptions
export const getSubscriptions = () =>
  api.get<{ data: Subscription[] }>("/v1/subscriptions");
export const cancelSubscription = (id: string) =>
  api.post(`/v1/subscriptions/${id}/cancel`, {});
export const pauseSubscription = (id: string) =>
  api.post(`/v1/subscriptions/${id}/pause`, {});
export const resumeSubscription = (id: string) =>
  api.post(`/v1/subscriptions/${id}/resume`, {});
export const recoverSubscription = (id: string) =>
  api.post(`/v1/subscriptions/${id}/recover`, {});

// Checkout
export const createCheckout = (
  email: string,
  planId: string,
  name?: string,
  externalId?: string,
) =>
  api.post<{
    data: {
      customer: Customer;
      subscription: Subscription;
      customer_created: boolean;
    };
  }>("/v1/checkout", { email, plan_id: planId, name, external_id: externalId });

// Finance
export const getMRR = (period?: string) =>
  api.get<{ data: MRRResult }>(
    `/v1/finance/mrr${period ? `?period=${period}` : ""}`,
  );
export const getChurn = (from?: string, to?: string) =>
  api.get<{ data: ChurnResult }>(
    `/v1/finance/churn${from ? `?from=${from}&to=${to}` : ""}`,
  );
export const getDunningRecovery = (from?: string, to?: string) =>
  api.get<{ data: DunningRecoveryResult }>(
    `/v1/finance/dunning-recovery${from ? `?from=${from}&to=${to}` : ""}`,
  );
export const getLedgerSummary = (from?: string, to?: string) =>
  api.get<{ data: LedgerSummary }>(
    `/v1/ledger/summary${from ? `?from=${from}&to=${to}` : ""}`,
  );

// Health
export const getPortfolioHealth = () =>
  api.get<{ data: PortfolioHealth }>("/v1/health");
export const getRevenueForecast = () =>
  api.get<{ data: RevenueForecast }>("/v1/health/forecast");

// API Keys
export const createAPIKey = (name: string) =>
  api.post<{ data: { key: string; name: string; hint: string } }>(
    "/v1/api-keys",
    { name },
  );
export const rotateAPIKey = () =>
  api.post<{ data: { key: string; name: string; hint: string } }>(
    "/v1/api-keys/rotate",
    {},
  );
export const getAPIKeyHint = () =>
  api.get<{ data: { hint: string; note?: string } }>("/v1/api-keys");

// Me
export const getMe = () => api.get<{ data: Tenant }>("/v1/me");
export const updateMe = (name: string, email: string) =>
  api.patch<{ data: Tenant }>("/v1/me", { name, email });

// Types
export interface Tenant {
  id: string;
  name: string;
  email: string;
  api_key_hint?: string;
  is_active: boolean;
  created_at: string;
  dunning_config?: {
    retry_intervals_days: number[];
    max_attempts: number;
    suspension_action: string;
    notify_customer: boolean;
    notify_merchant: boolean;
    smart_retry: boolean;
  };
}

export interface Plan {
  id: string;
  name: string;
  amount: number;
  interval: string;
  interval_count: number;
  trial_period_days: number;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  tenant_id: string;
  external_id?: string;
  email: string;
  name?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  customer_id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
  dunning_attempt: number;
  next_retry_at?: string;
  cancel_at_period_end: boolean;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MRRResult {
  mrr_kobo: number;
  currency: string;
  period: string;
}

export interface ChurnResult {
  churn_rate_pct: number;
  cancelled_count: number;
  period: string;
}

export interface DunningRecoveryResult {
  recovered_kobo: number;
  currency: string;
}

export interface LedgerSummary {
  total_debits: number;
  total_credits: number;
  total_charged: number;
  total_refunded: number;
  total_credits_applied: number;
  net_revenue: number;
  entry_count: number;
  currency: string;
}

export interface HealthScore {
  score: number;
  label: string;
  color: string;
  reason: string;
}

export interface ChurnPrediction {
  signal: "none" | "low" | "medium" | "high" | "critical";
  score: number;
  reasons: string[];
  recommended_action: string;
}

export interface SubscriptionWithHealth extends Subscription {
  health: HealthScore;
  churn: ChurnPrediction;
}

export interface PortfolioHealth {
  average_score: number;
  healthy_count: number;
  at_risk_count: number;
  critical_count: number;
  churn_risk_count: number;
  subscriptions: SubscriptionWithHealth[];
}

export interface RevenueForecast {
  period_label: string;
  expected_low: number;
  expected_high: number;
  expected_mid: number;
  active_subscriptions: number;
  at_risk_revenue: number;
  recovery_rate_pct: number;
  confidence: "high" | "medium" | "low";
  note: string;
}

export interface MonthlyRevenue {
  month: string;
  charged_kobo: number;
  refunded_kobo: number;
  net_kobo: number;
}

export const getMonthlyRevenue = (from?: string, to?: string) =>
  api.get<{ data: MonthlyRevenue[] }>(
    `/v1/ledger/monthly${from ? `?from=${from}&to=${to}` : ""}`,
  );

export interface Invoice {
  id: string;
  subscription_id: string;
  customer_id: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string;
  paid_at?: string;
  nomba_charge_ref?: string;
  created_at: string;
}

export const getInvoices = (status?: string) =>
  api.get<{ data: Invoice[] }>(
    `/v1/invoices${status ? `?status=${status}` : ""}`,
  );

export interface RecoveryItem {
  subscription_id: string;
  customer_id: string;
  customer_email: string;
  status: string;
  amount_kobo: number;
  recovery_rail: string;
  dunning_attempt: number;
  next_retry_at?: string;
  plan_name: string;
}

export interface RecoveryCenter {
  at_risk_kobo: number;
  recovered_kobo: number;
  recovery_rate_pct: number;
  at_risk_count: number;
  recovering_count: number;
  recovered_count: number;
  at_risk: RecoveryItem[];
  recovering: RecoveryItem[];
  recovered: RecoveryItem[];
  currency: string;
  generated_at: string;
}

export const getRecoveryCenter = () =>
  api.get<{ data: RecoveryCenter }>("/v1/finance/recovery-center");

export const retrySubscriptionNow = (id: string) =>
  api.post(`/v1/subscriptions/${id}/retry-now`, {});

export const sendPayLink = (id: string) =>
  api.post(`/v1/subscriptions/${id}/send-pay-link`, {});

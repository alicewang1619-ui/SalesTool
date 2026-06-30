export type LoginResponse = {
  access_token: string;
  token_type: string;
  role: string;
  name: string;
};

export type Banner = {
  title: string;
  body: string;
  image_url: string;
  link_url?: string | null;
};

export type Lead = {
  id: number;
  customer_name: string;
  country: string;
  customer_type: string;
  product: string;
  source_category: string;
  source_label: string;
  score_label: string;
  feedback_status: string;
};

export type PageResult<T> = {
  page: number;
  page_size: number;
  total: number;
  items: T[];
};

export type Customer = {
  id: number;
  name: string;
  country: string;
  customer_type: string;
  product: string;
  tier: string;
  background: {
    auto_summary: string;
    manual_summary: string | null;
    evidence: string;
    confidence: string;
    updated_by: string;
    updated_at: string;
  };
};

export type SalesUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  data_scope: string;
  enabled: boolean;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function getToken(): string | null {
  return window.localStorage.getItem("ug_token");
}

export function saveSession(token: string, name: string, role: string): void {
  window.localStorage.setItem("ug_token", token);
  window.localStorage.setItem("ug_name", name);
  window.localStorage.setItem("ug_role", role);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: "请求失败" }));
    throw new Error(typeof detail.detail === "string" ? detail.detail : "请求失败");
  }
  return response.json() as Promise<T>;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function fetchBanner(): Promise<Banner> {
  return request<Banner>("/api/banner");
}

export function fetchLeads(sourceCategory?: string): Promise<PageResult<Lead>> {
  const params = new URLSearchParams({ page: "1", page_size: "20" });
  if (sourceCategory) {
    params.set("source_category", sourceCategory);
  }
  return request<PageResult<Lead>>(`/api/leads?${params.toString()}`);
}

export function fetchCustomer(customerId: string): Promise<Customer> {
  return request<Customer>(`/api/customers/${customerId}`);
}

export function updateCustomerBackground(customerId: string, manualSummary: string): Promise<Customer> {
  return request<Customer>(`/api/customers/${customerId}/background`, {
    method: "PUT",
    body: JSON.stringify({ manual_summary: manualSummary })
  });
}

export function fetchSettingsSummary(): Promise<Record<string, number>> {
  return request<Record<string, number>>("/api/settings/summary");
}

export function fetchSalesUsers(): Promise<SalesUser[]> {
  return request<SalesUser[]>("/api/settings/sales-users");
}


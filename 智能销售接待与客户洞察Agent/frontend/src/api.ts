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

export type LeadDetail = Lead & {
  raw_inquiry: string;
  conversation_history: string[];
  profile_summary: {
    customer_type: string;
    country: string;
    product: string;
    source: string;
  };
  score_reasons: string[];
  background_summary: string;
  background_confidence: string;
  background_updated_at: string | null;
  customer_id: number | null;
  assignment: {
    owner_id: number | null;
    owner_name: string;
    status: string;
  };
  feedback_history: string[];
  background_task_status: string;
};

export type PageResult<T> = {
  page: number;
  page_size: number;
  total: number;
  items: T[];
};

export type DashboardTodo = Lead & {
  detail_path: string;
};

export type DashboardResult = {
  page: number;
  page_size: number;
  total: number;
  metrics: {
    today_inquiries: number;
    valid_leads: number;
    unfeedback: number;
    website_kpi: number;
  };
  ai_summary: string;
  assignment_timeline: Array<{
    label: string;
    value: string;
  }>;
  items: DashboardTodo[];
};

export type SourceOption = {
  category: string;
  label: string;
};

export type ImportFailure = {
  row_number: number;
  customer_name: string;
  reason: string;
};

export type ImportJob = {
  task_id: string;
  filename: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  success_rows: number;
  failed_rows: number;
  failures: ImportFailure[];
};

export type PendingAssignment = Lead & {
  owner_id: number | null;
  owner_name: string;
  pending_reasons: string[];
  detail_path: string;
  configure_mapping_path?: string | null;
};

export type AssignmentConfirmResult = {
  lead_id: number;
  owner_id: number;
  owner_name: string;
  feedback_link_token: string;
  feedback_link_path: string;
  expires_at: string;
};

export type DashboardFilters = {
  page?: number;
  pageSize?: number;
  sourceCategory?: string;
  country?: string;
  customerType?: string;
  product?: string;
  ownerId?: number;
  cycle?: "today" | "all";
};

export type LeadFilters = {
  page?: number;
  pageSize?: number;
  sourceCategory?: string;
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

export function clearSession(): void {
  window.localStorage.removeItem("ug_token");
  window.localStorage.removeItem("ug_name");
  window.localStorage.removeItem("ug_role");
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
    const rawDetail = detail.detail;
    const message =
      typeof rawDetail === "string" ? rawDetail : typeof rawDetail?.message === "string" ? rawDetail.message : "请求失败";
    const error = new Error(message);
    error.name = typeof rawDetail?.code === "string" ? rawDetail.code : `HTTP_${response.status}`;
    throw error;
  }
  return response.json() as Promise<T>;
}

async function requestForm<T>(path: string, body: FormData): Promise<T> {
  const token = getToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE}${path}`, { method: "POST", body, headers });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: "请求失败" }));
    const rawDetail = detail.detail;
    const message =
      typeof rawDetail === "string" ? rawDetail : typeof rawDetail?.message === "string" ? rawDetail.message : "请求失败";
    const error = new Error(message);
    error.name = typeof rawDetail?.code === "string" ? rawDetail.code : `HTTP_${response.status}`;
    throw error;
  }
  return response.json() as Promise<T>;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function fetchMe(): Promise<SalesUser> {
  return request<SalesUser>("/api/me");
}

export function fetchBanner(): Promise<Banner> {
  return request<Banner>("/api/banner");
}

export function fetchLeads(filters: LeadFilters = {}): Promise<PageResult<Lead>> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 20)
  });
  if (filters.sourceCategory) {
    params.set("source_category", filters.sourceCategory);
  }
  return request<PageResult<Lead>>(`/api/leads?${params.toString()}`);
}

export function fetchLead(leadId: number): Promise<LeadDetail> {
  return request<LeadDetail>(`/api/leads/${leadId}`);
}

export function updateLeadAssignment(
  leadId: number,
  payload: { ownerId: number | null; feedbackStatus: string }
): Promise<LeadDetail> {
  return request<LeadDetail>(`/api/leads/${leadId}/assignment`, {
    method: "PUT",
    body: JSON.stringify({ owner_id: payload.ownerId, feedback_status: payload.feedbackStatus })
  });
}

export function fetchSourceDictionary(): Promise<SourceOption[]> {
  return request<SourceOption[]>("/api/source-dictionary");
}

export function createImportJob(file: File): Promise<ImportJob> {
  const form = new FormData();
  form.append("file", file);
  return requestForm<ImportJob>("/api/import-jobs", form);
}

export function fetchImportJob(taskId: string): Promise<ImportJob> {
  return request<ImportJob>(`/api/import-jobs/${taskId}`);
}

export function retryImportJob(taskId: string): Promise<ImportJob> {
  return request<ImportJob>(`/api/import-jobs/${taskId}/retry`, { method: "POST" });
}

export function fetchPendingAssignments(filters: { page?: number; pageSize?: number } = {}): Promise<PageResult<PendingAssignment>> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 20)
  });
  return request<PageResult<PendingAssignment>>(`/api/assignments/pending?${params.toString()}`);
}

export function confirmPendingAssignment(
  leadId: number,
  payload: { ownerId: number; expectedOwnerId: number | null }
): Promise<AssignmentConfirmResult> {
  return request<AssignmentConfirmResult>(`/api/assignments/${leadId}/assign`, {
    method: "POST",
    body: JSON.stringify({ owner_id: payload.ownerId, expected_owner_id: payload.expectedOwnerId })
  });
}

export async function downloadImportFailures(taskId: string): Promise<string> {
  const token = getToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE}/api/import-jobs/${taskId}/failed-rows`, { headers });
  if (!response.ok) {
    throw new Error("失败行下载失败");
  }
  return response.text();
}

export function fetchDashboard(filters: DashboardFilters = {}): Promise<DashboardResult> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 10)
  });
  if (filters.sourceCategory) params.set("source_category", filters.sourceCategory);
  if (filters.country) params.set("country", filters.country);
  if (filters.customerType) params.set("customer_type", filters.customerType);
  if (filters.product) params.set("product", filters.product);
  if (filters.ownerId) params.set("owner_id", String(filters.ownerId));
  if (filters.cycle && filters.cycle !== "all") params.set("cycle", filters.cycle);
  return request<DashboardResult>(`/api/dashboard?${params.toString()}`);
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

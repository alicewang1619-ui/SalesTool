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

export type ReportPeriod = "day" | "month" | "quarter" | "year";

export type ReportHomeResult = {
  period: ReportPeriod;
  query_window: {
    start_at: string;
    end_at: string;
  };
  limits: {
    page: number;
    page_size: number;
  };
  metrics: Array<{
    key: string;
    label: string;
    value: number;
    unit: string;
    hint: string;
  }>;
  period_entries: Array<{
    period: ReportPeriod;
    label: string;
    path: string;
  }>;
  channel_quality: {
    total: number;
    items: Array<{
      source_category: string;
      inquiry_count: number;
      valid_count: number;
      valid_rate: number;
    }>;
  };
  website_kpi: {
    attribution_rate: number;
    ai_completion_rate: number;
    assignment_rate: number;
    sales_feedback_rate: number;
    entered_customer_pool: number;
  };
  generation: {
    status: "ready" | "generating" | "queued";
    updated_at: string;
    retry_path: string;
  };
};

export type ReportBreakdownItem = {
  label: string;
  inquiry_count: number;
  valid_count: number;
  valid_rate: number;
};

export type ReportPeriodViewResult = {
  period: ReportPeriod;
  query_window: {
    start_at: string;
    end_at: string;
  };
  filters: {
    country: string | null;
    source_category: string | null;
    product: string | null;
    feedback_status: string | null;
  };
  limits: {
    page: number;
    page_size: number;
  };
  metrics: {
    inquiries: number;
    valid_leads: number;
    unfeedback: number;
    website_kpi: number;
  };
  breakdowns: {
    countries: ReportBreakdownItem[];
    channels: ReportBreakdownItem[];
    products: ReportBreakdownItem[];
    feedback_statuses: ReportBreakdownItem[];
  };
  items: Array<{
    id: number;
    customer_name: string;
    country: string;
    source_category: string;
    product: string;
    feedback_status: string;
    score_label: string;
    owner_id: number | null;
    detail_path: string;
  }>;
  total: number;
  downstream: {
    metrics_path: string;
    export_path: string;
    export_requires_confirmation: boolean;
  };
};

export type ReportMetricDetailItem = {
  key: string;
  label: string;
  value: number;
  unit: string;
  hint: string;
};

export type ReportMetricsDetailResult = {
  period: ReportPeriod;
  query_window: {
    start_at: string;
    end_at: string;
  };
  filters: {
    country: string | null;
    source_category: string | null;
    product: string | null;
    feedback_status: string | null;
  };
  limits: {
    page: number;
    page_size: number;
  };
  metric_cards: Array<{
    key: string;
    label: string;
    value: number;
    unit: string;
    hint: string;
  }>;
  detail_groups: Record<string, ReportMetricDetailItem[]>;
  items: Array<{
    lead_id: number;
    customer_id: number | null;
    customer_name: string;
    country: string;
    source_category: string;
    source_label: string;
    product: string;
    feedback_status: string;
    score_label: string;
    owner_id: number | null;
    lead_detail_path: string;
    customer_detail_path: string | null;
  }>;
  total: number;
  downstream: {
    metrics_path: string;
    export_path: string;
    export_requires_confirmation: boolean;
  };
  export_summary: {
    fields: string[];
    desensitization: string;
    excludes: string[];
  };
  empty_state?: {
    title: string;
    action_label: string;
    action_path: string;
  } | null;
};

export type ReportExportContextResult = {
  period: ReportPeriod;
  query_window: {
    start_at: string;
    end_at: string;
  };
  filters: {
    country: string | null;
    source_category: string | null;
    product: string | null;
    feedback_status: string | null;
  };
  fields: string[];
  desensitization: string;
  excludes: string[];
  estimated_rows: number;
  confirm_required: boolean;
  cancel_path: string;
};

export type ReportExportTaskResult = {
  task_id: string;
  status: string;
  period: ReportPeriod;
  filters: ReportExportContextResult["filters"];
  row_count: number;
  fields: string[];
  desensitization: string;
  excludes: string[];
  download_path: string;
  audit_action: string;
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
  suggested_owner_id?: number | null;
  suggested_owner_name?: string | null;
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

export type FeedbackCard = {
  token: string;
  lead: Lead;
  owner: {
    id: number;
    name: string;
  };
  ai_reason: string;
  background_summary: string;
  status_options: string[];
  judgement_options: string[];
  expires_at: string;
  submitted: boolean;
};

export type FeedbackSubmitResult = {
  id: number;
  lead_id: number;
  feedback_status: string;
  customer_judgement: string;
  remark: string;
  submitted_at: string;
};

export type FeedbackLinkExpiredContext = {
  title: string;
  message: string;
  reason_code: string;
  token_status: string;
  trace_id: string;
  request_resend_label: string;
  request_resend_hint: string;
  support_path: string;
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
  owner_id: number | null;
  owner_name: string;
  can_edit_background: boolean;
  detail_path: string;
  background: {
    auto_summary: string;
    manual_summary: string | null;
    current_summary: string;
    evidence: string;
    sources: Array<{
      type: string;
      title: string;
      detail: string;
    }>;
    confidence: string;
    updated_by: string;
    updated_at: string;
  };
  lead_history: Array<{
    id: number;
    customer_name: string;
    source: string;
    product: string;
    feedback_status: string;
    owner_name: string;
    created_at: string;
  }>;
  feedback_records: Array<{
    status: string;
    judgement: string;
    remark: string;
    owner_name: string;
    happened_at: string;
  }>;
  timeline: Array<{
    status: string;
    summary: string;
    happened_at: string;
  }>;
};

export type CustomerListItem = {
  id: number;
  name: string;
  country: string;
  customer_type: string;
  product: string;
  tier: string;
  owner_id: number | null;
  owner_name: string;
  background_summary: string;
  detail_path: string;
};

export type CustomerPageResult = {
  page: number;
  page_size: number;
  total: number;
  metrics: {
    total_customers: number;
    high_intent: number;
    active_followup: number;
    repository: number;
  };
  items: CustomerListItem[];
  empty_state?: {
    title: string;
    action_label: string;
    action_path: string;
  } | null;
};

export type CustomerFilters = {
  page?: number;
  pageSize?: number;
  country?: string;
  product?: string;
  tier?: string;
};

export type SalesUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  data_scope: string;
  enabled: boolean;
};

export type SettingsEntry = {
  key: string;
  title: string;
  description: string;
  path: string;
  status: string;
  risk_count: number;
};

export type SettingsPermission = {
  role: string;
  permissions: string[];
};

export type SettingsOverview = {
  summary: Record<string, number>;
  banner: Banner;
  entries: SettingsEntry[];
  sales_users: SalesUser[];
  permissions: SettingsPermission[];
  risks: string[];
  recent_changes: Array<{
    id: number;
    action: string;
    target_type: string;
    target_id: number | null;
    trace_id: string;
    detail: string;
    created_at: string;
  }>;
};

export type CountrySalesMapping = {
  id: number;
  country: string;
  region: string;
  sales_user_id: number;
  sales_user_name: string;
  sales_user_email: string;
  sales_user_enabled: boolean;
  active: boolean;
  updated_at: string;
  pending_count: number;
  risk_level: "normal" | "warning" | "danger";
  risk_reasons: string[];
};

export type CountrySalesMappingPageResult = {
  page: number;
  page_size: number;
  total: number;
  summary: Record<string, number>;
  sales_users: SalesUser[];
  items: CountrySalesMapping[];
  pending_items: PendingAssignment[];
  empty_state: {
    title: string;
    action_label: string;
    action_path: string;
  } | null;
};

export type ProductKnowledge = {
  id: number;
  product_type: string;
  model_name: string;
  application_scenario: string;
  ai_guidance: string;
  version: string;
  status: "active" | "draft" | "disabled";
  updated_by: number | null;
  updated_at: string;
};

export type ProductKnowledgePageResult = {
  page: number;
  page_size: number;
  total: number;
  summary: Record<string, number>;
  active_version: string;
  items: ProductKnowledge[];
  empty_state: {
    title: string;
    action_label: string;
    action_path: string;
  } | null;
  recent_changes: Array<{
    id: number;
    action: string;
    target_type: string;
    target_id: number | null;
    trace_id: string;
    detail: string;
    created_at: string;
  }>;
};

export type ProductKnowledgeContext = {
  active_version: string;
  safety_boundary: string;
  knowledge_blocks: Array<{
    id: number;
    product_type: string;
    model_name: string;
    application_scenario: string;
    ai_guidance: string;
    version: string;
  }>;
  rendered_prompt: string;
};

export type ForbiddenContext = {
  title: string;
  message: string;
  reason_code: string;
  role: string;
  from_path: string;
  trace_id: string;
  default_home_path: string;
  support_action: string;
};

const DEV_PROXY_TARGET = (import.meta.env.VITE_DEV_PROXY_TARGET ?? "").trim();
const API_BASE = import.meta.env.DEV && DEV_PROXY_TARGET ? "" : (import.meta.env.VITE_API_BASE ?? "").trim();

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

function forbiddenCode(rawDetail: unknown): string {
  if (typeof rawDetail === "object" && rawDetail !== null && "code" in rawDetail && typeof rawDetail.code === "string") {
    return rawDetail.code;
  }
  return "FORBIDDEN";
}

function redirectForbiddenIfNeeded(status: number, rawDetail: unknown, traceId: string | null): void {
  if (status !== 403 || !window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/admin/forbidden")) {
    return;
  }
  const params = new URLSearchParams({
    from: `${window.location.pathname}${window.location.search}`,
    reason: forbiddenCode(rawDetail)
  });
  if (traceId) {
    params.set("trace_id", traceId);
  }
  window.location.assign(`/admin/forbidden?${params.toString()}`);
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
    const error = new Error(message) as Error & { traceId?: string };
    error.name = typeof rawDetail?.code === "string" ? rawDetail.code : `HTTP_${response.status}`;
    const traceId = response.headers.get("x-trace-id");
    redirectForbiddenIfNeeded(response.status, rawDetail, traceId);
    if (traceId) {
      error.traceId = traceId;
    }
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
    const error = new Error(message) as Error & { traceId?: string };
    error.name = typeof rawDetail?.code === "string" ? rawDetail.code : `HTTP_${response.status}`;
    const traceId = response.headers.get("x-trace-id");
    redirectForbiddenIfNeeded(response.status, rawDetail, traceId);
    if (traceId) {
      error.traceId = traceId;
    }
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

export function fetchFeedbackCard(token: string): Promise<FeedbackCard> {
  return request<FeedbackCard>(`/api/feedback-links/${token}`);
}

export function fetchFeedbackLinkExpiredContext(token: string): Promise<FeedbackLinkExpiredContext> {
  return request<FeedbackLinkExpiredContext>(`/api/feedback-links/${token}/expired-context`);
}

export function submitFeedbackCard(
  token: string,
  payload: { feedbackStatus: string; customerJudgement: string; remark: string }
): Promise<FeedbackSubmitResult> {
  return request<FeedbackSubmitResult>(`/api/feedback-links/${token}/submit`, {
    method: "POST",
    body: JSON.stringify({
      feedback_status: payload.feedbackStatus,
      customer_judgement: payload.customerJudgement,
      remark: payload.remark
    })
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

export function fetchReportHome(filters: { period?: ReportPeriod; page?: number; pageSize?: number } = {}): Promise<ReportHomeResult> {
  const params = new URLSearchParams({
    period: filters.period ?? "day",
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 10)
  });
  return request<ReportHomeResult>(`/api/reports/home?${params.toString()}`);
}

export function retryReportHome(): Promise<ReportHomeResult["generation"]> {
  return request<ReportHomeResult["generation"]>("/api/reports/home/retry", { method: "POST" });
}

export function fetchReportPeriod(
  filters: {
    period?: ReportPeriod;
    country?: string;
    sourceCategory?: string;
    product?: string;
    feedbackStatus?: string;
    page?: number;
    pageSize?: number;
    timeoutMs?: number;
  } = {}
): Promise<ReportPeriodViewResult> {
  const params = new URLSearchParams({
    period: filters.period ?? "day",
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 10)
  });
  if (filters.country) params.set("country", filters.country);
  if (filters.sourceCategory) params.set("source_category", filters.sourceCategory);
  if (filters.product) params.set("product", filters.product);
  if (filters.feedbackStatus) params.set("feedback_status", filters.feedbackStatus);
  if (filters.timeoutMs) params.set("timeout_ms", String(filters.timeoutMs));
  return request<ReportPeriodViewResult>(`/api/reports/period?${params.toString()}`);
}

export function fetchReportMetricsDetail(
  filters: {
    period?: ReportPeriod;
    country?: string;
    sourceCategory?: string;
    product?: string;
    feedbackStatus?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<ReportMetricsDetailResult> {
  const params = new URLSearchParams({
    period: filters.period ?? "day",
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 10)
  });
  if (filters.country) params.set("country", filters.country);
  if (filters.sourceCategory) params.set("source_category", filters.sourceCategory);
  if (filters.product) params.set("product", filters.product);
  if (filters.feedbackStatus) params.set("feedback_status", filters.feedbackStatus);
  return request<ReportMetricsDetailResult>(`/api/reports/metrics?${params.toString()}`);
}

export function fetchReportExportContext(
  filters: {
    period?: ReportPeriod;
    country?: string;
    sourceCategory?: string;
    product?: string;
    feedbackStatus?: string;
  } = {}
): Promise<ReportExportContextResult> {
  const params = new URLSearchParams({ period: filters.period ?? "day" });
  if (filters.country) params.set("country", filters.country);
  if (filters.sourceCategory) params.set("source_category", filters.sourceCategory);
  if (filters.product) params.set("product", filters.product);
  if (filters.feedbackStatus) params.set("feedback_status", filters.feedbackStatus);
  return request<ReportExportContextResult>(`/api/reports/export/context?${params.toString()}`);
}

export function createReportExport(payload: {
  period?: ReportPeriod;
  country?: string;
  sourceCategory?: string;
  product?: string;
  feedbackStatus?: string;
}): Promise<ReportExportTaskResult> {
  return request<ReportExportTaskResult>("/api/reports/export", {
    method: "POST",
    body: JSON.stringify({
      period: payload.period ?? "day",
      country: payload.country || null,
      source_category: payload.sourceCategory || null,
      product: payload.product || null,
      feedback_status: payload.feedbackStatus || null
    })
  });
}

export async function downloadReportExport(taskId: string): Promise<string> {
  const token = getToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE}/api/reports/export/${taskId}/download`, { headers });
  if (!response.ok) {
    throw new Error("报表导出下载失败");
  }
  return response.text();
}

export function fetchCustomer(customerId: string): Promise<Customer> {
  return request<Customer>(`/api/customers/${customerId}`);
}

export function fetchCustomers(filters: CustomerFilters = {}): Promise<CustomerPageResult> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 20)
  });
  if (filters.country) params.set("country", filters.country);
  if (filters.product) params.set("product", filters.product);
  if (filters.tier) params.set("tier", filters.tier);
  return request<CustomerPageResult>(`/api/customers?${params.toString()}`);
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

export function fetchSettingsOverview(): Promise<SettingsOverview> {
  return request<SettingsOverview>("/api/settings/overview");
}

export function fetchCountrySalesMappings(filters: {
  country?: string;
  region?: string;
  status?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<CountrySalesMappingPageResult> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 20)
  });
  if (filters.country) params.set("country", filters.country);
  if (filters.region) params.set("region", filters.region);
  if (filters.status) params.set("status", filters.status);
  return request<CountrySalesMappingPageResult>(`/api/settings/country-sales?${params.toString()}`);
}

export function saveCountrySalesMapping(payload: {
  country: string;
  region: string;
  salesUserId: number;
  active: boolean;
}): Promise<CountrySalesMapping> {
  return request<CountrySalesMapping>("/api/settings/country-sales", {
    method: "PUT",
    body: JSON.stringify({
      country: payload.country,
      region: payload.region,
      sales_user_id: payload.salesUserId,
      active: payload.active
    })
  });
}

export function fetchProductKnowledge(filters: {
  query?: string;
  productType?: string;
  status?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<ProductKnowledgePageResult> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 20)
  });
  if (filters.query) params.set("query", filters.query);
  if (filters.productType) params.set("product_type", filters.productType);
  if (filters.status) params.set("status", filters.status);
  return request<ProductKnowledgePageResult>(`/api/settings/product-knowledge?${params.toString()}`);
}

export function saveProductKnowledge(payload: {
  productType: string;
  modelName: string;
  applicationScenario: string;
  aiGuidance: string;
  status: string;
}): Promise<ProductKnowledge> {
  return request<ProductKnowledge>("/api/settings/product-knowledge", {
    method: "PUT",
    body: JSON.stringify({
      product_type: payload.productType,
      model_name: payload.modelName,
      application_scenario: payload.applicationScenario,
      ai_guidance: payload.aiGuidance,
      status: payload.status
    })
  });
}

export function updateProductKnowledgeStatus(id: number, status: string): Promise<ProductKnowledge> {
  return request<ProductKnowledge>(`/api/settings/product-knowledge/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status })
  });
}

export function fetchProductKnowledgeContext(): Promise<ProductKnowledgeContext> {
  return request<ProductKnowledgeContext>("/api/ai/product-knowledge/context");
}

export function fetchForbiddenContext(params: { from?: string; reason?: string; traceId?: string } = {}): Promise<ForbiddenContext> {
  const search = new URLSearchParams({
    from: params.from || "/admin/dashboard",
    reason: params.reason || "FORBIDDEN"
  });
  if (params.traceId) {
    search.set("trace_id", params.traceId);
  }
  return request<ForbiddenContext>(`/api/forbidden/context?${search.toString()}`);
}

export function fetchSalesUsers(): Promise<SalesUser[]> {
  return request<SalesUser[]>("/api/settings/sales-users");
}

export function createSalesUser(payload: {
  name: string;
  email: string;
  password: string;
  role: string;
  dataScope: string;
  enabled: boolean;
}): Promise<SalesUser> {
  return request<SalesUser>("/api/settings/sales-users", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      role: payload.role,
      data_scope: payload.dataScope,
      enabled: payload.enabled
    })
  });
}

export function updateSettingsBanner(payload: {
  title: string;
  body: string;
  imageUrl: string;
  linkUrl?: string | null;
  active: boolean;
}): Promise<Banner> {
  return request<Banner>("/api/settings/banner", {
    method: "PUT",
    body: JSON.stringify({
      title: payload.title,
      body: payload.body,
      image_url: payload.imageUrl,
      link_url: payload.linkUrl || null,
      active: payload.active
    })
  });
}

export function updateSettingsPermissions(payload: { role: string; permissions: string[] }): Promise<SettingsPermission> {
  return request<SettingsPermission>("/api/settings/permissions", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

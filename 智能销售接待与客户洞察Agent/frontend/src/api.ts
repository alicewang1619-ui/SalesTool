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
  email: string;
  organization: string;
  country: string;
  customer_type: string;
  product: string;
  source_category: string;
  source_label: string;
  score_label: string;
  feedback_status: string;
  owner_id: number | null;
  owner_name: string;
  created_at: string | null;
};

export type ScoreDimension = {
  key: string;
  label: string;
  earned: boolean;
  point: number;
  reason: string;
};

export type ScoreSummary = {
  total: number;
  max_score: number;
  label: string;
  dimensions: ScoreDimension[];
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
  score_dimensions: ScoreDimension[];
  score_total: number;
  score_max: number;
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
  time_scope: {
    scope: string;
    label: string;
    start_at: string | null;
    end_at: string | null;
  };
  metric_links: Record<string, string>;
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
  period_label: string;
  period_granularity: string;
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
  auto_assigned_rows: number;
  pending_assignment_rows: number;
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
  score_summary?: ScoreSummary | null;
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
  cycle?: "today" | "yesterday" | "date" | "all";
  date?: string;
};

export type LeadFilters = {
  page?: number;
  pageSize?: number;
  sourceCategory?: string;
  timeScope?: "today" | "yesterday" | "date" | "all";
  date?: string;
  score?: string;
};

export type Customer = {
  id: number;
  name: string;
  email: string;
  organization: string;
  country: string;
  customer_type: string;
  product: string;
  tier: string;
  demand_summary: string;
  source_summary: string;
  first_inquiry_at: string;
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
  signals: CustomerSignal[];
  score_summary: ScoreSummary;
};

export type CustomerListItem = {
  id: number;
  name: string;
  email: string;
  organization: string;
  country: string;
  customer_type: string;
  product: string;
  tier: string;
  first_inquiry_at: string;
  source_summary: string;
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
  timeScope?: "today" | "yesterday" | "date" | "all";
  date?: string;
};

export type BulkEmailFilters = {
  country?: string | null;
  product?: string | null;
  tier?: string | null;
  customerType?: string | null;
  sourceQuery?: string | null;
  feedbackStatus?: string | null;
};

export type BulkEmailPreview = {
  filters: {
    country?: string | null;
    product?: string | null;
    tier?: string | null;
    customer_type?: string | null;
    source_query?: string | null;
    feedback_status?: string | null;
  };
  target_count: number;
  recipients_preview: CustomerListItem[];
  warnings: string[];
};

export type BulkEmailCampaign = {
  campaign_id: string;
  status: string;
  target_count: number;
  subject: string;
  sender_email: string;
  created_at: string;
};

export type CustomerSignalSource = "website_public" | "email_interaction" | "sales_feedback" | "manual";

export type CustomerSignal = {
  id: number;
  customer_id: number;
  customer_name: string;
  country: string;
  product: string;
  signal_source: CustomerSignalSource;
  source_label: string;
  signal_title: string;
  signal_summary: string;
  evidence_url?: string | null;
  evidence_text: string;
  confidence: "高" | "中" | "低" | "待复核";
  status: "待复核" | "已确认" | "可再营销" | "已归档";
  observed_at: string;
  created_by: number | null;
  created_by_name: string;
  updated_at: string;
  customer_detail_path: string;
};

export type CustomerSignalPageResult = {
  page: number;
  page_size: number;
  total: number;
  summary: Record<string, number>;
  items: CustomerSignal[];
  empty_state?: {
    title: string;
    action_label: string;
    action_path: string;
  } | null;
};

export type CustomerSignalContext = {
  safety_boundary: string;
  customer_id: number | null;
  authorized_sources: CustomerSignalSource[];
  signals: CustomerSignal[];
  rendered_prompt: string;
};

export type CustomerSignalFilters = {
  page?: number;
  pageSize?: number;
  source?: CustomerSignalSource;
  status?: string;
  customerId?: number;
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

export type AIModelOption = {
  value: string;
  label: string;
  provider: string;
  scenario: string;
  capability: string;
  status: string;
  api_base_url?: string;
  endpoint_path?: string;
  auth_type?: string;
  api_key_configured?: boolean;
  api_key?: string;
};

export type AIModelUseCase = {
  key: string;
  label: string;
  description: string;
};

export type EmailWriterRole = {
  key: string;
  name: string;
  display_name: string;
  style: string;
  skills: string[];
  best_for: string;
  status: string;
};

export type AIModelConfig = {
  selected_model: string;
  selected_label: string;
  provider: string;
  scenario: string;
  options: AIModelOption[];
  use_cases: AIModelUseCase[];
  use_case_bindings: Record<string, string>;
  email_writers: EmailWriterRole[];
  default_email_writer: string;
  updated_by: number | null;
  updated_at: string | null;
};

export type SourceDictionarySetting = {
  id: number | null;
  category: string;
  label: string;
  enabled: boolean;
};

export type ChannelConfig = {
  key: string;
  name: string;
  source_category: string;
  access_method: string;
  endpoint: string;
  enabled: boolean;
  status: string;
};

export type ReminderRule = {
  key: string;
  name: string;
  trigger_hours: number;
  target: string;
  channel: string;
  enabled: boolean;
};

export type GlobalMailSettings = {
  sender_email: string;
  sender_name: string;
  smtp_host: string;
  smtp_port: number;
  username: string;
  use_tls: boolean;
  enabled: boolean;
  configured: boolean;
  test_status: string;
};

export type SettingsOverview = {
  summary: Record<string, number>;
  banner: Banner;
  entries: SettingsEntry[];
  sales_users: SalesUser[];
  permissions: SettingsPermission[];
  ai_model: AIModelConfig;
  source_dictionary: SourceDictionarySetting[];
  channel_configs: ChannelConfig[];
  reminder_rules: ReminderRule[];
  mail_settings: GlobalMailSettings;
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

export type NurtureAttachment = {
  filename: string;
  content_type: string;
  size: number;
  uploaded_by: string;
  uploaded_at: string;
};

export type NurturePromptContext = {
  safety_boundary: string;
  customer_summary: string;
  customer_background: string;
  customer_note: string;
  sales_feedback: string[];
  recommended_next_action: string;
  writer_role_name: string;
  writer_role_style: string;
  writer_role_skills: string[];
  attachments: NurtureAttachment[];
  rendered_prompt: string;
};

export type NurtureTask = {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_tier: string;
  product: string;
  owner_name: string;
  recommended_next_action: string;
  customer_note: string;
  nurture_reason: string;
  sender_email: string;
  recipient_email: string;
  email_subject: string;
  draft_content: string;
  generation_prompt: string;
  prompt_context_snapshot: NurturePromptContext;
  attachments: NurtureAttachment[];
  model_provider: string;
  model_version: string;
  writer_role_key: string;
  writer_role_name: string;
  writer_role_style: string;
  writer_role_skills: string[];
  email_status: string;
  approval_status: "pending" | "confirmed" | "cancelled";
  detail_path: string;
  customer_detail_path: string;
  updated_at: string;
};

export type NurtureTaskPageResult = {
  page: number;
  page_size: number;
  total: number;
  summary: Record<string, number>;
  items: NurtureTask[];
  empty_state?: {
    title: string;
    action_label: string;
    action_path: string;
  } | null;
};

export type MyProfile = {
  id: number;
  name: string;
  email: string;
  role: string;
  data_scope: string;
  email_settings: {
    sender_email: string;
    sender_name: string;
    smtp_host: string;
    configured: boolean;
  };
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
      typeof rawDetail === "string"
        ? rawDetail
        : typeof rawDetail?.message === "string"
          ? rawDetail.message
          : Array.isArray(rawDetail)
            ? rawDetail.map((item) => item?.msg).filter(Boolean).join("；") || "请求失败"
            : "请求失败";
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
      typeof rawDetail === "string"
        ? rawDetail
        : typeof rawDetail?.message === "string"
          ? rawDetail.message
          : Array.isArray(rawDetail)
            ? rawDetail.map((item) => item?.msg).filter(Boolean).join("；") || "请求失败"
            : "请求失败";
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
  if (filters.timeScope && filters.timeScope !== "all") params.set("time_scope", filters.timeScope);
  if (filters.date) params.set("date", filters.date);
  if (filters.score) params.set("score", filters.score);
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

export async function downloadImportTemplate(): Promise<{ filename: string; content: string }> {
  const token = getToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE}/api/import-template`, { headers });
  if (!response.ok) {
    throw new Error("导入模板下载失败");
  }
  const disposition = response.headers.get("content-disposition") || "";
  const filenameMatch = /filename="?([^";]+)"?/i.exec(disposition);
  return {
    filename: filenameMatch?.[1] || "lead-import-template.csv",
    content: await response.text()
  };
}

export function fetchImportJob(taskId: string): Promise<ImportJob> {
  return request<ImportJob>(`/api/import-jobs/${taskId}`);
}

export function retryImportJob(taskId: string): Promise<ImportJob> {
  return request<ImportJob>(`/api/import-jobs/${taskId}/retry`, { method: "POST" });
}

export function fetchPendingAssignments(filters: { page?: number; pageSize?: number; timeScope?: string; date?: string } = {}): Promise<PageResult<PendingAssignment>> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 20)
  });
  if (filters.timeScope && filters.timeScope !== "all") params.set("time_scope", filters.timeScope);
  if (filters.date) params.set("date", filters.date);
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
  if (filters.date) params.set("date", filters.date);
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
    throw new Error("鎶ヨ〃瀵煎嚭涓嬭浇澶辫触");
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
  if (filters.timeScope && filters.timeScope !== "all") params.set("time_scope", filters.timeScope);
  if (filters.date) params.set("date", filters.date);
  return request<CustomerPageResult>(`/api/customers?${params.toString()}`);
}

export function updateCustomerBackground(customerId: string, manualSummary: string): Promise<Customer> {
  return request<Customer>(`/api/customers/${customerId}/background`, {
    method: "PUT",
    body: JSON.stringify({ manual_summary: manualSummary })
  });
}

export function createNurtureTask(customerId: number): Promise<NurtureTask> {
  return request<NurtureTask>("/api/nurture-tasks", {
    method: "POST",
    body: JSON.stringify({ customer_id: customerId })
  });
}

function bulkEmailFiltersToApi(filters: BulkEmailFilters) {
  return {
    country: filters.country || null,
    product: filters.product || null,
    tier: filters.tier || null,
    customer_type: filters.customerType || null,
    source_query: filters.sourceQuery || null,
    feedback_status: filters.feedbackStatus || null
  };
}

export function previewBulkEmailCampaign(filters: BulkEmailFilters): Promise<BulkEmailPreview> {
  return request<BulkEmailPreview>("/api/email-campaigns/preview", {
    method: "POST",
    body: JSON.stringify(bulkEmailFiltersToApi(filters))
  });
}

export function createBulkEmailCampaign(payload: {
  filters: BulkEmailFilters;
  subject: string;
  body: string;
}): Promise<BulkEmailCampaign> {
  return request<BulkEmailCampaign>("/api/email-campaigns", {
    method: "POST",
    body: JSON.stringify({
      filters: bulkEmailFiltersToApi(payload.filters),
      subject: payload.subject,
      body: payload.body
    })
  });
}

export function fetchCustomerSignals(filters: CustomerSignalFilters = {}): Promise<CustomerSignalPageResult> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 20)
  });
  if (filters.source) params.set("source", filters.source);
  if (filters.status) params.set("status", filters.status);
  if (filters.customerId) params.set("customer_id", String(filters.customerId));
  return request<CustomerSignalPageResult>(`/api/customer-signals?${params.toString()}`);
}

export function createCustomerSignal(payload: {
  customerId: number;
  signalSource: CustomerSignalSource;
  signalTitle: string;
  signalSummary: string;
  evidenceUrl?: string;
  evidenceText: string;
  confidence: string;
  status: string;
}): Promise<CustomerSignal> {
  return request<CustomerSignal>("/api/customer-signals", {
    method: "POST",
    body: JSON.stringify({
      customer_id: payload.customerId,
      signal_source: payload.signalSource,
      signal_title: payload.signalTitle,
      signal_summary: payload.signalSummary,
      evidence_url: payload.evidenceUrl || null,
      evidence_text: payload.evidenceText,
      confidence: payload.confidence,
      status: payload.status
    })
  });
}

export function fetchCustomerSignalContext(customerId?: number): Promise<CustomerSignalContext> {
  const params = new URLSearchParams();
  if (customerId) params.set("customer_id", String(customerId));
  const query = params.toString();
  return request<CustomerSignalContext>(`/api/customer-signals/context${query ? `?${query}` : ""}`);
}

export function fetchNurtureTasks(filters: {
  status?: string;
  customerId?: number;
  page?: number;
  pageSize?: number;
} = {}): Promise<NurtureTaskPageResult> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 20)
  });
  if (filters.status) params.set("status", filters.status);
  if (filters.customerId) params.set("customer_id", String(filters.customerId));
  return request<NurtureTaskPageResult>(`/api/nurture-tasks?${params.toString()}`);
}

export function fetchNurtureTask(taskId: string): Promise<NurtureTask> {
  return request<NurtureTask>(`/api/nurture-tasks/${taskId}`);
}

export function updateNurtureTask(
  taskId: number,
  payload: {
    recommendedNextAction: string;
    customerNote: string;
    nurtureReason: string;
    emailSubject?: string;
    draftContent: string;
    generationPrompt: string;
    writerRoleKey?: string;
  }
): Promise<NurtureTask> {
  return request<NurtureTask>(`/api/nurture-tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify({
      recommended_next_action: payload.recommendedNextAction,
      customer_note: payload.customerNote,
      nurture_reason: payload.nurtureReason,
      email_subject: payload.emailSubject ?? null,
      draft_content: payload.draftContent,
      generation_prompt: payload.generationPrompt,
      writer_role_key: payload.writerRoleKey ?? null
    })
  });
}

export function uploadNurtureAttachment(taskId: number, file: File): Promise<NurtureTask> {
  const body = new FormData();
  body.append("file", file);
  return requestForm<NurtureTask>(`/api/nurture-tasks/${taskId}/attachments`, body);
}

export function regenerateNurtureTask(taskId: number, generationPrompt: string, writerRoleKey?: string): Promise<NurtureTask> {
  return request<NurtureTask>(`/api/nurture-tasks/${taskId}/regenerate`, {
    method: "POST",
    body: JSON.stringify({ generation_prompt: generationPrompt, writer_role_key: writerRoleKey ?? null })
  });
}

export function confirmNurtureTask(taskId: number, draftContent: string, emailSubject?: string): Promise<NurtureTask> {
  return request<NurtureTask>(`/api/nurture-tasks/${taskId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ draft_content: draftContent, email_subject: emailSubject || null })
  });
}

export function fetchMyProfile(): Promise<MyProfile> {
  return request<MyProfile>("/api/me/profile");
}

export function updateMyProfile(payload: {
  name: string;
  senderEmail: string;
  senderName: string;
  smtpHost: string;
}): Promise<MyProfile> {
  return request<MyProfile>("/api/me/profile", {
    method: "PUT",
    body: JSON.stringify({
      name: payload.name,
      sender_email: payload.senderEmail,
      sender_name: payload.senderName,
      smtp_host: payload.smtpHost
    })
  });
}

export function updateMyPassword(payload: { oldPassword: string; newPassword: string }): Promise<{ changed: boolean }> {
  return request<{ changed: boolean }>("/api/me/password", {
    method: "PUT",
    body: JSON.stringify({ old_password: payload.oldPassword, new_password: payload.newPassword })
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

export function updateSalesUser(
  userId: number,
  payload: {
    name: string;
    email: string;
    role: string;
    dataScope: string;
    enabled: boolean;
  }
): Promise<SalesUser> {
  return request<SalesUser>(`/api/settings/sales-users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      role: payload.role,
      data_scope: payload.dataScope,
      enabled: payload.enabled
    })
  });
}

export function deleteSalesUser(userId: number): Promise<{
  deleted: boolean;
  user_id: number;
  affected_leads: number;
  affected_customers: number;
}> {
  return request<{
    deleted: boolean;
    user_id: number;
    affected_leads: number;
    affected_customers: number;
  }>(`/api/settings/sales-users/${userId}`, {
    method: "DELETE"
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

export function updateSettingsMail(payload: {
  senderEmail: string;
  senderName: string;
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  useTls: boolean;
  enabled: boolean;
  testSendTo?: string;
}): Promise<GlobalMailSettings> {
  return request<GlobalMailSettings>("/api/settings/mail", {
    method: "PUT",
    body: JSON.stringify({
      sender_email: payload.senderEmail,
      sender_name: payload.senderName,
      smtp_host: payload.smtpHost,
      smtp_port: payload.smtpPort,
      username: payload.username,
      password: payload.password,
      use_tls: payload.useTls,
      enabled: payload.enabled,
      test_send_to: payload.testSendTo || null
    })
  });
}

export function updateSettingsSourceDictionary(items: SourceDictionarySetting[]): Promise<SourceDictionarySetting[]> {
  return request<SourceDictionarySetting[]>("/api/settings/source-dictionary", {
    method: "PUT",
    body: JSON.stringify(items)
  });
}

export function updateSettingsChannels(items: ChannelConfig[]): Promise<ChannelConfig[]> {
  return request<ChannelConfig[]>("/api/settings/channels", {
    method: "PUT",
    body: JSON.stringify(items)
  });
}

export function updateSettingsReminderRules(items: ReminderRule[]): Promise<ReminderRule[]> {
  return request<ReminderRule[]>("/api/settings/reminder-rules", {
    method: "PUT",
    body: JSON.stringify(items)
  });
}

export function updateSettingsAIModel(payload: {
  selectedModel: string;
  options?: AIModelOption[];
  useCases?: AIModelUseCase[];
  useCaseBindings?: Record<string, string>;
  emailWriters?: EmailWriterRole[];
  defaultEmailWriter?: string;
}): Promise<AIModelConfig> {
  return request<AIModelConfig>("/api/settings/ai-model", {
    method: "PUT",
    body: JSON.stringify({
      selected_model: payload.selectedModel,
      options: payload.options,
      use_cases: payload.useCases,
      use_case_bindings: payload.useCaseBindings,
      email_writers: payload.emailWriters,
      default_email_writer: payload.defaultEmailWriter
    })
  });
}

export function fetchEmailWriterRoles(): Promise<{ default_email_writer: string; items: EmailWriterRole[] }> {
  return request<{ default_email_writer: string; items: EmailWriterRole[] }>("/api/ai/email-writers");
}

from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str


class BannerOut(BaseModel):
    title: str
    body: str
    image_url: str
    link_url: str | None = None


class LeadOut(BaseModel):
    id: int
    customer_name: str
    email: str = ""
    organization: str = ""
    country: str
    customer_type: str
    product: str
    source_category: str
    source_label: str
    score_label: str
    feedback_status: str
    owner_id: int | None = None
    owner_name: str = "未分配"
    created_at: datetime | None = None


class LeadProfileSummary(BaseModel):
    customer_type: str
    country: str
    product: str
    source: str


class LeadAssignmentOut(BaseModel):
    owner_id: int | None
    owner_name: str
    status: str


class LeadDetailOut(LeadOut):
    raw_inquiry: str
    conversation_history: list[str]
    profile_summary: LeadProfileSummary
    score_reasons: list[str]
    background_summary: str
    background_confidence: str
    background_updated_at: datetime | None = None
    customer_id: int | None = None
    assignment: LeadAssignmentOut
    feedback_history: list[str]
    background_task_status: str


class LeadAssignmentUpdate(BaseModel):
    owner_id: int | None = None
    feedback_status: str = Field(min_length=2, max_length=80)


class PageResult(BaseModel):
    page: int
    page_size: int
    total: int
    items: list[LeadOut]


class PendingAssignmentOut(LeadOut):
    owner_id: int | None
    owner_name: str
    suggested_owner_id: int | None = None
    suggested_owner_name: str | None = None
    pending_reasons: list[str]
    detail_path: str
    configure_mapping_path: str | None = None


class PendingAssignmentPage(BaseModel):
    page: int
    page_size: int
    total: int
    items: list[PendingAssignmentOut]


class AssignmentConfirmRequest(BaseModel):
    owner_id: int
    expected_owner_id: int | None = None


class AssignmentConfirmOut(BaseModel):
    lead_id: int
    owner_id: int
    owner_name: str
    feedback_link_token: str
    feedback_link_path: str
    expires_at: str


class FeedbackOwnerOut(BaseModel):
    id: int
    name: str


class FeedbackCardOut(BaseModel):
    token: str
    lead: LeadOut
    owner: FeedbackOwnerOut
    ai_reason: str
    background_summary: str
    status_options: list[str]
    judgement_options: list[str]
    expires_at: str
    submitted: bool


class FeedbackSubmitRequest(BaseModel):
    feedback_status: str = Field(min_length=2, max_length=80)
    customer_judgement: str = Field(min_length=2, max_length=120)
    remark: str = Field(default="", max_length=1000)


class FeedbackSubmitOut(BaseModel):
    id: int
    lead_id: int
    feedback_status: str
    customer_judgement: str
    remark: str
    submitted_at: datetime


class FeedbackLinkExpiredContextOut(BaseModel):
    title: str
    message: str
    reason_code: str
    token_status: str
    trace_id: str
    request_resend_label: str
    request_resend_hint: str
    support_path: str


class FeedbackLinkResendOut(BaseModel):
    old_token: str
    new_token: str
    feedback_link_path: str
    expires_at: datetime
    lead_id: int
    owner_id: int
    owner_name: str
    audit_action: str


class ImportFailureOut(BaseModel):
    row_number: int
    customer_name: str
    reason: str


class ImportJobOut(BaseModel):
    task_id: str
    filename: str
    status: str
    total_rows: int
    processed_rows: int
    success_rows: int
    failed_rows: int
    auto_assigned_rows: int
    pending_assignment_rows: int
    failures: list[ImportFailureOut]


class DashboardMetrics(BaseModel):
    today_inquiries: int
    valid_leads: int
    unfeedback: int
    website_kpi: int


class DashboardTodoOut(LeadOut):
    detail_path: str


class DashboardTimelineItem(BaseModel):
    label: str
    value: str


class DashboardOut(BaseModel):
    page: int
    page_size: int
    total: int
    metrics: DashboardMetrics
    time_scope: dict[str, str | None] = Field(default_factory=dict)
    metric_links: dict[str, str] = Field(default_factory=dict)
    ai_summary: str
    assignment_timeline: list[DashboardTimelineItem]
    items: list[DashboardTodoOut]


class ReportMetricCardOut(BaseModel):
    key: str
    label: str
    value: int
    unit: str = ""
    hint: str = ""


class ReportPeriodEntryOut(BaseModel):
    period: str
    label: str
    path: str


class ReportQueryWindowOut(BaseModel):
    start_at: datetime
    end_at: datetime


class ReportLimitsOut(BaseModel):
    page: int
    page_size: int


class ReportChannelQualityItemOut(BaseModel):
    source_category: str
    inquiry_count: int
    valid_count: int
    valid_rate: int


class ReportChannelQualityOut(BaseModel):
    total: int
    items: list[ReportChannelQualityItemOut]


class ReportWebsiteKpiOut(BaseModel):
    attribution_rate: int
    ai_completion_rate: int
    assignment_rate: int
    sales_feedback_rate: int
    entered_customer_pool: int


class ReportGenerationOut(BaseModel):
    status: str
    updated_at: datetime
    retry_path: str


class ReportHomeOut(BaseModel):
    period: str
    query_window: ReportQueryWindowOut
    limits: ReportLimitsOut
    metrics: list[ReportMetricCardOut]
    period_entries: list[ReportPeriodEntryOut]
    channel_quality: ReportChannelQualityOut
    website_kpi: ReportWebsiteKpiOut
    generation: ReportGenerationOut


class ReportRetryOut(BaseModel):
    status: str
    updated_at: datetime
    retry_path: str


class ReportPeriodMetricsOut(BaseModel):
    inquiries: int
    valid_leads: int
    unfeedback: int
    website_kpi: int


class ReportPeriodFiltersOut(BaseModel):
    country: str | None = None
    source_category: str | None = None
    product: str | None = None
    feedback_status: str | None = None


class ReportBreakdownItemOut(BaseModel):
    label: str
    inquiry_count: int
    valid_count: int
    valid_rate: int


class ReportPeriodBreakdownsOut(BaseModel):
    countries: list[ReportBreakdownItemOut]
    channels: list[ReportBreakdownItemOut]
    products: list[ReportBreakdownItemOut]
    feedback_statuses: list[ReportBreakdownItemOut]


class ReportPeriodLeadItemOut(BaseModel):
    id: int
    customer_name: str
    country: str
    source_category: str
    product: str
    feedback_status: str
    score_label: str
    owner_id: int | None
    detail_path: str


class ReportPeriodDownstreamOut(BaseModel):
    metrics_path: str
    export_path: str
    export_requires_confirmation: bool


class ReportPeriodOut(BaseModel):
    period: str
    period_label: str
    period_granularity: str
    query_window: ReportQueryWindowOut
    filters: ReportPeriodFiltersOut
    limits: ReportLimitsOut
    metrics: ReportPeriodMetricsOut
    breakdowns: ReportPeriodBreakdownsOut
    items: list[ReportPeriodLeadItemOut]
    total: int
    downstream: ReportPeriodDownstreamOut


class ReportMetricDetailGroupItemOut(BaseModel):
    key: str
    label: str
    value: int
    unit: str = ""
    hint: str = ""


class ReportMetricDetailLeadItemOut(BaseModel):
    lead_id: int
    customer_id: int | None = None
    customer_name: str
    country: str
    source_category: str
    source_label: str
    product: str
    feedback_status: str
    score_label: str
    owner_id: int | None = None
    lead_detail_path: str
    customer_detail_path: str | None = None


class ReportMetricDetailExportOut(BaseModel):
    fields: list[str]
    desensitization: str
    excludes: list[str]


class ReportMetricDetailEmptyStateOut(BaseModel):
    title: str
    action_label: str
    action_path: str


class ReportMetricDetailOut(BaseModel):
    period: str
    query_window: ReportQueryWindowOut
    filters: ReportPeriodFiltersOut
    limits: ReportLimitsOut
    metric_cards: list[ReportMetricCardOut]
    detail_groups: dict[str, list[ReportMetricDetailGroupItemOut]]
    items: list[ReportMetricDetailLeadItemOut]
    total: int
    downstream: ReportPeriodDownstreamOut
    export_summary: ReportMetricDetailExportOut
    empty_state: ReportMetricDetailEmptyStateOut | None = None


class ReportExportContextOut(BaseModel):
    period: str
    query_window: ReportQueryWindowOut
    filters: ReportPeriodFiltersOut
    fields: list[str]
    desensitization: str
    excludes: list[str]
    estimated_rows: int
    confirm_required: bool
    cancel_path: str


class ReportExportCreateRequest(BaseModel):
    period: str = Field(default="day", pattern="^(day|month|quarter|year)$")
    country: str | None = None
    source_category: str | None = None
    product: str | None = None
    feedback_status: str | None = None


class ReportExportTaskOut(BaseModel):
    task_id: str
    status: str
    period: str
    filters: ReportPeriodFiltersOut
    row_count: int
    fields: list[str]
    desensitization: str
    excludes: list[str]
    download_path: str
    audit_action: str


class CustomerBackgroundSourceOut(BaseModel):
    type: str
    title: str
    detail: str


class CustomerBackgroundOut(BaseModel):
    auto_summary: str
    manual_summary: str | None
    current_summary: str = ""
    evidence: str
    sources: list[CustomerBackgroundSourceOut] = Field(default_factory=list)
    confidence: str
    updated_by: str
    updated_at: datetime


class CustomerOut(BaseModel):
    id: int
    name: str
    email: str
    organization: str
    country: str
    customer_type: str
    product: str
    tier: str
    demand_summary: str
    source_summary: str
    first_inquiry_at: datetime
    background: CustomerBackgroundOut


class CustomerLeadHistoryOut(BaseModel):
    id: int
    customer_name: str
    source: str
    product: str
    feedback_status: str
    owner_name: str
    created_at: datetime


class CustomerFeedbackRecordOut(BaseModel):
    status: str
    judgement: str
    remark: str
    owner_name: str
    happened_at: datetime


class CustomerTimelineItemOut(BaseModel):
    status: str
    summary: str
    happened_at: datetime


class CustomerDetailOut(CustomerOut):
    owner_id: int | None
    owner_name: str
    can_edit_background: bool
    detail_path: str
    lead_history: list[CustomerLeadHistoryOut]
    feedback_records: list[CustomerFeedbackRecordOut]
    timeline: list[CustomerTimelineItemOut]
    signals: list["CustomerSignalOut"] = Field(default_factory=list)


class CustomerListItem(BaseModel):
    id: int
    name: str
    email: str
    organization: str
    country: str
    customer_type: str
    product: str
    tier: str
    first_inquiry_at: datetime
    source_summary: str
    owner_id: int | None
    owner_name: str
    background_summary: str
    detail_path: str


class CustomerPoolMetrics(BaseModel):
    total_customers: int
    high_intent: int
    active_followup: int
    repository: int


class EmptyStateOut(BaseModel):
    title: str
    action_label: str
    action_path: str


class CustomerPage(BaseModel):
    page: int
    page_size: int
    total: int
    metrics: CustomerPoolMetrics
    items: list[CustomerListItem]
    empty_state: EmptyStateOut | None = None


class CustomerBackgroundUpdate(BaseModel):
    manual_summary: str = Field(min_length=10, max_length=4000)


class CustomerSignalOut(BaseModel):
    id: int
    customer_id: int
    customer_name: str
    country: str
    product: str
    signal_source: str
    source_label: str
    signal_title: str
    signal_summary: str
    evidence_url: str | None = None
    evidence_text: str
    confidence: str
    status: str
    observed_at: datetime
    created_by: int | None
    created_by_name: str
    updated_at: datetime
    customer_detail_path: str


class CustomerSignalPage(BaseModel):
    page: int
    page_size: int
    total: int
    summary: dict[str, int]
    items: list[CustomerSignalOut]
    empty_state: EmptyStateOut | None = None


class CustomerSignalCreateRequest(BaseModel):
    customer_id: int
    signal_source: str = Field(pattern="^(website_public|email_interaction|sales_feedback|manual)$")
    signal_title: str = Field(min_length=2, max_length=160)
    signal_summary: str = Field(min_length=5, max_length=4000)
    evidence_url: str | None = Field(default=None, max_length=500)
    evidence_text: str = Field(default="", max_length=4000)
    confidence: str = Field(pattern="^(高|中|低|待复核)$")
    status: str = Field(pattern="^(待复核|已确认|可再营销|已归档)$")
    observed_at: datetime | None = None


class CustomerSignalContextOut(BaseModel):
    safety_boundary: str
    customer_id: int | None = None
    authorized_sources: list[str]
    signals: list[CustomerSignalOut]
    rendered_prompt: str


class NurtureAttachmentOut(BaseModel):
    filename: str
    content_type: str
    size: int
    uploaded_by: str
    uploaded_at: datetime


class NurturePromptContextOut(BaseModel):
    safety_boundary: str
    customer_summary: str
    customer_background: str
    customer_note: str
    sales_feedback: list[str]
    recommended_next_action: str
    attachments: list[NurtureAttachmentOut]
    rendered_prompt: str


class NurtureTaskOut(BaseModel):
    id: int
    customer_id: int
    customer_name: str
    customer_tier: str
    product: str
    owner_name: str
    recommended_next_action: str
    customer_note: str
    nurture_reason: str
    sender_email: str
    recipient_email: str
    email_subject: str
    draft_content: str
    generation_prompt: str
    prompt_context_snapshot: NurturePromptContextOut
    attachments: list[NurtureAttachmentOut]
    model_provider: str
    model_version: str
    email_status: str
    approval_status: str
    detail_path: str
    customer_detail_path: str
    updated_at: datetime


class NurtureTaskPage(BaseModel):
    page: int
    page_size: int
    total: int
    summary: dict[str, int]
    items: list[NurtureTaskOut]
    empty_state: EmptyStateOut | None = None


class NurtureTaskUpdateRequest(BaseModel):
    recommended_next_action: str = Field(min_length=5, max_length=1000)
    customer_note: str = Field(default="", max_length=2000)
    nurture_reason: str = Field(min_length=5, max_length=2000)
    email_subject: str | None = Field(default=None, max_length=255)
    draft_content: str = Field(min_length=10, max_length=8000)
    generation_prompt: str = Field(default="", max_length=4000)


class NurtureTaskRegenerateRequest(BaseModel):
    generation_prompt: str = Field(default="", max_length=4000)


class NurtureTaskConfirmRequest(BaseModel):
    draft_content: str = Field(min_length=10, max_length=8000)
    email_subject: str | None = Field(default=None, max_length=255)


class EmailSettingsOut(BaseModel):
    sender_email: str
    sender_name: str
    smtp_host: str = ""
    configured: bool = False


class MyProfileOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    data_scope: str
    email_settings: EmailSettingsOut


class MyProfileUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    sender_email: str = Field(min_length=5, max_length=255)
    sender_name: str = Field(min_length=2, max_length=120)
    smtp_host: str = Field(default="", max_length=255)


class PasswordUpdateRequest(BaseModel):
    old_password: str = Field(min_length=1, max_length=120)
    new_password: str = Field(min_length=8, max_length=120)


class PasswordUpdateOut(BaseModel):
    changed: bool


class SalesUserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    data_scope: str
    enabled: bool


class SettingsEntryOut(BaseModel):
    key: str
    title: str
    description: str
    path: str
    status: str
    risk_count: int = 0


class SettingsPermissionOut(BaseModel):
    role: str
    permissions: list[str]


class AIModelOptionOut(BaseModel):
    value: str
    label: str
    provider: str
    scenario: str
    capability: str
    status: str


class AIModelConfigOut(BaseModel):
    selected_model: str
    selected_label: str
    provider: str
    scenario: str
    options: list[AIModelOptionOut]
    updated_by: int | None = None
    updated_at: datetime | None = None


class SettingsOverviewOut(BaseModel):
    summary: dict[str, int]
    banner: BannerOut
    entries: list[SettingsEntryOut]
    sales_users: list[SalesUserOut]
    permissions: list[SettingsPermissionOut]
    ai_model: AIModelConfigOut
    risks: list[str]
    recent_changes: list[dict[str, object]]


class SalesUserCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=120)
    role: str = Field(pattern="^(sales|ops|admin)$")
    data_scope: str = Field(default="all", max_length=255)
    enabled: bool = True


class SalesUserUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    role: str = Field(pattern="^(sales|ops|admin)$")
    data_scope: str = Field(default="all", max_length=255)
    enabled: bool = True


class BannerUpdateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    body: str = Field(min_length=2, max_length=500)
    image_url: str = Field(min_length=1, max_length=200000)
    link_url: str | None = Field(default=None, max_length=500)
    active: bool = True


class PermissionUpdateRequest(BaseModel):
    role: str = Field(pattern="^(sales|ops|admin)$")
    permissions: list[str] = Field(min_length=1)


class AIModelUpdateRequest(BaseModel):
    selected_model: str = Field(min_length=2, max_length=120)


class CountrySalesMappingOut(BaseModel):
    id: int
    country: str
    region: str
    sales_user_id: int
    sales_user_name: str
    sales_user_email: str
    sales_user_enabled: bool
    active: bool
    updated_at: datetime
    pending_count: int
    risk_level: str
    risk_reasons: list[str]


class CountrySalesMappingPage(BaseModel):
    page: int
    page_size: int
    total: int
    summary: dict[str, int]
    sales_users: list[SalesUserOut]
    items: list[CountrySalesMappingOut]
    pending_items: list[PendingAssignmentOut]
    empty_state: EmptyStateOut | None = None


class CountrySalesMappingUpdateRequest(BaseModel):
    country: str = Field(min_length=2, max_length=80)
    region: str = Field(min_length=2, max_length=80)
    sales_user_id: int
    active: bool = True


class ProductKnowledgeOut(BaseModel):
    id: int
    product_type: str
    model_name: str
    application_scenario: str
    ai_guidance: str
    version: str
    status: str
    updated_by: int | None
    updated_at: datetime


class ProductKnowledgePage(BaseModel):
    page: int
    page_size: int
    total: int
    summary: dict[str, int]
    active_version: str
    items: list[ProductKnowledgeOut]
    empty_state: EmptyStateOut | None = None
    recent_changes: list[dict[str, object]] = Field(default_factory=list)


class ProductKnowledgeUpdateRequest(BaseModel):
    product_type: str = Field(min_length=2, max_length=80)
    model_name: str = Field(min_length=2, max_length=120)
    application_scenario: str = Field(min_length=2, max_length=500)
    ai_guidance: str = Field(min_length=2, max_length=4000)
    status: str = Field(pattern="^(active|draft|disabled)$")


class ProductKnowledgeStatusRequest(BaseModel):
    status: str = Field(pattern="^(active|draft|disabled)$")


class ProductKnowledgeBlockOut(BaseModel):
    id: int
    product_type: str
    model_name: str
    application_scenario: str
    ai_guidance: str
    version: str


class ProductKnowledgeContextOut(BaseModel):
    active_version: str
    safety_boundary: str
    knowledge_blocks: list[ProductKnowledgeBlockOut]
    rendered_prompt: str


class ForbiddenContextOut(BaseModel):
    title: str
    message: str
    reason_code: str
    role: str
    from_path: str
    trace_id: str
    default_home_path: str
    support_action: str


class AuditLogOut(BaseModel):
    id: int
    action: str
    target_type: str
    target_id: int | None
    trace_id: str
    detail: str
    created_at: datetime


class AuditLogPage(BaseModel):
    page: int
    page_size: int
    total: int
    items: list[AuditLogOut]

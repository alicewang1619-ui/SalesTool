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
    country: str
    customer_type: str
    product: str
    source_category: str
    source_label: str
    score_label: str
    feedback_status: str


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
    country: str
    customer_type: str
    product: str
    tier: str
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


class CustomerListItem(BaseModel):
    id: int
    name: str
    country: str
    customer_type: str
    product: str
    tier: str
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


class SalesUserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    data_scope: str
    enabled: bool


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

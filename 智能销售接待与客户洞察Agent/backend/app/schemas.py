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


class CustomerBackgroundOut(BaseModel):
    auto_summary: str
    manual_summary: str | None
    evidence: str
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

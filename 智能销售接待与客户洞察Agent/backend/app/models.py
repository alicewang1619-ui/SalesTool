from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(40), nullable=False)
    data_scope: Mapped[str] = mapped_column(String(255), default="all")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class SourceDictionary(Base):
    __tablename__ = "source_dictionary"
    __table_args__ = (UniqueConstraint("category", "label", name="uq_source_category_label"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Banner(Base):
    __tablename__ = "banners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(String(500), nullable=False)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    link_url: Mapped[str | None] = mapped_column(String(500))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    organization: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    country: Mapped[str] = mapped_column(String(80), nullable=False)
    customer_type: Mapped[str] = mapped_column(String(80), nullable=False)
    product: Mapped[str] = mapped_column(String(160), nullable=False)
    source_category: Mapped[str] = mapped_column(String(40), nullable=False)
    source_label: Mapped[str] = mapped_column(String(120), nullable=False)
    score_label: Mapped[str] = mapped_column(String(40), nullable=False)
    feedback_status: Mapped[str] = mapped_column(String(80), nullable=False)
    raw_inquiry: Mapped[str] = mapped_column(Text, nullable=False, default="")
    conversation_history: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CountrySalesMapping(Base):
    __tablename__ = "country_sales_mappings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    country: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    region: Mapped[str] = mapped_column(String(80), nullable=False, default="Unassigned Region")
    sales_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProductKnowledge(Base):
    __tablename__ = "product_knowledge"
    __table_args__ = (UniqueConstraint("knowledge_base", "product_type", "model_name", name="uq_product_knowledge_base_type_model"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    knowledge_base: Mapped[str] = mapped_column(String(80), nullable=False, default="product")
    product_type: Mapped[str] = mapped_column(String(80), nullable=False)
    model_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    application_scenario: Mapped[str] = mapped_column(String(500), nullable=False)
    ai_guidance: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    version: Mapped[str] = mapped_column(String(40), nullable=False, default="v1")
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="active")
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SalesFeedbackLink(Base):
    __tablename__ = "sales_feedback_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), nullable=False, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SalesFeedback(Base):
    __tablename__ = "sales_feedbacks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    link_id: Mapped[int] = mapped_column(ForeignKey("sales_feedback_links.id"), unique=True, nullable=False, index=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), nullable=False, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    feedback_status: Mapped[str] = mapped_column(String(80), nullable=False)
    customer_judgement: Mapped[str] = mapped_column(String(120), nullable=False)
    remark: Mapped[str] = mapped_column(Text, nullable=False, default="")
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="queued")
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    processed_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    success_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    auto_assigned_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pending_assignment_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failures_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    original_content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ReportExportJob(Base):
    __tablename__ = "report_export_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    period: Mapped[str] = mapped_column(String(20), nullable=False)
    filters_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    fields_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    file_content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="ready")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    organization: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    country: Mapped[str] = mapped_column(String(80), nullable=False)
    customer_type: Mapped[str] = mapped_column(String(80), nullable=False)
    product: Mapped[str] = mapped_column(String(160), nullable=False)
    tier: Mapped[str] = mapped_column(String(80), nullable=False)
    demand_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source_summary: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    first_inquiry_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    background: Mapped["CustomerBackground"] = relationship(back_populates="customer", uselist=False)


class CustomerBackground(Base):
    __tablename__ = "customer_backgrounds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), unique=True, nullable=False)
    auto_summary: Mapped[str] = mapped_column(Text, nullable=False)
    manual_summary: Mapped[str | None] = mapped_column(Text)
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[str] = mapped_column(String(40), nullable=False)
    updated_by: Mapped[str] = mapped_column(String(120), default="system")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    customer: Mapped[Customer] = relationship(back_populates="background")


class CustomerSignal(Base):
    __tablename__ = "customer_signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    signal_source: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    signal_title: Mapped[str] = mapped_column(String(160), nullable=False)
    signal_summary: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_url: Mapped[str | None] = mapped_column(String(500))
    evidence_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    confidence: Mapped[str] = mapped_column(String(40), nullable=False, default="待复核")
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="待复核", index=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class NurtureTask(Base):
    __tablename__ = "nurture_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    recommended_next_action: Mapped[str] = mapped_column(Text, nullable=False)
    customer_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    nurture_reason: Mapped[str] = mapped_column(Text, nullable=False)
    email_subject: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    draft_content: Mapped[str] = mapped_column(Text, nullable=False)
    generation_prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    email_purpose: Mapped[str] = mapped_column(String(80), nullable=False, default="Follow-up reply")
    prompt_context_snapshot: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    attachment_refs: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    model_provider: Mapped[str] = mapped_column(String(80), nullable=False, default="ultrasound_growth_llm")
    model_version: Mapped[str] = mapped_column(String(80), nullable=False, default="nurture-draft-v1")
    writer_role_key: Mapped[str] = mapped_column(String(80), nullable=False, default="baymax")
    email_status: Mapped[str] = mapped_column(String(40), nullable=False, default="draft")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    approval_status: Mapped[str] = mapped_column(String(40), nullable=False, default="pending")
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    confirmed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    target_type: Mapped[str] = mapped_column(String(80), nullable=False)
    target_id: Mapped[int | None] = mapped_column(Integer)
    trace_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    email: Mapped[str] = mapped_column(String(255), primary_key=True)
    failed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

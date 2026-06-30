import csv
import io
import json
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from uuid import uuid4
import zipfile
import xml.etree.ElementTree as ET

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import case, func, inspect, select, text
from sqlalchemy.orm import Session, joinedload

from .config import get_settings
from .database import Base, SessionLocal, engine, get_db
from .dependencies import current_user, require_admin_or_ops
from .models import (
    AuditLog,
    Banner,
    CountrySalesMapping,
    Customer,
    CustomerBackground,
    ImportJob,
    Lead,
    LoginAttempt,
    ReportExportJob,
    SalesFeedback,
    SalesFeedbackLink,
    SourceDictionary,
    SystemSetting,
    User,
)
from .schemas import (
    AssignmentConfirmOut,
    AssignmentConfirmRequest,
    AuditLogOut,
    AuditLogPage,
    BannerOut,
    CustomerBackgroundUpdate,
    CustomerBackgroundOut,
    CustomerBackgroundSourceOut,
    CustomerDetailOut,
    CustomerFeedbackRecordOut,
    CustomerLeadHistoryOut,
    CustomerListItem,
    CustomerOut,
    CustomerPage,
    CustomerPoolMetrics,
    CustomerTimelineItemOut,
    DashboardMetrics,
    DashboardOut,
    DashboardTimelineItem,
    DashboardTodoOut,
    EmptyStateOut,
    FeedbackCardOut,
    FeedbackOwnerOut,
    FeedbackSubmitOut,
    FeedbackSubmitRequest,
    LeadAssignmentUpdate,
    LeadDetailOut,
    LeadAssignmentOut,
    LeadProfileSummary,
    LeadOut,
    PendingAssignmentOut,
    PendingAssignmentPage,
    ImportFailureOut,
    ImportJobOut,
    LoginRequest,
    LoginResponse,
    PageResult,
    ReportChannelQualityItemOut,
    ReportChannelQualityOut,
    ReportBreakdownItemOut,
    ReportGenerationOut,
    ReportHomeOut,
    ReportLimitsOut,
    ReportMetricDetailEmptyStateOut,
    ReportMetricDetailExportOut,
    ReportMetricDetailGroupItemOut,
    ReportMetricDetailLeadItemOut,
    ReportMetricDetailOut,
    ReportExportContextOut,
    ReportExportCreateRequest,
    ReportExportTaskOut,
    ReportMetricCardOut,
    ReportPeriodBreakdownsOut,
    ReportPeriodDownstreamOut,
    ReportPeriodEntryOut,
    ReportPeriodFiltersOut,
    ReportPeriodLeadItemOut,
    ReportPeriodMetricsOut,
    ReportPeriodOut,
    ReportQueryWindowOut,
    ReportRetryOut,
    ReportWebsiteKpiOut,
    SalesUserOut,
    BannerUpdateRequest,
    CountrySalesMappingOut,
    CountrySalesMappingPage,
    CountrySalesMappingUpdateRequest,
    PermissionUpdateRequest,
    SalesUserCreateRequest,
    SettingsEntryOut,
    SettingsOverviewOut,
    SettingsPermissionOut,
)
from .security import create_access_token, hash_password, verify_password
from .seed import seed_data

settings = get_settings()
app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_trace_id(request: Request, call_next):
    trace_id = request.headers.get("x-trace-id") or uuid4().hex
    request.state.trace_id = trace_id
    response = await call_next(request)
    response.headers["x-trace-id"] = trace_id
    return response


def ensure_sqlite_compatibility() -> None:
    if engine.dialect.name != "sqlite":
        return
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if "audit_logs" in table_names:
        column_names = {column["name"] for column in inspector.get_columns("audit_logs")}
        if "trace_id" not in column_names:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE audit_logs ADD COLUMN trace_id VARCHAR(64) NOT NULL DEFAULT ''"))
    if "leads" in table_names:
        lead_columns = {column["name"] for column in inspector.get_columns("leads")}
        with engine.begin() as connection:
            if "raw_inquiry" not in lead_columns:
                connection.execute(text("ALTER TABLE leads ADD COLUMN raw_inquiry TEXT NOT NULL DEFAULT ''"))
            if "conversation_history" not in lead_columns:
                connection.execute(text("ALTER TABLE leads ADD COLUMN conversation_history TEXT NOT NULL DEFAULT '[]'"))
            connection.execute(
                text(
                    """
                    UPDATE leads
                    SET raw_inquiry = :raw_inquiry,
                        conversation_history = :conversation_history
                    WHERE customer_name = :customer_name
                    """
                ),
                {
                    "customer_name": "GlobalMed Peru",
                    "raw_inquiry": "客户原文：We distribute imaging devices in Peru and need a portable ultrasound portfolio for regional clinics.",
                    "conversation_history": json.dumps(
                        [
                            "客户询问 portable ultrasound 代理组合与区域诊所应用。",
                            "AI 追问国家、客户身份和应用场景后确认其为 Peru 代理商。",
                            "客户表示希望三天内收到产品对比资料。",
                        ],
                        ensure_ascii=False,
                    ),
                },
            )
            connection.execute(
                text(
                    """
                    UPDATE leads
                    SET raw_inquiry = :raw_inquiry,
                        conversation_history = :conversation_history
                    WHERE customer_name = :customer_name
                    """
                ),
                {
                    "customer_name": "Al Noor Hospital",
                    "raw_inquiry": "客户原文：Our hospital is reviewing trolley ultrasound systems for emergency and radiology departments.",
                    "conversation_history": json.dumps(
                        [
                            "邮件询盘说明医院正在评估 trolley ultrasound。",
                            "AI 从邮箱签名和国家字段识别 UAE Hospital。",
                            "系统标记为需跟进，等待运营分配销售负责人。",
                        ],
                        ensure_ascii=False,
                    ),
                },
            )
    if "import_jobs" in table_names:
        import_job_columns = {column["name"] for column in inspector.get_columns("import_jobs")}
        if "processed_rows" not in import_job_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE import_jobs ADD COLUMN processed_rows INTEGER NOT NULL DEFAULT 0"))
    if "country_sales_mappings" in table_names:
        mapping_columns = {column["name"] for column in inspector.get_columns("country_sales_mappings")}
        if "region" not in mapping_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE country_sales_mappings ADD COLUMN region VARCHAR(80) NOT NULL DEFAULT 'Unassigned Region'")
                )


def ensure_default_country_mappings(db: Session) -> None:
    maria = db.scalar(select(User).where(User.email == "maria@ultrasound-growth.local"))
    if not maria:
        return
    peru_mapping = db.scalar(select(CountrySalesMapping).where(CountrySalesMapping.country == "Peru"))
    if not peru_mapping:
        db.add(CountrySalesMapping(country="Peru", region="Latam", sales_user_id=maria.id, active=True))
    else:
        peru_mapping.region = "Latam"
        peru_mapping.sales_user_id = maria.id
        peru_mapping.active = True
    db.commit()


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_compatibility()
    with next(get_db()) as db:
        seed_data(db)
        ensure_default_country_mappings(db)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def error_detail(code: str, message: str, **extra: object) -> dict[str, object]:
    return {"code": code, "message": message, **extra}


def add_audit(
    db: Session,
    trace_id: str,
    action: str,
    detail: str,
    actor_id: int | None = None,
    target_type: str = "auth",
    target_id: int | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            trace_id=trace_id,
            detail=detail,
        )
    )


def import_job_out(job: ImportJob) -> ImportJobOut:
    try:
        failures = json.loads(job.failures_json or "[]")
    except json.JSONDecodeError:
        failures = []
    if not isinstance(failures, list):
        failures = []
    return ImportJobOut(
        task_id=job.task_id,
        filename=job.filename,
        status=job.status,
        total_rows=job.total_rows,
        processed_rows=job.processed_rows,
        success_rows=job.success_rows,
        failed_rows=job.failed_rows,
        failures=[ImportFailureOut(**item) for item in failures],
    )


def parse_xlsx_rows(content: bytes) -> list[dict[str, str]]:
    with zipfile.ZipFile(io.BytesIO(content)) as workbook:
        sheet_xml = workbook.read("xl/worksheets/sheet1.xml")
    namespace = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    root = ET.fromstring(sheet_xml)
    rows: list[list[str]] = []
    for row in root.findall(".//m:sheetData/m:row", namespace):
        values: list[str] = []
        for cell in row.findall("m:c", namespace):
            inline = cell.find("m:is/m:t", namespace)
            value = cell.find("m:v", namespace)
            values.append((inline.text if inline is not None else value.text if value is not None else "") or "")
        rows.append(values)
    if not rows:
        return []
    headers = [value.strip() for value in rows[0]]
    return [{headers[index]: value for index, value in enumerate(row) if index < len(headers)} for row in rows[1:]]


def parse_import_rows(job: ImportJob) -> list[dict[str, str]]:
    if job.filename.lower().endswith(".xlsx"):
        return parse_xlsx_rows(job.original_content.encode("latin1"))
    return list(csv.DictReader(io.StringIO(job.original_content)))


def process_import_job(db: Session, job: ImportJob) -> None:
    job.status = "processing"
    rows = parse_import_rows(job)
    required_fields = ["customer_name", "country", "customer_type", "product", "source_category", "source_label"]
    failures: list[dict[str, object]] = []
    success_rows = 0
    seen_names: set[str] = set()
    enabled_sources = {
        (item.category, item.label)
        for item in db.scalars(select(SourceDictionary).where(SourceDictionary.enabled.is_(True))).all()
    }

    job.total_rows = len(rows)
    job.processed_rows = 0
    db.flush()

    for row_number, row in enumerate(rows, start=1):
        job.processed_rows = row_number
        clean = {field: (row.get(field) or "").strip() for field in required_fields}
        customer_name = clean["customer_name"]
        reason = ""
        if not customer_name:
            reason = "MISSING_CUSTOMER_NAME"
        elif not clean["country"]:
            reason = "MISSING_COUNTRY"
        elif (clean["source_category"], clean["source_label"]) not in enabled_sources:
            reason = "SOURCE_DISABLED"
        elif customer_name in seen_names or db.scalar(select(Lead.id).where(Lead.customer_name == customer_name)):
            reason = "DUPLICATE_CUSTOMER"

        if reason:
            failures.append({"row_number": row_number, "customer_name": customer_name, "reason": reason})
            continue

        seen_names.add(customer_name)
        db.add(
            Lead(
                customer_name=customer_name,
                country=clean["country"],
                customer_type=clean["customer_type"] or "pending",
                product=clean["product"] or "pending",
                source_category=clean["source_category"],
                source_label=clean["source_label"],
                score_label="pending",
                feedback_status="unassigned",
                raw_inquiry=f"Import source: {clean['source_category']} / {clean['source_label']}",
                conversation_history="[]",
            )
        )
        success_rows += 1

    job.processed_rows = len(rows)
    job.success_rows = success_rows
    job.failed_rows = len(failures)
    job.failures_json = json.dumps(failures, ensure_ascii=False)
    job.status = "completed"


def process_import_job_task(task_id: str, trace_id: str, actor_id: int) -> None:
    with SessionLocal() as db:
        job = db.scalar(select(ImportJob).where(ImportJob.task_id == task_id))
        if not job:
            return
        process_import_job(db, job)
        add_audit(
            db,
            trace_id,
            "import_job_completed",
            f"Import job {job.task_id} completed: {job.success_rows} success, {job.failed_rows} failed.",
            actor_id=actor_id,
            target_type="import_job",
            target_id=job.id,
        )
        db.commit()


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> LoginResponse:
    now = datetime.utcnow()
    trace_id = request.state.trace_id
    attempt = db.get(LoginAttempt, payload.email)
    if attempt and attempt.locked_until and attempt.locked_until > now:
        add_audit(db, trace_id, "login_locked", f"{payload.email} tried to login while locked")
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_detail("LOGIN_LOCKED", "Too many failed login attempts", locked_until=attempt.locked_until.isoformat()),
        )

    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not user.enabled or not verify_password(payload.password, user.password_hash):
        if not attempt:
            attempt = LoginAttempt(email=payload.email, failed_count=0)
            db.add(attempt)
        attempt.failed_count += 1
        if attempt.failed_count >= 5:
            attempt.locked_until = now + timedelta(minutes=15)
        add_audit(db, trace_id, "login_failed", f"{payload.email} login failed {attempt.failed_count} times")
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_detail("INVALID_CREDENTIALS", "Invalid email or password"),
        )

    if attempt:
        attempt.failed_count = 0
        attempt.locked_until = None
    add_audit(db, trace_id, "login_succeeded", f"{payload.email} login succeeded", actor_id=user.id, target_id=user.id)
    db.commit()
    return LoginResponse(
        access_token=create_access_token(user.id, user.role),
        role=user.role,
        name=user.name,
    )


@app.get("/api/me", response_model=SalesUserOut)
def me(user: User = Depends(current_user)) -> User:
    return user


@app.get("/api/banner", response_model=BannerOut)
def active_banner(db: Session = Depends(get_db)) -> Banner:
    banner = db.scalar(select(Banner).where(Banner.active.is_(True)).order_by(Banner.updated_at.desc()))
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not configured")
    return banner


@app.get("/api/source-dictionary")
def source_dictionary(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[dict[str, str]]:
    sources = db.scalars(select(SourceDictionary).where(SourceDictionary.enabled.is_(True)).order_by(SourceDictionary.id)).all()
    return [{"category": item.category, "label": item.label} for item in sources]


@app.post("/api/import-jobs", response_model=ImportJobOut, status_code=status.HTTP_201_CREATED)
async def create_import_job(
    background_tasks: BackgroundTasks,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> ImportJobOut:
    filename = file.filename or ""
    content = await file.read()
    if not filename.lower().endswith((".csv", ".xlsx")) or len(content) > 5 * 1024 * 1024:
        add_audit(db, request.state.trace_id, "import_rejected", f"Import file rejected: {filename}", actor_id=user.id, target_type="import_job")
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_detail("INVALID_IMPORT_FILE", "Only CSV/XLSX files up to 5MB are supported"),
        )

    text_content = content.decode("latin1") if filename.lower().endswith(".xlsx") else content.decode("utf-8-sig")
    job = ImportJob(task_id=uuid4().hex, filename=filename, status="queued", original_content=text_content, created_by=user.id)
    db.add(job)
    db.flush()
    result = import_job_out(job)
    db.commit()
    background_tasks.add_task(process_import_job_task, job.task_id, request.state.trace_id, user.id)
    return result


@app.get("/api/import-jobs/{task_id}", response_model=ImportJobOut)
def get_import_job(task_id: str, db: Session = Depends(get_db), user: User = Depends(require_admin_or_ops)) -> ImportJobOut:
    job = db.scalar(select(ImportJob).where(ImportJob.task_id == task_id))
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    return import_job_out(job)


@app.get("/api/import-jobs/{task_id}/failed-rows")
def download_import_failures(task_id: str, db: Session = Depends(get_db), user: User = Depends(require_admin_or_ops)) -> Response:
    job = db.scalar(select(ImportJob).where(ImportJob.task_id == task_id))
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["row_number", "customer_name", "reason"])
    writer.writeheader()
    for failure in import_job_out(job).failures:
        writer.writerow(failure.model_dump())
    return Response(content=output.getvalue(), media_type="text/csv; charset=utf-8")


@app.post("/api/import-jobs/{task_id}/retry", response_model=ImportJobOut)
def retry_import_job(
    task_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> ImportJobOut:
    job = db.scalar(select(ImportJob).where(ImportJob.task_id == task_id))
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    if job.status != "completed":
        process_import_job(db, job)
    add_audit(db, request.state.trace_id, "import_job_retried", f"Import job {task_id} retried", actor_id=user.id, target_type="import_job", target_id=job.id)
    db.commit()
    db.refresh(job)
    return import_job_out(job)


def pending_reasons_for_lead(lead: Lead, mapped_countries: set[str]) -> list[str]:
    reasons: list[str] = []
    if not lead.country.strip():
        reasons.append("COUNTRY_MISSING")
    elif lead.country not in mapped_countries:
        reasons.append("COUNTRY_MAPPING_MISSING")
    if lead.owner_id is None:
        reasons.append("ASSIGNEE_MISSING")
    return reasons


def pending_assignment_out(
    db: Session,
    lead: Lead,
    reasons: list[str],
    mapping_lookup: dict[str, tuple[CountrySalesMapping, User]] | None = None,
) -> PendingAssignmentOut:
    base = LeadOut.model_validate(lead, from_attributes=True).model_dump()
    owner = db.get(User, lead.owner_id) if lead.owner_id else None
    suggested_mapping = mapping_lookup.get(lead.country) if mapping_lookup else None
    suggested_owner = suggested_mapping[1] if suggested_mapping else None
    configure_mapping_path = None
    if "COUNTRY_MAPPING_MISSING" in reasons:
        configure_mapping_path = f"/admin/settings/country-sales?pending_country={lead.country}"
    return PendingAssignmentOut(
        **base,
        owner_id=owner.id if owner else None,
        owner_name=owner.name if owner else "Unassigned",
        suggested_owner_id=suggested_owner.id if suggested_owner else None,
        suggested_owner_name=suggested_owner.name if suggested_owner else None,
        pending_reasons=reasons,
        detail_path=f"/admin/leads/{lead.id}",
        configure_mapping_path=configure_mapping_path,
    )


FEEDBACK_STATUS_OPTIONS = ["已联系", "已报价", "需跟进", "无效", "已成交"]
FEEDBACK_JUDGEMENT_OPTIONS = ["有效客户，继续跟进", "确认真实需求", "放入资料库", "已转代理商"]


def load_valid_feedback_context(db: Session, token: str) -> tuple[SalesFeedbackLink, Lead, User]:
    feedback_link = db.scalar(select(SalesFeedbackLink).where(SalesFeedbackLink.token == token))
    if not feedback_link:
        raise HTTPException(status_code=404, detail=error_detail("FEEDBACK_LINK_NOT_FOUND", "Feedback link not found."))
    if not feedback_link.active or feedback_link.expires_at <= datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=error_detail("FEEDBACK_LINK_EXPIRED", "Feedback link has expired. Request a new link."),
        )
    lead = db.get(Lead, feedback_link.lead_id)
    owner = db.get(User, feedback_link.owner_id)
    if not lead or not owner or lead.owner_id != feedback_link.owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_detail("FEEDBACK_LINK_OWNER_MISMATCH", "Feedback link does not match current owner."),
        )
    return feedback_link, lead, owner


def feedback_card_out(db: Session, feedback_link: SalesFeedbackLink, lead: Lead, owner: User) -> FeedbackCardOut:
    detail = build_lead_detail(db, lead)
    submitted = db.scalar(select(SalesFeedback.id).where(SalesFeedback.link_id == feedback_link.id)) is not None
    return FeedbackCardOut(
        token=feedback_link.token,
        lead=LeadOut.model_validate(lead, from_attributes=True),
        owner=FeedbackOwnerOut(id=owner.id, name=owner.name),
        ai_reason=detail.score_reasons[1] if detail.score_reasons else "",
        background_summary=detail.background_summary,
        status_options=FEEDBACK_STATUS_OPTIONS,
        judgement_options=FEEDBACK_JUDGEMENT_OPTIONS,
        expires_at=feedback_link.expires_at.isoformat(),
        submitted=submitted,
    )


def feedback_submit_out(feedback: SalesFeedback) -> FeedbackSubmitOut:
    return FeedbackSubmitOut(
        id=feedback.id,
        lead_id=feedback.lead_id,
        feedback_status=feedback.feedback_status,
        customer_judgement=feedback.customer_judgement,
        remark=feedback.remark,
        submitted_at=feedback.submitted_at,
    )


@app.get("/api/feedback-links/{token}", response_model=FeedbackCardOut)
def get_feedback_card(token: str, db: Session = Depends(get_db)) -> FeedbackCardOut:
    feedback_link, lead, owner = load_valid_feedback_context(db, token)
    return feedback_card_out(db, feedback_link, lead, owner)


@app.post("/api/feedback-links/{token}/submit", response_model=FeedbackSubmitOut)
def submit_feedback_card(
    token: str,
    payload: FeedbackSubmitRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> FeedbackSubmitOut:
    feedback_link, lead, owner = load_valid_feedback_context(db, token)
    if payload.feedback_status not in FEEDBACK_STATUS_OPTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_detail("INVALID_FEEDBACK_STATUS", "Feedback status is not supported."),
        )
    if payload.customer_judgement not in FEEDBACK_JUDGEMENT_OPTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_detail("INVALID_CUSTOMER_JUDGEMENT", "Customer judgement is not supported."),
        )

    existing = db.scalar(select(SalesFeedback).where(SalesFeedback.link_id == feedback_link.id))
    if existing:
        return feedback_submit_out(existing)

    feedback = SalesFeedback(
        link_id=feedback_link.id,
        lead_id=lead.id,
        owner_id=owner.id,
        feedback_status=payload.feedback_status,
        customer_judgement=payload.customer_judgement,
        remark=payload.remark.strip(),
    )
    lead.feedback_status = payload.feedback_status
    db.add(feedback)
    db.flush()
    add_audit(
        db,
        request.state.trace_id,
        "sales_feedback_submitted",
        f"Sales feedback submitted for {lead.customer_name}: {payload.feedback_status} / {payload.customer_judgement}.",
        actor_id=owner.id,
        target_type="lead",
        target_id=lead.id,
    )
    db.commit()
    db.refresh(feedback)
    return feedback_submit_out(feedback)


@app.get("/api/assignments/pending", response_model=PendingAssignmentPage)
def pending_assignments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> PendingAssignmentPage:
    mapping_rows = db.execute(
        select(CountrySalesMapping, User)
        .join(User, User.id == CountrySalesMapping.sales_user_id)
        .where(CountrySalesMapping.active.is_(True), User.enabled.is_(True), User.role == "sales")
    ).all()
    mapped_countries = {mapping.country for mapping, _ in mapping_rows}
    mapping_lookup = {mapping.country: (mapping, owner) for mapping, owner in mapping_rows}
    leads = db.scalars(select(Lead).order_by(Lead.created_at.desc(), Lead.id.desc())).all()
    pending_items: list[PendingAssignmentOut] = []
    for lead in leads:
        reasons = pending_reasons_for_lead(lead, mapped_countries)
        if reasons:
            pending_items.append(pending_assignment_out(db, lead, reasons, mapping_lookup))

    start = (page - 1) * page_size
    return PendingAssignmentPage(
        page=page,
        page_size=page_size,
        total=len(pending_items),
        items=pending_items[start : start + page_size],
    )


@app.post("/api/assignments/{lead_id}/assign", response_model=AssignmentConfirmOut)
def confirm_pending_assignment(
    lead_id: int,
    payload: AssignmentConfirmRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> AssignmentConfirmOut:
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.owner_id != payload.expected_owner_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=error_detail("ASSIGNMENT_CONFLICT", "Lead has already been assigned. Refresh and retry."),
        )
    owner = db.get(User, payload.owner_id)
    if not owner or owner.role != "sales" or not owner.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_detail("INVALID_ASSIGNEE", "Assignee must be an enabled sales user."),
        )

    lead.owner_id = owner.id
    lead.feedback_status = "unfeedback"
    db.query(SalesFeedbackLink).filter(
        SalesFeedbackLink.lead_id == lead.id,
        SalesFeedbackLink.active.is_(True),
    ).update({"active": False}, synchronize_session=False)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    feedback_link = SalesFeedbackLink(
        token=uuid4().hex,
        lead_id=lead.id,
        owner_id=owner.id,
        expires_at=expires_at.replace(tzinfo=None),
        active=True,
    )
    db.add(feedback_link)
    db.flush()
    add_audit(
        db,
        request.state.trace_id,
        "pending_assignment_confirmed",
        f"Pending lead {lead.customer_name} assigned to {owner.name}; feedback link is valid for 7 days.",
        actor_id=user.id,
        target_type="lead",
        target_id=lead.id,
    )
    db.commit()
    return AssignmentConfirmOut(
        lead_id=lead.id,
        owner_id=owner.id,
        owner_name=owner.name,
        feedback_link_token=feedback_link.token,
        feedback_link_path=f"/feedback/{feedback_link.token}",
        expires_at=expires_at.isoformat(),
    )


@app.get("/api/leads", response_model=PageResult)
def list_leads(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source_category: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> PageResult:
    query = select(Lead)
    count_query = select(func.count()).select_from(Lead)
    if source_category:
        query = query.where(Lead.source_category == source_category)
        count_query = count_query.where(Lead.source_category == source_category)
    if user.role == "sales":
        query = query.where(Lead.owner_id == user.id)
        count_query = count_query.where(Lead.owner_id == user.id)

    total = db.scalar(count_query) or 0
    rows = db.scalars(query.order_by(Lead.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return PageResult(page=page, page_size=page_size, total=total, items=[LeadOut.model_validate(row, from_attributes=True) for row in rows])


@app.get("/api/leads/{lead_id}", response_model=LeadDetailOut)
def get_lead(lead_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)) -> Lead:
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if user.role == "sales" and lead.owner_id != user.id:
        raise HTTPException(status_code=403, detail="No permission to view this lead")
    return build_lead_detail(db, lead)


def build_lead_detail(db: Session, lead: Lead) -> LeadDetailOut:
    customer = db.scalar(select(Customer).where(Customer.name == lead.customer_name))
    owner = db.get(User, lead.owner_id) if lead.owner_id else None
    background = customer.background if customer and customer.background else None
    source = f"{lead.source_category} / {lead.source_label}"
    base = LeadOut.model_validate(lead, from_attributes=True).model_dump()
    background_summary = (
        background.manual_summary or background.auto_summary
        if background
        else f"{lead.customer_name} has no linked customer background yet; operations should add public website or email evidence."
    )
    feedback_text = (
        f"{owner.name if owner else 'Unassigned'} current status is {lead.feedback_status}; lead source is {source}."
    )
    try:
        conversation_history = json.loads(lead.conversation_history or "[]")
    except json.JSONDecodeError:
        conversation_history = []
    if not isinstance(conversation_history, list):
        conversation_history = []
    return LeadDetailOut(
        **base,
        raw_inquiry=lead.raw_inquiry,
        conversation_history=[str(item) for item in conversation_history],
        profile_summary=LeadProfileSummary(
            customer_type=lead.customer_type,
            country=lead.country,
            product=lead.product,
            source=source,
        ),
        score_reasons=[
            f"Score label: {lead.score_label}",
            f"Customer type is {lead.customer_type}; product interest is clear.",
            "Country field is available for sales assignment rules.",
        ],
        background_summary=background_summary,
        background_confidence=background.confidence if background else "pending",
        background_updated_at=background.updated_at if background else None,
        customer_id=customer.id if customer else None,
        assignment=LeadAssignmentOut(
            owner_id=owner.id if owner else None,
            owner_name=owner.name if owner else "Unassigned",
            status=lead.feedback_status,
        ),
        feedback_history=[
            feedback_text,
            "Sales feedback has priority over AI score, while AI reasons remain visible in detail.",
        ],
        background_task_status="completed" if background else "pending",
    )


@app.put("/api/leads/{lead_id}/assignment", response_model=LeadDetailOut)
def update_lead_assignment(
    lead_id: int,
    payload: LeadAssignmentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> LeadDetailOut:
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if payload.owner_id is not None:
        owner = db.get(User, payload.owner_id)
        if not owner or owner.role != "sales" or not owner.enabled:
            raise HTTPException(status_code=400, detail="Assignee must be an enabled sales user")
        lead.owner_id = owner.id
    else:
        lead.owner_id = None
    lead.feedback_status = payload.feedback_status
    add_audit(
        db,
        request.state.trace_id,
        "lead_assignment_updated",
        f"绾跨储 {lead.customer_name} 鍒嗗彂鐘舵€佹洿鏂颁负 {payload.feedback_status}",
        actor_id=user.id,
        target_type="lead",
        target_id=lead.id,
    )
    db.commit()
    db.refresh(lead)
    return build_lead_detail(db, lead)


@app.get("/api/dashboard", response_model=DashboardOut)
def dashboard(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    source_category: str | None = None,
    country: str | None = None,
    customer_type: str | None = None,
    product: str | None = None,
    owner_id: int | None = None,
    cycle: str | None = Query(None, pattern="^(today|all)?$"),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> DashboardOut:
    base_conditions = []
    if user.role == "sales":
        base_conditions.append(Lead.owner_id == user.id)
    elif owner_id is not None:
        base_conditions.append(Lead.owner_id == owner_id)
    if source_category:
        base_conditions.append(Lead.source_category == source_category)
    if country:
        base_conditions.append(Lead.country == country)
    if customer_type:
        base_conditions.append(Lead.customer_type == customer_type)
    if product:
        base_conditions.append(Lead.product == product)

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    if cycle == "today":
        base_conditions.append(Lead.created_at >= today_start)

    def scoped_count(*conditions) -> int:
        query = select(func.count()).select_from(Lead)
        for condition in [*base_conditions, *conditions]:
            query = query.where(condition)
        return db.scalar(query) or 0

    query = select(Lead)
    for condition in base_conditions:
        query = query.where(condition)

    total = scoped_count()
    website_total = scoped_count(Lead.source_category.in_(["网站", "缃戠珯", "website"]))
    rows = db.scalars(query.order_by(Lead.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()

    add_audit(db, request.state.trace_id, "dashboard_viewed", "Dashboard viewed", actor_id=user.id, target_type="dashboard")
    db.commit()

    return DashboardOut(
        page=page,
        page_size=page_size,
        total=total,
        metrics=DashboardMetrics(
            today_inquiries=scoped_count(Lead.created_at >= today_start),
            valid_leads=scoped_count(Lead.score_label.in_(["有效", "鏈夋晥", "valid"])),
            unfeedback=scoped_count(Lead.feedback_status.in_(["未反馈", "鏈弽棣?", "unfeedback"])),
            website_kpi=round((website_total / total) * 100) if total else 0,
        ),
        ai_summary="Dashboard aggregates current leads, customers, and feedback by login role.",
        assignment_timeline=[
            DashboardTimelineItem(label="Lead intake", value=f"{total} records to review"),
            DashboardTimelineItem(label="Valid scoring", value="Prioritize valid and high-intent customers"),
            DashboardTimelineItem(label="Sales feedback", value="Unfeedback records need follow-up"),
        ],
        items=[
            DashboardTodoOut(
                **LeadOut.model_validate(row, from_attributes=True).model_dump(),
                detail_path=f"/admin/leads/{row.id}",
            )
            for row in rows
        ],
    )


VALID_SCORE_LABELS = ["有效", "鏈夋晥", "valid", "高意向", "高意向"]
UNFEEDBACK_LABELS = ["未反馈", "鏈弽棣?", "unfeedback"]
WEBSITE_SOURCE_LABELS = ["网站", "缃戠珯", "website", "官网"]


def report_period_window(period: str) -> tuple[str, datetime, datetime]:
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "month":
        return period, today.replace(day=1), now
    if period == "quarter":
        first_month = ((today.month - 1) // 3) * 3 + 1
        return period, today.replace(month=first_month, day=1), now
    if period == "year":
        return period, today.replace(month=1, day=1), now
    return "day", today, now


def report_count(db: Session, conditions: list[object], *extra_conditions: object) -> int:
    query = select(func.count()).select_from(Lead)
    for condition in [*conditions, *extra_conditions]:
        query = query.where(condition)
    return db.scalar(query) or 0


def pct(part: int, whole: int) -> int:
    return round((part / whole) * 100) if whole else 0


def report_generation(db: Session) -> ReportGenerationOut:
    updated_at = db.scalar(select(func.max(Lead.created_at))) or datetime.utcnow()
    return ReportGenerationOut(status="ready", updated_at=updated_at, retry_path="/api/reports/home/retry")


@app.get("/api/reports/home", response_model=ReportHomeOut)
def report_home(
    request: Request,
    period: str = Query("day", pattern="^(day|month|quarter|year)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> ReportHomeOut:
    resolved_period, start_at, end_at = report_period_window(period)
    conditions: list[object] = [Lead.created_at >= start_at, Lead.created_at <= end_at]

    total = report_count(db, conditions)
    valid_total = report_count(db, conditions, Lead.score_label.in_(VALID_SCORE_LABELS))
    unfeedback_total = report_count(db, conditions, Lead.feedback_status.in_(UNFEEDBACK_LABELS))
    website_total = report_count(db, conditions, Lead.source_category.in_(WEBSITE_SOURCE_LABELS))
    assigned_total = report_count(db, conditions, Lead.owner_id.is_not(None))
    feedback_total = db.scalar(
        select(func.count(func.distinct(SalesFeedback.lead_id)))
        .select_from(SalesFeedback)
        .join(Lead, Lead.id == SalesFeedback.lead_id)
        .where(Lead.created_at >= start_at, Lead.created_at <= end_at)
    ) or 0
    customer_total = db.scalar(select(func.count()).select_from(Customer)) or 0

    valid_case = case((Lead.score_label.in_(VALID_SCORE_LABELS), 1), else_=0)
    channel_query = (
        select(
            Lead.source_category,
            func.count(Lead.id).label("inquiry_count"),
            func.sum(valid_case).label("valid_count"),
        )
        .where(*conditions)
        .group_by(Lead.source_category)
        .order_by(func.count(Lead.id).desc(), Lead.source_category.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    channel_total = db.scalar(
        select(func.count(func.distinct(Lead.source_category))).select_from(Lead).where(*conditions)
    ) or 0
    channel_items = [
        ReportChannelQualityItemOut(
            source_category=row.source_category,
            inquiry_count=row.inquiry_count,
            valid_count=row.valid_count or 0,
            valid_rate=pct(row.valid_count or 0, row.inquiry_count),
        )
        for row in db.execute(channel_query).all()
    ]

    add_audit(db, request.state.trace_id, "report_home_viewed", "Report home viewed", actor_id=user.id, target_type="report")
    db.commit()

    return ReportHomeOut(
        period=resolved_period,
        query_window=ReportQueryWindowOut(start_at=start_at, end_at=end_at),
        limits=ReportLimitsOut(page=page, page_size=page_size),
        metrics=[
            ReportMetricCardOut(key="today_inquiries", label="今日询盘", value=report_count(db, [Lead.created_at >= report_period_window("day")[1]]), hint="当日进入系统的询盘"),
            ReportMetricCardOut(key="valid_leads", label="有效线索", value=valid_total, hint="当前周期内有效与高意向线索"),
            ReportMetricCardOut(key="unfeedback", label="未反馈", value=unfeedback_total, hint="当前周期内未收到销售反馈"),
            ReportMetricCardOut(key="website_kpi", label="官网 KPI", value=pct(website_total, total), unit="%", hint="官网来源占比"),
        ],
        period_entries=[
            ReportPeriodEntryOut(period="day", label="日报", path="/admin/reports/period?period=day"),
            ReportPeriodEntryOut(period="month", label="月报", path="/admin/reports/period?period=month"),
            ReportPeriodEntryOut(period="quarter", label="季报", path="/admin/reports/period?period=quarter"),
            ReportPeriodEntryOut(period="year", label="年报", path="/admin/reports/period?period=year"),
        ],
        channel_quality=ReportChannelQualityOut(total=channel_total, items=channel_items),
        website_kpi=ReportWebsiteKpiOut(
            attribution_rate=pct(website_total, total),
            ai_completion_rate=pct(valid_total, total),
            assignment_rate=pct(assigned_total, total),
            sales_feedback_rate=pct(feedback_total, total),
            entered_customer_pool=customer_total,
        ),
        generation=report_generation(db),
    )


@app.post("/api/reports/home/retry", response_model=ReportRetryOut)
def retry_report_home(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> ReportRetryOut:
    generation = report_generation(db)
    add_audit(
        db,
        request.state.trace_id,
        "report_home_retry_requested",
        "Report home aggregation retry requested",
        actor_id=user.id,
        target_type="report",
    )
    db.commit()
    return ReportRetryOut(status="queued", updated_at=generation.updated_at, retry_path=generation.retry_path)


def report_period_conditions(
    start_at: datetime,
    end_at: datetime,
    country: str | None,
    source_category: str | None,
    product: str | None,
    feedback_status: str | None,
) -> list[object]:
    conditions: list[object] = [Lead.created_at >= start_at, Lead.created_at <= end_at]
    if country:
        conditions.append(Lead.country == country)
    if source_category:
        conditions.append(Lead.source_category == source_category)
    if product:
        conditions.append(Lead.product == product)
    if feedback_status:
        conditions.append(Lead.feedback_status == feedback_status)
    return conditions


def report_breakdown(db: Session, conditions: list[object], column: object) -> list[ReportBreakdownItemOut]:
    valid_case = case((Lead.score_label.in_(VALID_SCORE_LABELS), 1), else_=0)
    rows = db.execute(
        select(
            column,
            func.count(Lead.id).label("inquiry_count"),
            func.sum(valid_case).label("valid_count"),
        )
        .where(*conditions)
        .group_by(column)
        .order_by(func.count(Lead.id).desc(), column)
        .limit(20)
    ).all()
    return [
        ReportBreakdownItemOut(
            label=row[0],
            inquiry_count=row.inquiry_count,
            valid_count=row.valid_count or 0,
            valid_rate=pct(row.valid_count or 0, row.inquiry_count),
        )
        for row in rows
    ]


def report_downstream_paths(period: str, filters: ReportPeriodFiltersOut) -> ReportPeriodDownstreamOut:
    params = {"period": period}
    for key, value in filters.model_dump(exclude_none=True).items():
        if value:
            params[key] = value
    query = urlencode(params)
    return ReportPeriodDownstreamOut(
        metrics_path=f"/admin/reports/metrics?{query}",
        export_path=f"/admin/reports/export?{query}",
        export_requires_confirmation=True,
    )


def breakdown_to_metric_items(
    rows: list[ReportBreakdownItemOut],
    *,
    key_prefix: str,
    unit: str = "条",
) -> list[ReportMetricDetailGroupItemOut]:
    return [
        ReportMetricDetailGroupItemOut(
            key=f"{key_prefix}_{index}",
            label=row.label,
            value=row.inquiry_count,
            unit=unit,
            hint=f"有效 {row.valid_count}，有效率 {row.valid_rate}%",
        )
        for index, row in enumerate(rows, start=1)
    ]


@app.get("/api/reports/period", response_model=ReportPeriodOut)
def report_period(
    request: Request,
    period: str = Query("day", pattern="^(day|month|quarter|year)$"),
    country: str | None = None,
    source_category: str | None = None,
    product: str | None = None,
    feedback_status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    timeout_ms: int = Query(3000, ge=1, le=30000),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> ReportPeriodOut:
    if timeout_ms < 5:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "code": "REPORT_PERIOD_TIMEOUT",
                "message": "报表查询超时，请重试",
                "trace_id": request.state.trace_id,
            },
        )

    resolved_period, start_at, end_at = report_period_window(period)
    filters = ReportPeriodFiltersOut(
        country=country,
        source_category=source_category,
        product=product,
        feedback_status=feedback_status,
    )
    conditions = report_period_conditions(start_at, end_at, country, source_category, product, feedback_status)
    total = report_count(db, conditions)
    valid_total = report_count(db, conditions, Lead.score_label.in_(VALID_SCORE_LABELS))
    unfeedback_total = report_count(db, conditions, Lead.feedback_status.in_(UNFEEDBACK_LABELS))
    website_total = report_count(db, conditions, Lead.source_category.in_(WEBSITE_SOURCE_LABELS))

    rows = db.execute(
        select(Lead)
        .where(*conditions)
        .order_by(Lead.created_at.desc(), Lead.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    add_audit(
        db,
        request.state.trace_id,
        "report_period_viewed",
        f"Report period viewed: {resolved_period}",
        actor_id=user.id,
        target_type="report",
    )
    db.commit()

    return ReportPeriodOut(
        period=resolved_period,
        query_window=ReportQueryWindowOut(start_at=start_at, end_at=end_at),
        filters=filters,
        limits=ReportLimitsOut(page=page, page_size=page_size),
        metrics=ReportPeriodMetricsOut(
            inquiries=total,
            valid_leads=valid_total,
            unfeedback=unfeedback_total,
            website_kpi=pct(website_total, total),
        ),
        breakdowns=ReportPeriodBreakdownsOut(
            countries=report_breakdown(db, conditions, Lead.country),
            channels=report_breakdown(db, conditions, Lead.source_category),
            products=report_breakdown(db, conditions, Lead.product),
            feedback_statuses=report_breakdown(db, conditions, Lead.feedback_status),
        ),
        items=[
            ReportPeriodLeadItemOut(
                id=row.id,
                customer_name=row.customer_name,
                country=row.country,
                source_category=row.source_category,
                product=row.product,
                feedback_status=row.feedback_status,
                score_label=row.score_label,
                owner_id=row.owner_id,
                detail_path=f"/admin/leads/{row.id}",
            )
            for row in rows
        ],
        total=total,
        downstream=report_downstream_paths(resolved_period, filters),
    )


@app.get("/api/reports/metrics", response_model=ReportMetricDetailOut)
def report_metrics_detail(
    request: Request,
    period: str = Query("day", pattern="^(day|month|quarter|year)$"),
    country: str | None = None,
    source_category: str | None = None,
    product: str | None = None,
    feedback_status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> ReportMetricDetailOut:
    resolved_period, start_at, end_at = report_period_window(period)
    filters = ReportPeriodFiltersOut(
        country=country,
        source_category=source_category,
        product=product,
        feedback_status=feedback_status,
    )
    conditions = report_period_conditions(start_at, end_at, country, source_category, product, feedback_status)
    total = report_count(db, conditions)
    valid_total = report_count(db, conditions, Lead.score_label.in_(VALID_SCORE_LABELS))
    unfeedback_total = report_count(db, conditions, Lead.feedback_status.in_(UNFEEDBACK_LABELS))
    website_total = report_count(db, conditions, Lead.source_category.in_(WEBSITE_SOURCE_LABELS))
    assigned_total = report_count(db, conditions, Lead.owner_id.is_not(None))
    feedback_total = report_count(db, conditions, Lead.feedback_status.notin_(UNFEEDBACK_LABELS))
    customer_total = db.scalar(select(func.count(Customer.id))) or 0

    rows = db.execute(
        select(Lead)
        .where(*conditions)
        .order_by(Lead.created_at.desc(), Lead.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    customer_names = {row.customer_name for row in rows}
    customer_ids = {
        name: customer_id
        for name, customer_id in db.execute(
            select(Customer.name, Customer.id).where(Customer.name.in_(customer_names))
        ).all()
    } if customer_names else {}

    unfeedback_conditions = [*conditions, Lead.feedback_status.in_(UNFEEDBACK_LABELS)]
    channel_rows = report_breakdown(db, conditions, Lead.source_category)
    product_rows = report_breakdown(db, conditions, Lead.product)
    feedback_rows = report_breakdown(db, conditions, Lead.feedback_status)
    unfeedback_rows = report_breakdown(db, unfeedback_conditions, Lead.country)

    add_audit(
        db,
        request.state.trace_id,
        "report_metrics_viewed",
        f"Report metrics detail viewed: {resolved_period}",
        actor_id=user.id,
        target_type="report",
    )
    db.commit()

    empty_state = None
    if total == 0:
        empty_state = ReportMetricDetailEmptyStateOut(
            title="当前筛选没有指标明细",
            action_label="返回周期报表",
            action_path=f"/admin/reports/period?period={resolved_period}",
        )

    return ReportMetricDetailOut(
        period=resolved_period,
        query_window=ReportQueryWindowOut(start_at=start_at, end_at=end_at),
        filters=filters,
        limits=ReportLimitsOut(page=page, page_size=page_size),
        metric_cards=[
            ReportMetricCardOut(key="today_inquiries", label="今日询盘", value=report_count(db, [Lead.created_at >= report_period_window("day")[1]]), hint="当日进入系统的询盘"),
            ReportMetricCardOut(key="valid_leads", label="有效线索", value=valid_total, hint="当前筛选内有效与高意向线索"),
            ReportMetricCardOut(key="unfeedback", label="未反馈", value=unfeedback_total, hint="仍未收到销售反馈"),
            ReportMetricCardOut(key="website_kpi", label="官网 KPI", value=pct(website_total, total), unit="%", hint="官网来源占比"),
        ],
        detail_groups={
            "website_kpi": [
                ReportMetricDetailGroupItemOut(key="attribution_rate", label="官网归因率", value=pct(website_total, total), unit="%", hint="官网来源/总询盘"),
                ReportMetricDetailGroupItemOut(key="ai_completion_rate", label="AI 补全率", value=pct(valid_total, total), unit="%", hint="以有效线索作为已补全口径"),
                ReportMetricDetailGroupItemOut(key="assignment_rate", label="分配完成率", value=pct(assigned_total, total), unit="%", hint="已分配负责人/总询盘"),
                ReportMetricDetailGroupItemOut(key="sales_feedback_rate", label="销售反馈率", value=pct(feedback_total, total), unit="%", hint="已有销售反馈/总询盘"),
                ReportMetricDetailGroupItemOut(key="entered_customer_pool", label="进入客户池", value=customer_total, unit="个客户", hint="当前沉淀客户数"),
            ],
            "unfeedback": breakdown_to_metric_items(unfeedback_rows, key_prefix="unfeedback"),
            "sales_feedback": breakdown_to_metric_items(feedback_rows, key_prefix="feedback"),
            "products": breakdown_to_metric_items(product_rows, key_prefix="product"),
            "channels": breakdown_to_metric_items(channel_rows, key_prefix="channel"),
        },
        items=[
            ReportMetricDetailLeadItemOut(
                lead_id=row.id,
                customer_id=customer_ids.get(row.customer_name),
                customer_name=row.customer_name,
                country=row.country,
                source_category=row.source_category,
                source_label=row.source_label,
                product=row.product,
                feedback_status=row.feedback_status,
                score_label=row.score_label,
                owner_id=row.owner_id,
                lead_detail_path=f"/admin/leads/{row.id}",
                customer_detail_path=(
                    f"/admin/customers/{customer_ids[row.customer_name]}"
                    if row.customer_name in customer_ids
                    else None
                ),
            )
            for row in rows
        ],
        total=total,
        downstream=report_downstream_paths(resolved_period, filters),
        export_summary=ReportMetricDetailExportOut(
            fields=["客户名称", "国家", "来源", "产品", "评分", "反馈", "负责人"],
            desensitization="导出客户联系信息时按角色权限脱敏",
            excludes=["money_metrics"],
        ),
        empty_state=empty_state,
    )


REPORT_EXPORT_FIELDS = ["客户名称", "国家", "来源", "具体来源", "产品", "评分", "反馈", "负责人"]
REPORT_EXPORT_DESENSITIZATION = "导出客户联系信息时按角色权限脱敏"
REPORT_EXPORT_EXCLUDES = ["money_metrics", "raw_inquiry", "conversation_history"]
REPORT_EXPORT_LIMIT = 5000


def report_export_filters(
    period: str,
    country: str | None,
    source_category: str | None,
    product: str | None,
    feedback_status: str | None,
) -> tuple[str, datetime, datetime, ReportPeriodFiltersOut, list[object]]:
    resolved_period, start_at, end_at = report_period_window(period)
    filters = ReportPeriodFiltersOut(
        country=country,
        source_category=source_category,
        product=product,
        feedback_status=feedback_status,
    )
    conditions = report_period_conditions(start_at, end_at, country, source_category, product, feedback_status)
    return resolved_period, start_at, end_at, filters, conditions


def report_export_rows(db: Session, conditions: list[object]) -> list[Lead]:
    return db.scalars(
        select(Lead)
        .where(*conditions)
        .order_by(Lead.created_at.desc(), Lead.id.desc())
        .limit(REPORT_EXPORT_LIMIT)
    ).all()


def render_report_export_csv(db: Session, rows: list[Lead]) -> str:
    owner_ids = {row.owner_id for row in rows if row.owner_id is not None}
    owner_names = {
        owner.id: owner.name
        for owner in db.scalars(select(User).where(User.id.in_(owner_ids))).all()
    } if owner_ids else {}
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(REPORT_EXPORT_FIELDS)
    for row in rows:
        writer.writerow(
            [
                row.customer_name,
                row.country,
                row.source_category,
                row.source_label,
                row.product,
                row.score_label,
                row.feedback_status,
                owner_names.get(row.owner_id or 0, "未分配"),
            ]
        )
    return output.getvalue()


@app.get("/api/reports/export/context", response_model=ReportExportContextOut)
def report_export_context(
    request: Request,
    period: str = Query("day", pattern="^(day|month|quarter|year)$"),
    country: str | None = None,
    source_category: str | None = None,
    product: str | None = None,
    feedback_status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> ReportExportContextOut:
    resolved_period, start_at, end_at, filters, conditions = report_export_filters(
        period,
        country,
        source_category,
        product,
        feedback_status,
    )
    add_audit(
        db,
        request.state.trace_id,
        "report_export_context_viewed",
        f"Report export context viewed: {resolved_period}",
        actor_id=user.id,
        target_type="report_export",
    )
    db.commit()
    return ReportExportContextOut(
        period=resolved_period,
        query_window=ReportQueryWindowOut(start_at=start_at, end_at=end_at),
        filters=filters,
        fields=REPORT_EXPORT_FIELDS,
        desensitization=REPORT_EXPORT_DESENSITIZATION,
        excludes=REPORT_EXPORT_EXCLUDES,
        estimated_rows=report_count(db, conditions),
        confirm_required=True,
        cancel_path=f"/admin/reports/period?period={resolved_period}",
    )


@app.post("/api/reports/export", response_model=ReportExportTaskOut, status_code=status.HTTP_201_CREATED)
def create_report_export(
    payload: ReportExportCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> ReportExportTaskOut:
    resolved_period, _start_at, _end_at, filters, conditions = report_export_filters(
        payload.period,
        payload.country,
        payload.source_category,
        payload.product,
        payload.feedback_status,
    )
    rows = report_export_rows(db, conditions)
    task_id = uuid4().hex
    csv_content = render_report_export_csv(db, rows)
    job = ReportExportJob(
        task_id=task_id,
        period=resolved_period,
        filters_json=json.dumps(filters.model_dump(exclude_none=True), ensure_ascii=False),
        fields_json=json.dumps(REPORT_EXPORT_FIELDS, ensure_ascii=False),
        row_count=len(rows),
        file_content=csv_content,
        status="ready",
        created_by=user.id,
    )
    db.add(job)
    add_audit(
        db,
        request.state.trace_id,
        "report_export_created",
        f"Report export created: {resolved_period}, rows={len(rows)}",
        actor_id=user.id,
        target_type="report_export",
    )
    db.commit()
    return ReportExportTaskOut(
        task_id=task_id,
        status=job.status,
        period=resolved_period,
        filters=filters,
        row_count=job.row_count,
        fields=REPORT_EXPORT_FIELDS,
        desensitization=REPORT_EXPORT_DESENSITIZATION,
        excludes=REPORT_EXPORT_EXCLUDES,
        download_path=f"/api/reports/export/{task_id}/download",
        audit_action="report_export_created",
    )


@app.get("/api/reports/export/{task_id}/download")
def download_report_export(
    task_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> Response:
    job = db.scalar(select(ReportExportJob).where(ReportExportJob.task_id == task_id))
    if not job:
        raise HTTPException(status_code=404, detail=error_detail("REPORT_EXPORT_NOT_FOUND", "Report export task not found"))
    add_audit(
        db,
        request.state.trace_id,
        "report_export_downloaded",
        f"Report export downloaded: {task_id}",
        actor_id=user.id,
        target_type="report_export",
        target_id=job.id,
    )
    db.commit()
    return Response(
        content=job.file_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="report-export-{task_id}.csv"'},
    )


def customer_conditions(user: User, country: str | None, product: str | None, tier: str | None) -> list[object]:
    conditions: list[object] = []
    if user.role == "sales":
        conditions.append(Customer.owner_id == user.id)
    if country:
        conditions.append(Customer.country == country)
    if product:
        conditions.append(Customer.product == product)
    if tier:
        conditions.append(Customer.tier == tier)
    return conditions


def customer_item_out(customer: Customer, owner_names: dict[int, str]) -> CustomerListItem:
    background_summary = ""
    if customer.background:
        background_summary = customer.background.manual_summary or customer.background.auto_summary
    return CustomerListItem(
        id=customer.id,
        name=customer.name,
        country=customer.country,
        customer_type=customer.customer_type,
        product=customer.product,
        tier=customer.tier,
        owner_id=customer.owner_id,
        owner_name=owner_names.get(customer.owner_id or 0, "未分配"),
        background_summary=background_summary,
        detail_path=f"/admin/customers/{customer.id}",
    )


def background_sources(evidence: str) -> list[CustomerBackgroundSourceOut]:
    parts = [part.strip() for part in evidence.replace("\n", "；").split("；") if part.strip()]
    if not parts and evidence.strip():
        parts = [evidence.strip()]
    sources: list[CustomerBackgroundSourceOut] = []
    for index, part in enumerate(parts, start=1):
        lower_part = part.lower()
        if "email" in lower_part or "mail" in lower_part or "邮箱" in part:
            source_type = "email"
        elif "website" in lower_part or "官网" in part or "网站" in part:
            source_type = "website"
        elif "sales" in lower_part or "销售" in part:
            source_type = "sales_feedback"
        else:
            source_type = "manual_or_public"
        sources.append(CustomerBackgroundSourceOut(type=source_type, title=f"Source {index}", detail=part))
    return sources


def build_customer_detail(db: Session, customer: Customer, user: User) -> CustomerDetailOut:
    owner = db.get(User, customer.owner_id) if customer.owner_id else None
    background = customer.background
    if not background:
        raise HTTPException(
            status_code=404,
            detail=error_detail("CUSTOMER_BACKGROUND_NOT_FOUND", "Customer background not found"),
        )

    leads = db.scalars(
        select(Lead).where(Lead.customer_name == customer.name).order_by(Lead.created_at.desc(), Lead.id.desc())
    ).all()
    lead_ids = [lead.id for lead in leads]
    owner_ids = {lead.owner_id for lead in leads if lead.owner_id is not None}
    feedbacks = (
        db.scalars(select(SalesFeedback).where(SalesFeedback.lead_id.in_(lead_ids)).order_by(SalesFeedback.submitted_at.desc())).all()
        if lead_ids
        else []
    )
    owner_ids.update(feedback.owner_id for feedback in feedbacks if feedback.owner_id is not None)
    owner_names = {
        row.id: row.name
        for row in db.scalars(select(User).where(User.id.in_(owner_ids))).all()
    } if owner_ids else {}

    lead_history = [
        CustomerLeadHistoryOut(
            id=lead.id,
            customer_name=lead.customer_name,
            source=f"{lead.source_category} / {lead.source_label}",
            product=lead.product,
            feedback_status=lead.feedback_status,
            owner_name=owner_names.get(lead.owner_id or 0, "Unassigned"),
            created_at=lead.created_at,
        )
        for lead in leads
    ]
    feedback_records = [
        CustomerFeedbackRecordOut(
            status=feedback.feedback_status,
            judgement=feedback.customer_judgement,
            remark=feedback.remark,
            owner_name=owner_names.get(feedback.owner_id, "Unknown"),
            happened_at=feedback.submitted_at,
        )
        for feedback in feedbacks
    ]
    if not feedback_records:
        feedback_records = [
            CustomerFeedbackRecordOut(
                status=lead.feedback_status,
                judgement=lead.score_label,
                remark=f"Lead source: {lead.source_category} / {lead.source_label}",
                owner_name=owner_names.get(lead.owner_id or 0, "Unassigned"),
                happened_at=lead.created_at,
            )
            for lead in leads
        ]
    timeline = [
        CustomerTimelineItemOut(
            status="background_updated",
            summary=f"Background investigation updated by {background.updated_by}",
            happened_at=background.updated_at,
        )
    ]
    timeline.extend(
        CustomerTimelineItemOut(
            status=record.status,
            summary=f"{record.owner_name}: {record.judgement}",
            happened_at=record.happened_at,
        )
        for record in feedback_records
    )
    timeline = sorted(timeline, key=lambda item: item.happened_at, reverse=True)

    return CustomerDetailOut(
        id=customer.id,
        name=customer.name,
        country=customer.country,
        customer_type=customer.customer_type,
        product=customer.product,
        tier=customer.tier,
        owner_id=customer.owner_id,
        owner_name=owner.name if owner else "未分配",
        can_edit_background=user.role in {"admin", "ops"},
        detail_path=f"/admin/customers/{customer.id}",
        background=CustomerBackgroundOut(
            auto_summary=background.auto_summary,
            manual_summary=background.manual_summary,
            current_summary=background.manual_summary or background.auto_summary,
            evidence=background.evidence,
            sources=background_sources(background.evidence),
            confidence=background.confidence,
            updated_by=background.updated_by,
            updated_at=background.updated_at,
        ),
        lead_history=lead_history,
        feedback_records=feedback_records,
        timeline=timeline,
    )


@app.get("/api/customers", response_model=CustomerPage)
def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    country: str | None = None,
    product: str | None = None,
    tier: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> CustomerPage:
    conditions = customer_conditions(user, country, product, tier)
    query = select(Customer).options(joinedload(Customer.background))
    count_query = select(func.count()).select_from(Customer)
    for condition in conditions:
        query = query.where(condition)
        count_query = count_query.where(condition)

    total = db.scalar(count_query) or 0
    rows = db.scalars(query.order_by(Customer.id.desc()).offset((page - 1) * page_size).limit(page_size)).unique().all()
    owner_ids = {row.owner_id for row in rows if row.owner_id is not None}
    owner_names = {
        owner.id: owner.name
        for owner in db.scalars(select(User).where(User.id.in_(owner_ids))).all()
    } if owner_ids else {}

    metric_conditions = customer_conditions(user, None, None, None)

    def metric_count(*extra_conditions) -> int:
        metric_query = select(func.count()).select_from(Customer)
        for condition in [*metric_conditions, *extra_conditions]:
            metric_query = metric_query.where(condition)
        return db.scalar(metric_query) or 0

    empty_state = None
    if total == 0:
        empty_state = EmptyStateOut(title="暂无客户", action_label="返回线索池", action_path="/admin/leads")

    return CustomerPage(
        page=page,
        page_size=page_size,
        total=total,
        metrics=CustomerPoolMetrics(
            total_customers=metric_count(),
            high_intent=metric_count(Customer.tier == "高意向"),
            active_followup=metric_count(Customer.tier == "有效跟进"),
            repository=metric_count(Customer.tier == "资料库"),
        ),
        items=[customer_item_out(row, owner_names) for row in rows],
        empty_state=empty_state,
    )


@app.get("/api/customers/{customer_id}", response_model=CustomerDetailOut)
def get_customer(customer_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)) -> CustomerDetailOut:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(
            status_code=404,
            detail=error_detail("CUSTOMER_NOT_FOUND", "Customer not found"),
        )
    if user.role == "sales" and customer.owner_id != user.id:
        raise HTTPException(
            status_code=403,
            detail=error_detail("CUSTOMER_FORBIDDEN", "No permission to view this customer"),
        )
    return build_customer_detail(db, customer, user)


@app.put("/api/customers/{customer_id}/background", response_model=CustomerDetailOut)
def update_customer_background(
    customer_id: int,
    payload: CustomerBackgroundUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> CustomerDetailOut:
    customer = db.get(Customer, customer_id)
    if not customer or not customer.background:
        raise HTTPException(
            status_code=404,
            detail=error_detail("CUSTOMER_BACKGROUND_NOT_FOUND", "Customer background not found"),
        )
    customer.background.manual_summary = payload.manual_summary
    customer.background.updated_by = user.name
    add_audit(
        db,
        request.state.trace_id,
        "update_customer_background",
        "Customer background manually updated",
        actor_id=user.id,
        target_type="customer",
        target_id=customer.id,
    )
    db.commit()
    db.refresh(customer)
    return build_customer_detail(db, customer, user)


@app.get("/api/settings/summary")
def settings_summary(db: Session = Depends(get_db), user: User = Depends(require_admin_or_ops)) -> dict[str, int]:
    return {
        "sales_users": db.scalar(select(func.count()).select_from(User).where(User.role == "sales")) or 0,
        "sources": db.scalar(select(func.count()).select_from(SourceDictionary).where(SourceDictionary.enabled.is_(True))) or 0,
        "active_banners": db.scalar(select(func.count()).select_from(Banner).where(Banner.active.is_(True))) or 0,
    }


@app.get("/api/settings/sales-users", response_model=list[SalesUserOut])
def sales_users(db: Session = Depends(get_db), user: User = Depends(require_admin_or_ops)) -> list[User]:
    return db.scalars(select(User).where(User.role.in_(["sales", "admin", "ops"])).order_by(User.id)).all()


DEFAULT_PERMISSION_MATRIX = {
    "admin": ["settings.manage", "settings.banner.update", "users.manage", "reports.export", "reports.read"],
    "ops": ["leads.read", "customers.read", "reports.read", "settings.banner.update"],
    "sales": ["leads.assigned.read", "feedback.submit"],
}


def country_mapping_pending_counts(db: Session) -> dict[str, int]:
    rows = db.execute(
        select(Lead.country, func.count())
        .where(Lead.owner_id.is_(None), Lead.country != "")
        .group_by(Lead.country)
    ).all()
    return {country: count for country, count in rows}


def active_country_mapping_lookup(db: Session) -> dict[str, tuple[CountrySalesMapping, User]]:
    rows = db.execute(
        select(CountrySalesMapping, User)
        .join(User, User.id == CountrySalesMapping.sales_user_id)
        .where(CountrySalesMapping.active.is_(True), User.enabled.is_(True), User.role == "sales")
    ).all()
    return {mapping.country: (mapping, owner) for mapping, owner in rows}


def country_sales_mapping_out(
    mapping: CountrySalesMapping,
    owner: User | None,
    pending_count: int,
) -> CountrySalesMappingOut:
    risk_reasons: list[str] = []
    if not mapping.active:
        risk_reasons.append("MAPPING_INACTIVE")
    if owner is None:
        risk_reasons.append("SALES_USER_MISSING")
    elif owner.role != "sales":
        risk_reasons.append("OWNER_NOT_SALES")
    elif not owner.enabled:
        risk_reasons.append("SALES_USER_DISABLED")
    if pending_count:
        risk_reasons.append("PENDING_LEADS_WAITING")
    danger_reasons = {"SALES_USER_MISSING", "OWNER_NOT_SALES", "SALES_USER_DISABLED"}
    risk_level = "danger" if danger_reasons.intersection(risk_reasons) else "warning" if risk_reasons else "normal"
    return CountrySalesMappingOut(
        id=mapping.id,
        country=mapping.country,
        region=mapping.region,
        sales_user_id=mapping.sales_user_id,
        sales_user_name=owner.name if owner else "Unknown",
        sales_user_email=owner.email if owner else "",
        sales_user_enabled=bool(owner.enabled) if owner else False,
        active=mapping.active,
        updated_at=mapping.updated_at,
        pending_count=pending_count,
        risk_level=risk_level,
        risk_reasons=risk_reasons,
    )


def settings_entries() -> list[SettingsEntryOut]:
    return [
        SettingsEntryOut(key="sales_accounts", title="销售账号", description="维护销售与管理员账号", path="/admin/settings?section=sales-users", status="ready"),
        SettingsEntryOut(key="role_permissions", title="角色权限", description="维护后台菜单、按钮和接口权限", path="/admin/settings?section=permissions", status="ready"),
        SettingsEntryOut(key="global_banner", title="全局 Banner", description="上传并发布全部后台页面顶部 Banner", path="/admin/settings?section=banner", status="ready"),
        SettingsEntryOut(key="country_sales_mapping", title="国家区域销售映射", description="维护国家、区域和销售负责人", path="/admin/settings/country-sales", status="warning", risk_count=1),
        SettingsEntryOut(key="product_knowledge", title="产品知识库", description="维护 ultrasound 产品与 AI 接待知识", path="/admin/settings/product-knowledge", status="ready"),
        SettingsEntryOut(key="source_dictionary", title="客户来源字典", description="维护官网、邮箱、社媒和线下展会来源", path="/admin/settings?section=sources", status="ready"),
        SettingsEntryOut(key="channels", title="渠道配置", description="维护 Webhook、邮箱同步和展会导入", path="/admin/settings?section=channels", status="warning", risk_count=1),
        SettingsEntryOut(key="reminder_rules", title="提醒规则", description="维护 24h/48h 未反馈提醒策略", path="/admin/settings?section=reminders", status="ready"),
    ]


def permission_rows(db: Session) -> list[SettingsPermissionOut]:
    rows: list[SettingsPermissionOut] = []
    for role, defaults in DEFAULT_PERMISSION_MATRIX.items():
        setting = db.get(SystemSetting, f"permissions:{role}")
        permissions = defaults
        if setting:
            try:
                loaded = json.loads(setting.value)
                if isinstance(loaded, list) and all(isinstance(item, str) for item in loaded):
                    permissions = loaded
            except json.JSONDecodeError:
                permissions = defaults
        rows.append(SettingsPermissionOut(role=role, permissions=permissions))
    return rows


@app.get("/api/settings/overview", response_model=SettingsOverviewOut)
def settings_overview(db: Session = Depends(get_db), user: User = Depends(require_admin_or_ops)) -> SettingsOverviewOut:
    banner = db.scalar(select(Banner).where(Banner.active.is_(True)).order_by(Banner.updated_at.desc()))
    if not banner:
        raise HTTPException(status_code=404, detail=error_detail("BANNER_NOT_CONFIGURED", "Banner not configured"))
    users = db.scalars(select(User).where(User.role.in_(["sales", "admin", "ops"])).order_by(User.id)).all()
    changes = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(20)).all()
    country_mapping_total = db.scalar(select(func.count()).select_from(CountrySalesMapping).where(CountrySalesMapping.active.is_(True))) or 0
    source_total = db.scalar(select(func.count()).select_from(SourceDictionary).where(SourceDictionary.enabled.is_(True))) or 0
    return SettingsOverviewOut(
        summary={
            "sales_users": len([item for item in users if item.role == "sales"]),
            "admin_ops_users": len([item for item in users if item.role in {"admin", "ops"}]),
            "sources": source_total,
            "active_banners": db.scalar(select(func.count()).select_from(Banner).where(Banner.active.is_(True))) or 0,
            "country_mappings": country_mapping_total,
            "permission_roles": len(DEFAULT_PERMISSION_MATRIX),
        },
        banner=BannerOut.model_validate(banner, from_attributes=True),
        entries=settings_entries(),
        sales_users=[SalesUserOut.model_validate(item, from_attributes=True) for item in users],
        permissions=permission_rows(db),
        risks=["6 个国家缺少销售负责人", "邮箱同步需要重试"],
        recent_changes=[AuditLogOut.model_validate(item, from_attributes=True).model_dump() for item in changes],
    )


@app.get("/api/settings/country-sales", response_model=CountrySalesMappingPage)
def country_sales_mappings(
    country: str | None = None,
    region: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> CountrySalesMappingPage:
    pending_counts = country_mapping_pending_counts(db)
    sales_users = db.scalars(select(User).where(User.role == "sales").order_by(User.enabled.desc(), User.name)).all()
    mapping_rows = db.execute(
        select(CountrySalesMapping, User)
        .join(User, User.id == CountrySalesMapping.sales_user_id, isouter=True)
        .order_by(CountrySalesMapping.region, CountrySalesMapping.country)
    ).all()
    all_items = [
        country_sales_mapping_out(mapping, owner, pending_counts.get(mapping.country, 0))
        for mapping, owner in mapping_rows
    ]
    filtered_items = all_items
    if country:
        country_filter = country.strip().lower()
        filtered_items = [item for item in filtered_items if country_filter in item.country.lower()]
    if region:
        region_filter = region.strip().lower()
        filtered_items = [item for item in filtered_items if region_filter in item.region.lower()]
    if status_filter == "active":
        filtered_items = [item for item in filtered_items if item.active]
    elif status_filter == "inactive":
        filtered_items = [item for item in filtered_items if not item.active]
    elif status_filter == "risk":
        filtered_items = [item for item in filtered_items if item.risk_level != "normal"]

    active_lookup = active_country_mapping_lookup(db)
    mapped_countries = set(active_lookup)
    leads = db.scalars(select(Lead).order_by(Lead.created_at.desc(), Lead.id.desc())).all()
    pending_items: list[PendingAssignmentOut] = []
    for lead in leads:
        reasons = pending_reasons_for_lead(lead, mapped_countries)
        if reasons:
            pending_items.append(pending_assignment_out(db, lead, reasons, active_lookup))

    pending_without_mapping = sum(count for country_name, count in pending_counts.items() if country_name not in mapped_countries)
    start = (page - 1) * page_size
    return CountrySalesMappingPage(
        page=page,
        page_size=page_size,
        total=len(filtered_items),
        summary={
            "active_mappings": len([item for item in all_items if item.active]),
            "inactive_mappings": len([item for item in all_items if not item.active]),
            "risk_mappings": len([item for item in all_items if item.risk_level != "normal"]),
            "pending_without_mapping": pending_without_mapping,
            "enabled_sales_users": len([item for item in sales_users if item.enabled]),
        },
        sales_users=[SalesUserOut.model_validate(item, from_attributes=True) for item in sales_users],
        items=filtered_items[start : start + page_size],
        pending_items=pending_items[:10],
        empty_state=EmptyStateOut(title="暂无国家销售映射", action_label="新增映射", action_path="/admin/settings/country-sales") if not filtered_items else None,
    )


@app.put("/api/settings/country-sales", response_model=CountrySalesMappingOut)
def save_country_sales_mapping(
    payload: CountrySalesMappingUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> CountrySalesMappingOut:
    country = payload.country.strip()
    region = payload.region.strip()
    owner = db.get(User, payload.sales_user_id)
    if not owner or owner.role != "sales" or not owner.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_detail("INVALID_SALES_OWNER", "Sales owner must be an enabled sales user."),
        )
    mapping = db.scalar(select(CountrySalesMapping).where(CountrySalesMapping.country == country))
    if not mapping:
        mapping = CountrySalesMapping(country=country, region=region, sales_user_id=owner.id, active=payload.active)
        db.add(mapping)
    else:
        mapping.region = region
        mapping.sales_user_id = owner.id
        mapping.active = payload.active
    db.flush()
    add_audit(
        db,
        request.state.trace_id,
        "settings_country_sales_mapping_saved",
        f"Country sales mapping saved: {country} -> {region} / {owner.name}.",
        actor_id=user.id,
        target_type="country_sales_mapping",
        target_id=mapping.id,
    )
    db.commit()
    db.refresh(mapping)
    pending_count = country_mapping_pending_counts(db).get(mapping.country, 0)
    return country_sales_mapping_out(mapping, owner, pending_count)


@app.post("/api/settings/sales-users", response_model=SalesUserOut, status_code=status.HTTP_201_CREATED)
def create_sales_user(
    payload: SalesUserCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> User:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=409, detail=error_detail("USER_EMAIL_EXISTS", "User email already exists"))
    new_user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        data_scope=payload.data_scope,
        enabled=payload.enabled,
    )
    db.add(new_user)
    db.flush()
    add_audit(
        db,
        request.state.trace_id,
        "settings_sales_user_created",
        f"Settings sales user created: {payload.email}",
        actor_id=user.id,
        target_type="user",
        target_id=new_user.id,
    )
    db.commit()
    db.refresh(new_user)
    return new_user


def validate_banner_payload(payload: BannerUpdateRequest) -> None:
    allowed_image = (
        payload.image_url.startswith("data:image/png")
        or payload.image_url.startswith("data:image/jpeg")
        or payload.image_url.startswith("data:image/webp")
        or payload.image_url.startswith("/assets/")
        or payload.image_url.startswith("https://")
    )
    if not allowed_image:
        raise HTTPException(status_code=422, detail=error_detail("BANNER_IMAGE_UNSUPPORTED", "Banner image must be PNG, JPG, WebP, /assets, or HTTPS"))
    if payload.link_url and not (payload.link_url.startswith("/admin") or payload.link_url.startswith("https://")):
        raise HTTPException(status_code=422, detail=error_detail("BANNER_LINK_UNSAFE", "Banner link must be an admin path or HTTPS URL"))


@app.put("/api/settings/banner", response_model=BannerOut)
def update_settings_banner(
    payload: BannerUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> Banner:
    validate_banner_payload(payload)
    if payload.active:
        for banner in db.scalars(select(Banner).where(Banner.active.is_(True))).all():
            banner.active = False
    banner = Banner(
        title=payload.title,
        body=payload.body,
        image_url=payload.image_url,
        link_url=payload.link_url,
        active=payload.active,
    )
    db.add(banner)
    db.flush()
    add_audit(
        db,
        request.state.trace_id,
        "settings_banner_published",
        f"Settings banner published: {payload.title}",
        actor_id=user.id,
        target_type="banner",
        target_id=banner.id,
    )
    db.commit()
    db.refresh(banner)
    return banner


@app.put("/api/settings/permissions", response_model=SettingsPermissionOut)
def update_settings_permissions(
    payload: PermissionUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> SettingsPermissionOut:
    setting_key = f"permissions:{payload.role}"
    setting = db.get(SystemSetting, setting_key)
    if not setting:
        setting = SystemSetting(key=setting_key, updated_by=user.id)
        db.add(setting)
    setting.value = json.dumps(payload.permissions, ensure_ascii=False)
    setting.updated_by = user.id
    add_audit(
        db,
        request.state.trace_id,
        "settings_permissions_updated",
        f"Settings permissions updated: {payload.role}",
        actor_id=user.id,
        target_type="permission",
    )
    db.commit()
    return SettingsPermissionOut(role=payload.role, permissions=payload.permissions)


@app.get("/api/audit-logs", response_model=AuditLogPage)
def audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> AuditLogPage:
    total = db.scalar(select(func.count()).select_from(AuditLog)) or 0
    rows = db.scalars(
        select(AuditLog).order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return AuditLogPage(
        page=page,
        page_size=page_size,
        total=total,
        items=[AuditLogOut.model_validate(row, from_attributes=True) for row in rows],
    )

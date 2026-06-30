import csv
import io
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import zipfile
import xml.etree.ElementTree as ET

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, inspect, select, text
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
    SalesFeedback,
    SalesFeedbackLink,
    SourceDictionary,
    User,
)
from .schemas import (
    AssignmentConfirmOut,
    AssignmentConfirmRequest,
    AuditLogOut,
    AuditLogPage,
    BannerOut,
    CustomerBackgroundUpdate,
    CustomerListItem,
    CustomerOut,
    CustomerPage,
    CustomerPoolMetrics,
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
    SalesUserOut,
)
from .security import create_access_token, verify_password
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


def ensure_default_country_mappings(db: Session) -> None:
    maria = db.scalar(select(User).where(User.email == "maria@ultrasound-growth.local"))
    if not maria:
        return
    peru_mapping = db.scalar(select(CountrySalesMapping).where(CountrySalesMapping.country == "Peru"))
    if not peru_mapping:
        db.add(CountrySalesMapping(country="Peru", sales_user_id=maria.id, active=True))
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


def pending_assignment_out(db: Session, lead: Lead, reasons: list[str]) -> PendingAssignmentOut:
    base = LeadOut.model_validate(lead, from_attributes=True).model_dump()
    owner = db.get(User, lead.owner_id) if lead.owner_id else None
    configure_mapping_path = None
    if "COUNTRY_MAPPING_MISSING" in reasons:
        configure_mapping_path = f"/admin/settings?section=country-sales&pending_country={lead.country}"
    return PendingAssignmentOut(
        **base,
        owner_id=owner.id if owner else None,
        owner_name=owner.name if owner else "Unassigned",
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
    mapped_countries = set(
        db.scalars(select(CountrySalesMapping.country).where(CountrySalesMapping.active.is_(True))).all()
    )
    leads = db.scalars(select(Lead).order_by(Lead.created_at.desc(), Lead.id.desc())).all()
    pending_items: list[PendingAssignmentOut] = []
    for lead in leads:
        reasons = pending_reasons_for_lead(lead, mapped_countries)
        if reasons:
            pending_items.append(pending_assignment_out(db, lead, reasons))

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


@app.get("/api/customers/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)) -> Customer:
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
    return customer


@app.put("/api/customers/{customer_id}/background", response_model=CustomerOut)
def update_customer_background(
    customer_id: int,
    payload: CustomerBackgroundUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin_or_ops),
) -> Customer:
    customer = db.get(Customer, customer_id)
    if not customer or not customer.background:
        raise HTTPException(status_code=404, detail="Customer background not found")
    customer.background.manual_summary = payload.manual_summary
    customer.background.updated_by = user.name
    db.add(
        AuditLog(
            actor_id=user.id,
            action="update_customer_background",
            target_type="customer",
            target_id=customer.id,
            detail="Customer background manually updated",
        )
    )
    db.commit()
    db.refresh(customer)
    return customer


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

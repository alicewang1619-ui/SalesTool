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
from sqlalchemy.orm import Session

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
    CustomerOut,
    DashboardMetrics,
    DashboardOut,
    DashboardTimelineItem,
    DashboardTodoOut,
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
                    "raw_inquiry": "瀹㈡埛鍘熸枃锛歐e distribute imaging devices in Peru and need a portable ultrasound portfolio for regional clinics.",
                    "conversation_history": json.dumps(
                        [
                            "瀹㈡埛璇㈤棶 portable ultrasound 浠ｇ悊缁勫悎涓庡尯鍩熻瘖鎵€搴旂敤銆?,
                            "AI 杩介棶鍥藉銆佸鎴疯韩浠藉拰搴旂敤鍦烘櫙鍚庣‘璁ゅ叾涓?Peru 浠ｇ悊鍟嗐€?,
                            "瀹㈡埛琛ㄧず甯屾湜涓夊ぉ鍐呮敹鍒颁骇鍝佸姣旇祫鏂欍€?
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
                    "raw_inquiry": "瀹㈡埛鍘熸枃锛歄ur hospital is reviewing trolley ultrasound systems for emergency and radiology departments.",
                    "conversation_history": json.dumps(
                        [
                            "閭璇㈢洏璇存槑鍖婚櫌姝ｅ湪璇勪及 trolley ultrasound銆?,
                            "AI 浠庨偖绠辩鍚嶅拰鍥藉瀛楁璇嗗埆 UAE Hospital銆?,
                            "绯荤粺鏍囪涓洪渶璺熻繘锛岀瓑寰呰繍钀ュ垎閰嶉攢鍞礋璐ｄ汉銆?
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
                customer_type=clean["customer_type"] or "寰呰ˉ鍏?,
                product=clean["product"] or "寰呰ˉ鍏?,
                source_category=clean["source_category"],
                source_label=clean["source_label"],
                score_label="寰呰ˉ鍏?,
                feedback_status="鏈垎鍙?,
                raw_inquiry=f"瀵煎叆鏉ユ簮锛歿clean['source_category']} / {clean['source_label']}",
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
            f"瀵煎叆浠诲姟 {job.task_id} 瀹屾垚锛屾垚鍔?{job.success_rows} 琛岋紝澶辫触 {job.failed_rows} 琛?,
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
        add_audit(db, trace_id, "login_locked", f"{payload.email} 鍦ㄩ攣瀹氭湡鍐呯户缁皾璇曠櫥褰?)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_detail("LOGIN_LOCKED", "鐧诲綍澶辫触娆℃暟杩囧锛岃绋嶅悗鍐嶈瘯", locked_until=attempt.locked_until.isoformat()),
        )

    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not user.enabled or not verify_password(payload.password, user.password_hash):
        if not attempt:
            attempt = LoginAttempt(email=payload.email, failed_count=0)
            db.add(attempt)
        attempt.failed_count += 1
        if attempt.failed_count >= 5:
            attempt.locked_until = now + timedelta(minutes=15)
        add_audit(db, trace_id, "login_failed", f"{payload.email} 鐧诲綍澶辫触 {attempt.failed_count} 娆?)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_detail("INVALID_CREDENTIALS", "璐﹀彿鎴栧瘑鐮侀敊璇?),
        )

    if attempt:
        attempt.failed_count = 0
        attempt.locked_until = None
    add_audit(db, trace_id, "login_succeeded", f"{payload.email} 鐧诲綍鎴愬姛", actor_id=user.id, target_id=user.id)
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
        raise HTTPException(status_code=404, detail="鏈厤缃?Banner")
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
        add_audit(db, request.state.trace_id, "import_rejected", f"瀵煎叆鏂囦欢琚嫆缁濓細{filename}", actor_id=user.id, target_type="import_job")
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_detail("INVALID_IMPORT_FILE", "浠呮敮鎸?5MB 鍐呯殑 CSV/Excel 瀵煎叆鏂囦欢"),
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
        raise HTTPException(status_code=404, detail="瀵煎叆浠诲姟涓嶅瓨鍦?)
    return import_job_out(job)


@app.get("/api/import-jobs/{task_id}/failed-rows")
def download_import_failures(task_id: str, db: Session = Depends(get_db), user: User = Depends(require_admin_or_ops)) -> Response:
    job = db.scalar(select(ImportJob).where(ImportJob.task_id == task_id))
    if not job:
        raise HTTPException(status_code=404, detail="瀵煎叆浠诲姟涓嶅瓨鍦?)
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
        raise HTTPException(status_code=404, detail="瀵煎叆浠诲姟涓嶅瓨鍦?)
    if job.status != "completed":
        process_import_job(db, job)
    add_audit(db, request.state.trace_id, "import_job_retried", f"瀵煎叆浠诲姟 {task_id} 宸查噸璇?, actor_id=user.id, target_type="import_job", target_id=job.id)
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


def pending_assignment_out(lead: Lead, reasons: list[str]) -> PendingAssignmentOut:
    base = LeadOut.model_validate(lead, from_attributes=True).model_dump()
    configure_mapping_path = None
    if "COUNTRY_MAPPING_MISSING" in reasons:
        configure_mapping_path = f"/admin/settings?section=country-sales&pending_country={lead.country}"
    return PendingAssignmentOut(
        **base,
        pending_reasons=reasons,
        detail_path=f"/admin/leads/{lead.id}",
        configure_mapping_path=configure_mapping_path,
    )


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
            pending_items.append(pending_assignment_out(lead, reasons))

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
        raise HTTPException(status_code=404, detail="绾跨储涓嶅瓨鍦?)
    if user.role == "sales" and lead.owner_id != user.id:
        raise HTTPException(status_code=403, detail="鏃犳潈鏌ョ湅璇ョ嚎绱?)
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
        else f"{lead.customer_name} 灏氭湭鍏宠仈瀹㈡埛鑳屾櫙璋冩煡锛岄渶杩愯惀琛ュ厖瀹樼綉鎴栭偖绠卞叕寮€淇℃伅銆?
    )
    feedback_text = (
        f"{owner.name if owner else '寰呭垎閰?} 褰撳墠鐘舵€佷负 {lead.feedback_status}锛岀嚎绱㈡潵鑷?{source}銆?
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
            f"璇勫垎鏍囩锛歿lead.score_label}",
            f"瀹㈡埛韬唤涓?{lead.customer_type}锛屼骇鍝佸叴瓒ｆ槑纭€?,
            "鍥藉瀛楁瀹屾暣锛屽彲杩涘叆閿€鍞垎鍙戣鍒欍€?,
        ],
        background_summary=background_summary,
        background_confidence=background.confidence if background else "寰呰ˉ鍏?,
        background_updated_at=background.updated_at if background else None,
        customer_id=customer.id if customer else None,
        assignment=LeadAssignmentOut(
            owner_id=owner.id if owner else None,
            owner_name=owner.name if owner else "寰呭垎閰?,
            status=lead.feedback_status,
        ),
        feedback_history=[
            feedback_text,
            "閿€鍞弽棣堜紭鍏堜簬 AI 璇勫垎锛屼絾 AI 鍒ゆ柇鐞嗙敱浼氫繚鐣欏湪璇︽儏涓€?,
        ],
        background_task_status="宸插畬鎴? if background else "寰呰ˉ鍏?,
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
        raise HTTPException(status_code=404, detail="绾跨储涓嶅瓨鍦?)
    if payload.owner_id is not None:
        owner = db.get(User, payload.owner_id)
        if not owner or owner.role != "sales" or not owner.enabled:
            raise HTTPException(status_code=400, detail="璐熻矗浜哄繀椤绘槸鍚敤鐨勯攢鍞处鍙?)
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
    website_total = scoped_count(Lead.source_category.in_(["缃戠珯", "缂冩垹鐝?]))
    rows = db.scalars(query.order_by(Lead.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()

    add_audit(db, request.state.trace_id, "dashboard_viewed", "鐢ㄦ埛鏌ョ湅宸ヤ綔鍙伴椤?, actor_id=user.id, target_type="dashboard")
    db.commit()

    return DashboardOut(
        page=page,
        page_size=page_size,
        total=total,
        metrics=DashboardMetrics(
            today_inquiries=scoped_count(Lead.created_at >= today_start),
            valid_leads=scoped_count(Lead.score_label.in_(["鏈夋晥", "閺堝鏅?])),
            unfeedback=scoped_count(Lead.feedback_status.in_(["鏈弽棣?, "閺堫亜寮芥＃?"])),
            website_kpi=round((website_total / total) * 100) if total else 0,
        ),
        ai_summary="宸ヤ綔鍙版眹鎬诲綋鍓嶇嚎绱€佸鎴蜂笌鍙嶉鐘舵€侊紝鎵€鏈夋暟瀛楃敱鍚庣鎸夌櫥褰曠敤鎴锋潈闄愯仛鍚堢敓鎴愩€?,
        assignment_timeline=[
            DashboardTimelineItem(label="绾跨储杩涘叆", value=f"{total} 鏉″緟澶勭悊璁板綍"),
            DashboardTimelineItem(label="鏈夋晥鍒ゆ柇", value="浼樺厛澶勭悊鏈夋晥涓庨珮鎰忓悜瀹㈡埛"),
            DashboardTimelineItem(label="閿€鍞弽棣?, value="鏈弽棣堣褰曢渶瑕佺户缁窡杩?),
        ],
        items=[
            DashboardTodoOut(
                **LeadOut.model_validate(row, from_attributes=True).model_dump(),
                detail_path=f"/admin/leads/{row.id}",
            )
            for row in rows
        ],
    )


@app.get("/api/customers/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)) -> Customer:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="瀹㈡埛涓嶅瓨鍦?)
    if user.role == "sales" and customer.owner_id != user.id:
        raise HTTPException(status_code=403, detail="鏃犳潈鏌ョ湅璇ュ鎴?)
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
        raise HTTPException(status_code=404, detail="瀹㈡埛鑳屾櫙璋冩煡涓嶅瓨鍦?)
    customer.background.manual_summary = payload.manual_summary
    customer.background.updated_by = user.name
    db.add(
        AuditLog(
            actor_id=user.id,
            action="update_customer_background",
            target_type="customer",
            target_id=customer.id,
            detail="浜哄伐淇敼瀹㈡埛鑳屾櫙璋冩煡",
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

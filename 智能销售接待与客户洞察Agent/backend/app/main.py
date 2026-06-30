from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, inspect, select, text
from sqlalchemy.orm import Session

from .config import get_settings
from .database import Base, engine, get_db
from .dependencies import current_user, require_admin_or_ops
from .models import AuditLog, Banner, Customer, CustomerBackground, Lead, LoginAttempt, SourceDictionary, User
from .schemas import (
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
    if "audit_logs" not in inspector.get_table_names():
        return
    column_names = {column["name"] for column in inspector.get_columns("audit_logs")}
    if "trace_id" not in column_names:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE audit_logs ADD COLUMN trace_id VARCHAR(64) NOT NULL DEFAULT ''"))


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_compatibility()
    with next(get_db()) as db:
        seed_data(db)


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


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> LoginResponse:
    now = datetime.utcnow()
    trace_id = request.state.trace_id
    attempt = db.get(LoginAttempt, payload.email)
    if attempt and attempt.locked_until and attempt.locked_until > now:
        add_audit(db, trace_id, "login_locked", f"{payload.email} 在锁定期内继续尝试登录")
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_detail("LOGIN_LOCKED", "登录失败次数过多，请稍后再试", locked_until=attempt.locked_until.isoformat()),
        )

    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not user.enabled or not verify_password(payload.password, user.password_hash):
        if not attempt:
            attempt = LoginAttempt(email=payload.email, failed_count=0)
            db.add(attempt)
        attempt.failed_count += 1
        if attempt.failed_count >= 5:
            attempt.locked_until = now + timedelta(minutes=15)
        add_audit(db, trace_id, "login_failed", f"{payload.email} 登录失败 {attempt.failed_count} 次")
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_detail("INVALID_CREDENTIALS", "账号或密码错误"),
        )

    if attempt:
        attempt.failed_count = 0
        attempt.locked_until = None
    add_audit(db, trace_id, "login_succeeded", f"{payload.email} 登录成功", actor_id=user.id, target_id=user.id)
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
        raise HTTPException(status_code=404, detail="未配置 Banner")
    return banner


@app.get("/api/source-dictionary")
def source_dictionary(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[dict[str, str]]:
    sources = db.scalars(select(SourceDictionary).where(SourceDictionary.enabled.is_(True)).order_by(SourceDictionary.id)).all()
    return [{"category": item.category, "label": item.label} for item in sources]


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
        raise HTTPException(status_code=404, detail="线索不存在")
    if user.role == "sales" and lead.owner_id != user.id:
        raise HTTPException(status_code=403, detail="无权查看该线索")
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
        else f"{lead.customer_name} 尚未关联客户背景调查，需运营补充官网或邮箱公开信息。"
    )
    feedback_text = (
        f"{owner.name if owner else '待分配'} 当前状态为 {lead.feedback_status}，线索来自 {source}。"
    )
    return LeadDetailOut(
        **base,
        raw_inquiry=f"{lead.customer_name} 咨询 {lead.product}，国家 {lead.country}，来源 {source}。",
        conversation_history=[
            f"客户表达对 {lead.product} 的采购兴趣。",
            f"AI 已补全国家为 {lead.country}，客户类型为 {lead.customer_type}。",
            "系统保留原始询盘、会话摘要和后续销售反馈，供人工判断。",
        ],
        profile_summary=LeadProfileSummary(
            customer_type=lead.customer_type,
            country=lead.country,
            product=lead.product,
            source=source,
        ),
        score_reasons=[
            f"评分标签：{lead.score_label}",
            f"客户身份为 {lead.customer_type}，产品兴趣明确。",
            "国家字段完整，可进入销售分发规则。",
        ],
        background_summary=background_summary,
        background_confidence=background.confidence if background else "待补充",
        background_updated_at=background.updated_at if background else None,
        customer_id=customer.id if customer else None,
        assignment=LeadAssignmentOut(
            owner_id=owner.id if owner else None,
            owner_name=owner.name if owner else "待分配",
            status=lead.feedback_status,
        ),
        feedback_history=[
            feedback_text,
            "销售反馈优先于 AI 评分，但 AI 判断理由会保留在详情中。",
        ],
        background_task_status="已完成" if background else "待补充",
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
        raise HTTPException(status_code=404, detail="线索不存在")
    if payload.owner_id is not None:
        owner = db.get(User, payload.owner_id)
        if not owner or owner.role != "sales" or not owner.enabled:
            raise HTTPException(status_code=400, detail="负责人必须是启用的销售账号")
        lead.owner_id = owner.id
    else:
        lead.owner_id = None
    lead.feedback_status = payload.feedback_status
    add_audit(
        db,
        request.state.trace_id,
        "lead_assignment_updated",
        f"线索 {lead.customer_name} 分发状态更新为 {payload.feedback_status}",
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
    website_total = scoped_count(Lead.source_category.in_(["网站", "缃戠珯"]))
    rows = db.scalars(query.order_by(Lead.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()

    add_audit(db, request.state.trace_id, "dashboard_viewed", "用户查看工作台首页", actor_id=user.id, target_type="dashboard")
    db.commit()

    return DashboardOut(
        page=page,
        page_size=page_size,
        total=total,
        metrics=DashboardMetrics(
            today_inquiries=scoped_count(Lead.created_at >= today_start),
            valid_leads=scoped_count(Lead.score_label.in_(["有效", "鏈夋晥"])),
            unfeedback=scoped_count(Lead.feedback_status.in_(["未反馈", "鏈弽棣?"])),
            website_kpi=round((website_total / total) * 100) if total else 0,
        ),
        ai_summary="工作台汇总当前线索、客户与反馈状态，所有数字由后端按登录用户权限聚合生成。",
        assignment_timeline=[
            DashboardTimelineItem(label="线索进入", value=f"{total} 条待处理记录"),
            DashboardTimelineItem(label="有效判断", value="优先处理有效与高意向客户"),
            DashboardTimelineItem(label="销售反馈", value="未反馈记录需要继续跟进"),
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
        raise HTTPException(status_code=404, detail="客户不存在")
    if user.role == "sales" and customer.owner_id != user.id:
        raise HTTPException(status_code=403, detail="无权查看该客户")
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
        raise HTTPException(status_code=404, detail="客户背景调查不存在")
    customer.background.manual_summary = payload.manual_summary
    customer.background.updated_by = user.name
    db.add(
        AuditLog(
            actor_id=user.id,
            action="update_customer_background",
            target_type="customer",
            target_id=customer.id,
            detail="人工修改客户背景调查",
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

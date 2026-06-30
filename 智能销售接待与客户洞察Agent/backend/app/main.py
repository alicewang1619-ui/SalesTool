from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import Base, engine, get_db
from .dependencies import current_user, require_admin_or_ops
from .models import AuditLog, Banner, Customer, CustomerBackground, Lead, SourceDictionary, User
from .schemas import (
    BannerOut,
    CustomerBackgroundUpdate,
    CustomerOut,
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


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    with next(get_db()) as db:
        seed_data(db)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not user.enabled or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")
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


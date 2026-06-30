from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import decode_access_token


def error_detail(code: str, message: str) -> dict[str, str]:
    return {"code": code, "message": message}


def current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_detail("UNAUTHENTICATED", "未登录或会话已过期"),
        )
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = decode_access_token(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_detail("INVALID_SESSION", "无效会话"),
        ) from exc
    user = db.get(User, int(payload["sub"]))
    if not user or not user.enabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_detail("ACCOUNT_DISABLED", "账号不可用"),
        )
    return user


def require_admin_or_ops(user: User = Depends(current_user)) -> User:
    if user.role not in {"admin", "ops"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_detail("FORBIDDEN", "无权限访问该配置"),
        )
    return user

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Ultrasound Growth API"
    database_url: str = "sqlite:///./ultrasound_growth.db"
    jwt_secret: str = "local-dev-change-me"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if not settings.jwt_secret or settings.jwt_secret == "change-me":
        raise RuntimeError("JWT_SECRET must be configured")
    return settings


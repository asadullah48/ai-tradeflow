"""Application configuration, loaded from environment variables."""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database - SQLite by default for local dev, swap DATABASE_URL for
    # Postgres in production (e.g. Railway sets this automatically).
    database_url: str = "sqlite:///./tradeflow.db"

    # Auth
    jwt_secret: str = "dev-secret-change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Agent (Munshi AI) - required only when actually calling the LLM;
    # everything else in the app works without it.
    openai_api_key: str | None = None
    agent_model: str = "gpt-4o-mini"

    # Multi-tenancy (Open Decision #2): column exists, not yet enforced.
    default_tenant_id: str = "default"

    # CORS
    frontend_origin: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()

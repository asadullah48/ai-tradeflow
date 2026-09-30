"""Application configuration, loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-secret-change-me-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "development" creates tables on startup for convenience; "production"
    # requires Alembic migrations and a real JWT secret (see app/main.py).
    environment: str = "development"

    # SQLite by default for local dev; PostgreSQL in production.
    database_url: str = "sqlite:///./tradeflow.db"

    # Auth
    jwt_secret: str = DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Self-service sign-up creates a new, empty business. Set false to make
    # onboarding invite-only (owners still add staff through /team).
    allow_signup: bool = True

    # Agent (Munshi AI) - required only when actually calling the LLM;
    # everything else in the app works without it.
    openai_api_key: str | None = None
    agent_model: str = "gpt-4o-mini"

    # CORS - one origin, or several separated by commas.
    frontend_origin: str = "http://localhost:3000"

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origin.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

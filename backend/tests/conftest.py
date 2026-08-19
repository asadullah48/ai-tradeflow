"""Shared pytest fixtures - an isolated in-memory SQLite DB per test, plus
a FastAPI TestClient wired to use it (never the real tradeflow.db).

Important: app/agent/tools.py opens its OWN db sessions via
`app.database.SessionLocal()` (by design - each tool is meant to be a
self-contained, stateless call, mirroring a real MCP tool). For tests to
see the same data through both the HTTP client AND the agent tools, we
monkeypatch `app.database.SessionLocal` itself to point at the same
StaticPool-backed in-memory engine as the `client` fixture uses.
"""

import os

os.environ["OPENAI_API_KEY"] = ""  # force offline mode for the whole test run
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.database as app_database
import app.models  # noqa: F401 - registers every model on Base.metadata
from app.database import Base, get_db
from app.main import app as fastapi_app


@pytest.fixture()
def db_session(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Redirect anything calling app.database.SessionLocal() (e.g. agent
    # tools) to this same test engine/connection.
    monkeypatch.setattr(app_database, "SessionLocal", TestingSessionLocal)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    from fastapi.testclient import TestClient

    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client):
    client.post(
        "/auth/register",
        json={"name": "Test Owner", "phone": "03000000000", "password": "testpass123", "role": "owner"},
    )
    resp = client.post("/auth/login", json={"phone": "03000000000", "password": "testpass123"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

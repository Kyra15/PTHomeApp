from app import create_app
from app.config import Config
from app.extensions import supabase_ext


class NoSupabase(Config):
    SUPABASE_URL = ""
    SUPABASE_SERVICE_ROLE_KEY = ""


def test_health_returns_200_without_supabase():
    client = create_app(NoSupabase).test_client()
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.get_json() == {"status": "ok", "supabase": "not_configured"}


def test_health_db_503_when_not_configured():
    client = create_app(NoSupabase).test_client()
    assert client.get("/health/db").status_code == 503


def test_health_db_200_when_supabase_ok(monkeypatch):
    monkeypatch.setattr(supabase_ext, "check", lambda app: (True, "connected"))
    client = create_app(NoSupabase).test_client()
    resp = client.get("/health/db")
    assert resp.status_code == 200
    assert resp.get_json()["supabase"] == "connected"

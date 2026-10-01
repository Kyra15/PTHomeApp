from unittest.mock import MagicMock

from app import create_app
from app.config import Config


class WithAdminKey(Config):
    SUPABASE_URL = "https://example.supabase.co"
    SUPABASE_SECRET_KEY = "sb_secret_fake"
    ADMIN_PROVISION_KEY = "test-key-123"


def test_create_therapist_requires_admin_key():
    client = create_app(WithAdminKey).test_client()
    resp = client.post("/admin/therapists", json={})
    assert resp.status_code == 401


def test_create_therapist_validates_body():
    client = create_app(WithAdminKey).test_client()
    resp = client.post(
        "/admin/therapists",
        json={"email": "a@b.com"},
        headers={"X-Admin-Key": "test-key-123"},
    )
    assert resp.status_code == 400


def test_create_therapist_promotes_role(monkeypatch):
    app = create_app(WithAdminKey)
    client = app.test_client()

    fake_client = MagicMock()
    fake_client.auth.admin.create_user.return_value.user.id = "user-123"
    monkeypatch.setattr("app.routes.admin.supabase_ext.client", lambda _app: fake_client)

    resp = client.post(
        "/admin/therapists",
        json={
            "email": "therapist@example.com",
            "password": "correct horse battery staple",
            "first_name": "Grace",
            "last_name": "Hopper",
        },
        headers={"X-Admin-Key": "test-key-123"},
    )
    assert resp.status_code == 201
    assert resp.get_json() == {"id": "user-123", "email": "therapist@example.com"}
    fake_client.table.assert_called_with("users")
    fake_client.table.return_value.update.assert_called_with({"role": "therapist"})

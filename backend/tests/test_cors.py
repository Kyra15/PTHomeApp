from app import create_app
from app.config import Config


class WithCors(Config):
    CORS_ORIGINS = ["http://localhost:5173"]


def test_admin_route_has_cors_header_for_allowed_origin():
    client = create_app(WithCors).test_client()
    resp = client.options(
        "/admin/therapists",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert resp.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"


def test_health_route_has_no_cors_header():
    client = create_app(WithCors).test_client()
    resp = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert "Access-Control-Allow-Origin" not in resp.headers

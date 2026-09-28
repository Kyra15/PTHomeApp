from flask import Blueprint, current_app, jsonify

from ..extensions import supabase_ext

bp = Blueprint("health", __name__)


@bp.get("/health")
def health():
    """Liveness: 200 whenever the server is up. Reports Supabase status in the body."""
    _, detail = supabase_ext.check(current_app)
    return jsonify(status="ok", supabase=detail), 200


@bp.get("/health/db")
def health_db():
    """Strict check: 200 only if Supabase is reachable, otherwise 503."""
    ok, detail = supabase_ext.check(current_app)
    return jsonify(status="ok" if ok else "degraded", supabase=detail), (200 if ok else 503)

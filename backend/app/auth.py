"""Bearer-token auth for the therapist portal and the patient app.

Both clients sign in with Supabase and send `Authorization: Bearer <access token>`. The backend asks
Supabase who the token belongs to, then loads the matching public.users row to check the role.
"""
from functools import wraps

from flask import current_app, g, jsonify, request

from .extensions import supabase_ext

PROFILE_COLUMNS = "id, role, active, office_id, first_name, last_name, full_name, email"


def _bearer_token():
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip() or None
    return None


def display_name(profile: dict) -> str:
    name = " ".join(p for p in (profile.get("first_name"), profile.get("last_name")) if p)
    return name or profile.get("full_name") or "Your care team"


def email_confirmed(auth_user) -> bool:
    """True once the person clicked the confirmation link Supabase emailed them."""
    return bool(getattr(auth_user, "email_confirmed_at", None) or getattr(auth_user, "confirmed_at", None))


def require_role(role: str):
    """Decorator: 401 without a valid token, 403 if the account isn't an active `role`.

    On success sets g.client (service-role Supabase client), g.auth_user and g.profile.
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            token = _bearer_token()
            if not token:
                return jsonify(error="unauthorized"), 401
            client = supabase_ext.client(current_app)
            try:
                auth_user = client.auth.get_user(token).user
            except Exception:
                return jsonify(error="unauthorized"), 401
            if auth_user is None:
                return jsonify(error="unauthorized"), 401
            rows = (
                client.table("users").select(PROFILE_COLUMNS).eq("id", auth_user.id).limit(1).execute().data
            )
            if not rows or rows[0].get("role") != role or rows[0].get("active") is False:
                return jsonify(error="forbidden"), 403
            g.client, g.auth_user, g.profile = client, auth_user, rows[0]
            return fn(*args, **kwargs)

        return wrapper

    return decorator

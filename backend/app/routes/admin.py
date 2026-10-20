from flask import Blueprint, current_app, jsonify, request

from ..extensions import supabase_ext

bp = Blueprint("admin", __name__, url_prefix="/admin")


@bp.post("/therapists")
def create_therapist():
    """Create a therapist/admin account (called by the portal's "Create account" form).

    Open sign-up: no organization code is required. The role is set here on the server — a client can
    never pick its own role — and a therapist only ever sees patients linked to them (Row Level Security).
    """
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip()
    password = body.get("password") or ""
    first_name = (body.get("first_name") or "").strip()
    last_name = (body.get("last_name") or "").strip()
    if not email or not password or not first_name or not last_name:
        return jsonify(error="email, password, first_name, last_name are all required"), 400

    client = supabase_ext.client(current_app)
    try:
        created = client.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,  # staff accounts don't need to click a confirmation link
                "user_metadata": {
                    "first_name": first_name,
                    "last_name": last_name,
                    "full_name": f"{first_name} {last_name}",
                },
            }
        )
    except Exception as exc:  # e.g. email already registered
        return jsonify(error=str(exc)), 400

    user_id = created.user.id
    # The handle_new_user trigger inserts the row as role='patient'; promote it to therapist.
    changes = {"role": "therapist"}
    # Therapists in the same office can transfer patients to each other, so remember which office.
    office_name = (body.get("office_name") or "").strip()[:120]
    if office_name:
        changes["office_id"] = _find_or_create_office(client, office_name)
    client.table("users").update(changes).eq("id", user_id).execute()
    return jsonify(id=user_id, email=email), 201


def _find_or_create_office(client, name: str) -> str:
    # Case-insensitive match; escape LIKE wildcards so "100%" doesn't match everything.
    pattern = name.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    found = client.table("offices").select("id").ilike("name", pattern).limit(1).execute().data
    if found:
        return found[0]["id"]
    return client.table("offices").insert({"name": name}).execute().data[0]["id"]

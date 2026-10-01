from flask import Blueprint, current_app, jsonify, request

from ..extensions import supabase_ext

bp = Blueprint("admin", __name__, url_prefix="/admin")


@bp.post("/therapists")
def create_therapist():
    """Provision a therapist/admin account (F02 #2: admins are provisioned by the org, not
    self-serve). Protected by X-Admin-Key so only whoever holds that secret can call it —
    there is no therapist sign-up screen anywhere in the app on purpose.
    """
    admin_key = current_app.config["ADMIN_PROVISION_KEY"]
    if not admin_key or request.headers.get("X-Admin-Key") != admin_key:
        return jsonify(error="unauthorized"), 401

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
    client.table("users").update({"role": "therapist"}).eq("id", user_id).execute()
    return jsonify(id=user_id, email=email), 201

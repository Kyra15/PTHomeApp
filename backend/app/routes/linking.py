"""Invitations + patient<->therapist linking.

Therapist (admin-web, Bearer token):
  POST /therapist/invitations                  invite a patient by email
  GET  /therapist/invitations                  list invitations with pending / not accepted / activated status
  POST /therapist/invitations/<id>/resend      re-send (and extend) a pending/expired invite
  POST /therapist/invitations/<id>/revoke      cancel a pending invite
  GET  /therapist/colleagues                   other active therapists in my office (transfer targets)
  POST /therapist/patients/<id>/transfer       hand a patient to a colleague in the same office

Patient (iPhone app, Bearer token):
  GET  /patient/invitations                    pending in-app invitations addressed to my (confirmed) email
  POST /patient/invitations/accept             accept by typing the code
  POST /patient/invitations/<id>/accept        accept from the in-app invitation card
  POST /patient/invitations/<id>/decline
  POST /patient/push-token                     register this device for push notifications

Rules that matter:
  * A patient can only accept after confirming their email, and only an invitation addressed to THAT
    email. A leaked code is useless to anyone else; mismatches get the same generic "invalid code".
  * A patient can be linked to many therapists at once (care_links); plans keep their own therapist_id.
"""
import re
import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, g, jsonify, request

from ..auth import display_name, email_confirmed, require_role
from ..notify import send_invite_email, send_push

bp = Blueprint("linking", __name__)

CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O/1/I/L lookalikes
CODE_LENGTH = 8
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
BAD_CODE = "That code isn't valid or has expired. Ask your therapist to send a new invitation."


# ---------- small helpers ----------
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _parse(ts: str | None) -> datetime | None:
    if not ts:
        return None
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _is_expired(inv: dict) -> bool:
    exp = _parse(inv.get("expires_at"))
    return inv["status"] == "pending" and exp is not None and exp < _now()


def _display_status(inv: dict) -> str:
    """pending | expired | declined | revoked | accepted — the portal groups these as
    Pending / Not accepted (expired, declined, revoked) / Activated (accepted)."""
    return "expired" if _is_expired(inv) else inv["status"]


def _public(inv: dict) -> dict:
    return {
        "id": inv["id"],
        "email": inv["email"],
        "patient_name": inv.get("patient_name"),
        "code": inv["code"],
        "status": inv["status"],
        "display_status": _display_status(inv),
        "existing_patient": bool(inv.get("patient_id")),
        "email_sent_at": inv.get("email_sent_at"),
        "created_at": inv.get("created_at"),
        "expires_at": inv.get("expires_at"),
        "responded_at": inv.get("responded_at"),
    }


def _normalize_email(value) -> str:
    return (value or "").strip().lower()


def _normalize_code(value) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", value or "").upper()


def _new_code(client) -> str:
    for _ in range(10):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        if not client.table("invitations").select("id").eq("code", code).limit(1).execute().data:
            return code
    raise RuntimeError("could not generate a unique invite code")


def _push_to(user_id: str, *, title: str, body: str, data: dict) -> bool:
    rows = g.client.table("device_push_tokens").select("token").eq("user_id", user_id).execute().data
    return send_push(current_app.config, [r["token"] for r in rows], title=title, body=body, data=data)


def _deliver(inv: dict, therapist: dict) -> dict:
    """Email the invite (always) and push to the patient's phone (when they already have the app)."""
    code = inv["code"]
    link = f"{current_app.config['PORTAL_URL']}/invite/{code}"
    name = display_name(therapist)
    existing = bool(inv.get("patient_id"))
    email_sent, email_error = send_invite_email(
        current_app.config, to=inv["email"], therapist_name=name, code=code, link=link, existing_user=existing
    )
    if email_sent:
        g.client.table("invitations").update({"email_sent_at": _iso(_now())}).eq("id", inv["id"]).execute()
    push_sent = False
    if existing:
        push_sent = _push_to(
            inv["patient_id"],
            title="New care team invitation",
            body=f"{name} invited you to connect on Kinetic.",
            data={"type": "doctor_invite", "invitation_id": inv["id"]},
        )
    return {"email_sent": email_sent, "email_error": email_error, "push_sent": push_sent, "existing_patient": existing, "invite_link": link}


# ---------- therapist: invitations ----------
@bp.post("/therapist/invitations")
@require_role("therapist")
def create_invitation():
    body = request.get_json(silent=True) or {}
    email = _normalize_email(body.get("email"))
    if not EMAIL_RE.match(email) or len(email) > 254:
        return jsonify(error="Enter a valid email address."), 400
    patient_name = (body.get("patient_name") or "").strip()[:120] or None

    c, me = g.client, g.profile
    patient_id = None
    existing = c.table("users").select("id, role").eq("email", email).limit(1).execute().data
    if existing:
        if existing[0]["role"] != "patient":
            return jsonify(error="That email belongs to a staff account, not a patient."), 400
        patient_id = existing[0]["id"]
        linked = (
            c.table("care_links").select("id").eq("therapist_id", me["id"]).eq("patient_id", patient_id)
            .eq("status", "active").limit(1).execute().data
        )
        if linked:
            return jsonify(error="That patient is already on your caseload."), 409

    pending = (
        c.table("invitations").select("*").eq("therapist_id", me["id"]).eq("email", email)
        .eq("status", "pending").execute().data
    )
    for old in pending:
        if not _is_expired(old):
            return jsonify(error="There's already a pending invitation for that email. Use Resend instead.",
                           invitation_id=old["id"]), 409
        # An expired one would block the unique "one pending invite per email" rule — retire it.
        c.table("invitations").update({"status": "revoked", "responded_at": _iso(_now())}).eq("id", old["id"]).execute()

    ttl = current_app.config["INVITE_TTL_DAYS"]
    inv = c.table("invitations").insert({
        "therapist_id": me["id"],
        "email": email,
        "patient_name": patient_name,
        "code": _new_code(c),
        "patient_id": patient_id,
        "status": "pending",
        "expires_at": _iso(_now() + timedelta(days=ttl)),
    }).execute().data[0]
    return jsonify(invitation=_public(inv), **_deliver(inv, me)), 201


@bp.get("/therapist/invitations")
@require_role("therapist")
def list_invitations():
    rows = (
        g.client.table("invitations").select("*").eq("therapist_id", g.profile["id"])
        .order("created_at", desc=True).execute().data
    )
    return jsonify(invitations=[_public(r) for r in rows])


def _own_invitation(inv_id: str):
    rows = (
        g.client.table("invitations").select("*").eq("id", inv_id).eq("therapist_id", g.profile["id"])
        .limit(1).execute().data
    )
    return rows[0] if rows else None


@bp.post("/therapist/invitations/<inv_id>/resend")
@require_role("therapist")
def resend_invitation(inv_id):
    inv = _own_invitation(inv_id)
    if not inv:
        return jsonify(error="not_found"), 404
    if inv["status"] != "pending":
        return jsonify(error=f"This invitation was {inv['status']}; send a new invitation instead."), 409
    new_expiry = _iso(_now() + timedelta(days=current_app.config["INVITE_TTL_DAYS"]))
    inv = g.client.table("invitations").update({"expires_at": new_expiry}).eq("id", inv_id).execute().data[0]
    return jsonify(invitation=_public(inv), **_deliver(inv, g.profile))


@bp.post("/therapist/invitations/<inv_id>/revoke")
@require_role("therapist")
def revoke_invitation(inv_id):
    inv = _own_invitation(inv_id)
    if not inv:
        return jsonify(error="not_found"), 404
    updated = (
        g.client.table("invitations")
        .update({"status": "revoked", "responded_at": _iso(_now())})
        .eq("id", inv_id).eq("status", "pending").execute().data
    )
    if not updated:
        return jsonify(error=f"This invitation was already {inv['status']}."), 409
    return jsonify(invitation=_public(updated[0]))


# ---------- therapist: transfer ----------
@bp.get("/therapist/colleagues")
@require_role("therapist")
def list_colleagues():
    office_id = g.profile.get("office_id")
    if not office_id:
        return jsonify(colleagues=[], office=None)
    rows = (
        g.client.table("users").select("id, first_name, last_name, full_name")
        .eq("office_id", office_id).eq("role", "therapist").eq("active", True).execute().data
    )
    colleagues = [{"id": r["id"], "name": display_name(r)} for r in rows if r["id"] != g.profile["id"]]
    return jsonify(colleagues=colleagues, office=office_id)


@bp.post("/therapist/patients/<patient_id>/transfer")
@require_role("therapist")
def transfer_patient(patient_id):
    to_id = (request.get_json(silent=True) or {}).get("to_therapist_id")
    if not to_id:
        return jsonify(error="to_therapist_id is required"), 400
    try:
        g.client.rpc(
            "transfer_patient", {"p_patient": patient_id, "p_from": g.profile["id"], "p_to": to_id}
        ).execute()
    except Exception as exc:
        msg = getattr(exc, "message", None) or str(exc)
        if "transfer_error:" in msg:
            return jsonify(error=msg.split("transfer_error:", 1)[1].strip().rstrip("'\"}")), 400
        return jsonify(error="Couldn't transfer that patient. Please try again."), 500

    target = g.client.table("users").select("first_name, last_name, full_name").eq("id", to_id).limit(1).execute().data
    target_name = display_name(target[0]) if target else "a colleague"
    _push_to(
        patient_id,
        title="Your care team changed",
        body=f"{target_name} is now guiding your home exercise program.",
        data={"type": "care_transfer"},
    )
    return jsonify(ok=True, to_therapist_id=to_id)


# ---------- patient ----------
def _my_invitations():
    """Unexpired pending invitations addressed to the signed-in, email-confirmed patient."""
    email = (g.auth_user.email or "").lower()
    rows = g.client.table("invitations").select("*").eq("email", email).eq("status", "pending").execute().data
    return [r for r in rows if not _is_expired(r)]


def _accept(inv: dict):
    c, me = g.client, g.auth_user
    # Compare-and-set so two taps / two devices can't both accept.
    claimed = (
        c.table("invitations")
        .update({"status": "accepted", "responded_at": _iso(_now()), "patient_id": me.id})
        .eq("id", inv["id"]).eq("status", "pending").execute().data
    )
    if not claimed:
        return jsonify(error=BAD_CODE), 404
    try:
        c.table("care_links").insert({"therapist_id": inv["therapist_id"], "patient_id": me.id}).execute()
    except Exception:
        already = (
            c.table("care_links").select("id").eq("therapist_id", inv["therapist_id"]).eq("patient_id", me.id)
            .eq("status", "active").limit(1).execute().data
        )
        if not already:  # a real failure, not a duplicate: undo the claim so they can retry
            c.table("invitations").update({"status": "pending", "responded_at": None}).eq("id", inv["id"]).execute()
            return jsonify(error="Couldn't link you right now. Please try again."), 500
    t = c.table("users").select("first_name, last_name, full_name").eq("id", inv["therapist_id"]).limit(1).execute().data
    return jsonify(linked=True, therapist_name=display_name(t[0]) if t else "your therapist")


def _guard_confirmed():
    if not email_confirmed(g.auth_user):
        return jsonify(
            error="Please confirm your email first. Check your inbox for our confirmation link, then try again.",
            code="email_not_confirmed",
        ), 403
    return None


@bp.get("/patient/invitations")
@require_role("patient")
def my_invitations():
    if not email_confirmed(g.auth_user):
        return jsonify(invitations=[], email_confirmed=False)
    invs = _my_invitations()
    names = {}
    for tid in {i["therapist_id"] for i in invs}:
        t = g.client.table("users").select("first_name, last_name, full_name").eq("id", tid).limit(1).execute().data
        names[tid] = display_name(t[0]) if t else "A therapist"
    return jsonify(
        email_confirmed=True,
        invitations=[
            {"id": i["id"], "therapist_name": names[i["therapist_id"]], "created_at": i.get("created_at"),
             "expires_at": i.get("expires_at")}
            for i in invs
        ],
    )


@bp.post("/patient/invitations/accept")
@require_role("patient")
def accept_by_code():
    blocked = _guard_confirmed()
    if blocked:
        return blocked
    code = _normalize_code((request.get_json(silent=True) or {}).get("code"))
    if len(code) != CODE_LENGTH:
        return jsonify(error=BAD_CODE), 404
    rows = g.client.table("invitations").select("*").eq("code", code).limit(1).execute().data
    inv = rows[0] if rows else None
    if (not inv or inv["status"] != "pending" or _is_expired(inv)
            or inv["email"] != (g.auth_user.email or "").lower()):
        return jsonify(error=BAD_CODE), 404
    return _accept(inv)


def _my_invitation_by_id(inv_id: str):
    rows = g.client.table("invitations").select("*").eq("id", inv_id).limit(1).execute().data
    inv = rows[0] if rows else None
    if (not inv or inv["status"] != "pending" or _is_expired(inv)
            or inv["email"] != (g.auth_user.email or "").lower()):
        return None
    return inv


@bp.post("/patient/invitations/<inv_id>/accept")
@require_role("patient")
def accept_invitation(inv_id):
    blocked = _guard_confirmed()
    if blocked:
        return blocked
    inv = _my_invitation_by_id(inv_id)
    return _accept(inv) if inv else (jsonify(error=BAD_CODE), 404)


@bp.post("/patient/invitations/<inv_id>/decline")
@require_role("patient")
def decline_invitation(inv_id):
    inv = _my_invitation_by_id(inv_id)
    if not inv:
        return jsonify(error=BAD_CODE), 404
    g.client.table("invitations").update(
        {"status": "declined", "responded_at": _iso(_now()), "patient_id": g.auth_user.id}
    ).eq("id", inv_id).eq("status", "pending").execute()
    return jsonify(declined=True)


@bp.post("/patient/push-token")
@require_role("patient")
def register_push_token():
    body = request.get_json(silent=True) or {}
    token = (body.get("token") or "").strip()
    if not re.match(r"^Expo(nent)?PushToken\[.+\]$", token):
        return jsonify(error="invalid push token"), 400
    g.client.table("device_push_tokens").upsert(
        {"user_id": g.auth_user.id, "token": token, "platform": (body.get("platform") or "")[:20] or None,
         "updated_at": _iso(_now())},
        on_conflict="token",
    ).execute()
    return jsonify(ok=True)

"""Therapist side of a patient's program (Flow 5 roster, Flow 6 program editor — F09, F10, F12).

All need `Authorization: Bearer <therapist access token>` and only work for patients on the signed-in
therapist's caseload (an active care_links row). Anything else is a 404, so a therapist can't probe
for other clinics' patients.

  GET /therapist/patients?date=YYYY-MM-DD           roster: each patient + program summary, adherence,
                                                    last session and a status flag
  GET /therapist/patients/<id>/program?date=…       patient detail: my prescribed exercises, other
                                                    doctors' exercises (read-only), stats, recent sessions
  PUT /therapist/patients/<id>/program              save my program for this patient (replaces it)
      {"start_date": "YYYY-MM-DD",                  the portal's local "today"; changes apply from then
       "items": [{"exercise_id", "sets", "reps", "days_of_week": [0..6]}, ...]}   (0 = Sunday)

Saving rules (Flow 6):
  * an empty program is rejected; each exercise at most once; sets 1–10, reps 1–50; ≥1 day per exercise
  * plans are matched by exercise: a kept exercise is updated in place, so its history and streak stay
    attached; a removed one gets end_date = the day before start_date (kept for history, no longer due);
    a new one starts on start_date
  * only MY plans change — another therapist's prescriptions for the same patient are never touched
  * the patient gets a best-effort push ("Your program was updated")
"""
from datetime import date, timedelta

from flask import Blueprint, current_app, g, jsonify, request

from .. import schedule as sch
from ..auth import display_name, require_role
from ..notify import send_push
from .program import EXERCISE_COLUMNS, _exercise_public, _local_date

bp = Blueprint("care", __name__)

MAX_SETS, MAX_REPS, MAX_ITEMS = 10, 50, 20
RECENT_SESSIONS = 15
LOG_COLUMNS = (
    "id, plan_id, exercise_id, local_date, completed, completed_at, reps_completed, sets_completed, "
    "target_sets, target_reps, avg_rom_degrees, form_score, duration_seconds"
)
NOT_FOUND = "That patient isn't on your caseload."


# ---------- helpers ----------
def _linked_patient_ids(client, therapist_id: str) -> list[str]:
    rows = (
        client.table("care_links").select("patient_id")
        .eq("therapist_id", therapist_id).eq("status", "active").execute().data
        or []
    )
    return [r["patient_id"] for r in rows]


def _is_linked(client, therapist_id: str, patient_id: str) -> bool:
    rows = (
        client.table("care_links").select("id")
        .eq("therapist_id", therapist_id).eq("patient_id", patient_id).eq("status", "active")
        .limit(1).execute().data
    )
    return bool(rows)


def _patient_name(u: dict) -> str:
    name = " ".join(p for p in (u.get("first_name"), u.get("last_name")) if p)
    return name or u.get("full_name") or u.get("email") or "Patient"


def _is_current(plan: dict, day: date) -> bool:
    """Still part of the program (not ended, or ending today or later)."""
    return sch.effective_status(plan, day) != "ended"


def _last_log(logs: list[dict]) -> dict | None:
    return max(logs, key=lambda l: (str(l.get("local_date") or ""), str(l.get("completed_at") or "")), default=None)


def _roster_status(plans: list[dict], logs: list[dict], day: date) -> str:
    """on-track | missed | none — the StatusPill values in admin-web.

    missed  = a scheduled day in the last 7 (not counting today) wasn't completed
    none    = nothing prescribed yet, or prescribed but no session logged yet and nothing missed
    """
    if not plans:
        return "none"
    by_day: dict[date, list[dict]] = {}
    for l in logs:
        d = sch._as_date(l.get("local_date"))
        if d:
            by_day.setdefault(d, []).append(l)
    for back in range(1, 8):
        s = sch.day_state(plans, by_day, day - timedelta(days=back))
        if s["scheduled"] and not s["complete"]:
            return "missed"
    return "on-track" if logs else "none"


def _plan_public(plan: dict, exercises: dict) -> dict:
    ex = exercises.get(plan["exercise_id"]) or {"id": plan["exercise_id"], "name": "Exercise"}
    return {
        "plan_id": plan["id"],
        "sets": plan["sets"],
        "reps": plan["reps"],
        "days_of_week": sorted(plan.get("days_of_week") or []),
        "start_date": str(plan.get("start_date") or "")[:10] or None,
        "status": plan.get("status") or "active",
        "sort_order": plan.get("sort_order") or 0,
        "exercise": _exercise_public(ex),
    }


def _exercises_by_id(client, ids) -> dict:
    ids = sorted(set(ids))
    if not ids:
        return {}
    return {e["id"]: e for e in client.table("exercises").select(EXERCISE_COLUMNS).in_("id", ids).execute().data or []}


def _program_payload(client, therapist_id: str, patient_id: str, day: date) -> dict:
    patient = (
        client.table("users").select("id, first_name, last_name, full_name, email")
        .eq("id", patient_id).limit(1).execute().data
        or [{"id": patient_id}]
    )[0]
    plans = client.table("plans").select("*").eq("patient_id", patient_id).execute().data or []
    since = day - timedelta(days=sch.STREAK_LOOKBACK_DAYS)
    logs = (
        client.table("exercise_logs").select(LOG_COLUMNS)
        .eq("patient_id", patient_id).gte("local_date", since.isoformat()).execute().data
        or []
    )
    exercises = _exercises_by_id(client, [p["exercise_id"] for p in plans] + [l["exercise_id"] for l in logs])

    mine = sorted(
        (p for p in plans if p["therapist_id"] == therapist_id and _is_current(p, day)),
        key=lambda p: (p.get("sort_order") or 0, str(p.get("created_at") or "")),
    )
    others = [p for p in plans if p["therapist_id"] != therapist_id and _is_current(p, day)]
    other_names = {}
    if others:
        ids = sorted({p["therapist_id"] for p in others})
        for t in client.table("users").select("id, first_name, last_name, full_name").in_("id", ids).execute().data or []:
            other_names[t["id"]] = display_name(t)

    recent = sorted(logs, key=lambda l: (str(l.get("local_date") or ""), str(l.get("completed_at") or "")), reverse=True)
    last = recent[0] if recent else None
    return {
        "date": day.isoformat(),
        "patient": {"id": patient["id"], "name": _patient_name(patient), "email": patient.get("email")},
        "program": [_plan_public(p, exercises) for p in mine],
        "other_programs": [
            {**_plan_public(p, exercises), "therapist_name": other_names.get(p["therapist_id"], "Another clinician")}
            for p in others
        ],
        "stats": {
            "adherence_pct": sch.adherence_pct(plans, logs, day),
            "streak": sch.streak(plans, logs, day),
            "rom_change_deg": sch.rom_change(logs, day),
            "last_session_date": str(last["local_date"])[:10] if last else None,
            "status": _roster_status(plans, logs, day),
        },
        "today": [_plan_public(p, exercises) for p in sch.due_plans(plans, day)],
        "recent_sessions": [
            {
                "id": l["id"],
                "local_date": str(l.get("local_date") or "")[:10],
                "completed_at": l.get("completed_at"),
                "exercise_name": (exercises.get(l["exercise_id"]) or {}).get("name", "Exercise"),
                "reps_completed": l.get("reps_completed"),
                "target_reps_total": (l.get("target_sets") or 0) * (l.get("target_reps") or 0) or None,
                "avg_rom_degrees": l.get("avg_rom_degrees"),
                "duration_seconds": l.get("duration_seconds"),
                "completed": l.get("completed", True),
            }
            for l in recent[:RECENT_SESSIONS]
        ],
    }


def _validate_items(raw) -> tuple[list[dict] | None, str | None]:
    if not isinstance(raw, list) or not raw:
        return None, "Add at least one exercise before saving the program."
    if len(raw) > MAX_ITEMS:
        return None, f"A program can have at most {MAX_ITEMS} exercises."
    items, seen = [], set()
    for i, it in enumerate(raw):
        if not isinstance(it, dict) or not isinstance(it.get("exercise_id"), str) or not it["exercise_id"]:
            return None, f"Exercise #{i + 1} is missing."
        if it["exercise_id"] in seen:
            return None, "Each exercise can only be in the program once."
        seen.add(it["exercise_id"])
        sets, reps, days = it.get("sets"), it.get("reps"), it.get("days_of_week")
        if isinstance(sets, bool) or not isinstance(sets, int) or not 1 <= sets <= MAX_SETS:
            return None, f"Sets must be between 1 and {MAX_SETS}."
        if isinstance(reps, bool) or not isinstance(reps, int) or not 1 <= reps <= MAX_REPS:
            return None, f"Reps must be between 1 and {MAX_REPS}."
        if (
            not isinstance(days, list) or not days
            or any(isinstance(d, bool) or not isinstance(d, int) or not 0 <= d <= 6 for d in days)
        ):
            return None, "Pick at least one day of the week for every exercise."
        items.append({"exercise_id": it["exercise_id"], "sets": sets, "reps": reps, "days_of_week": sorted(set(days))})
    return items, None


# ---------- roster ----------
@bp.get("/therapist/patients")
@require_role("therapist")
def roster():
    day = _local_date(request.args.get("date"))
    if day is None:
        return jsonify(error="date must be YYYY-MM-DD"), 400
    client, me = g.client, g.profile["id"]
    ids = _linked_patient_ids(client, me)
    if not ids:
        return jsonify(date=day.isoformat(), patients=[])

    users = client.table("users").select("id, first_name, last_name, full_name, email").in_("id", ids).execute().data or []
    plans = client.table("plans").select("*").in_("patient_id", ids).execute().data or []
    since = day - timedelta(days=sch.ADHERENCE_WINDOW_DAYS)
    logs = (
        client.table("exercise_logs").select(LOG_COLUMNS + ", patient_id")
        .in_("patient_id", ids).gte("local_date", since.isoformat()).execute().data
        or []
    )
    exercises = _exercises_by_id(client, [p["exercise_id"] for p in plans])

    out = []
    for u in users:
        p_plans = [p for p in plans if p["patient_id"] == u["id"]]
        p_logs = [l for l in logs if l.get("patient_id") == u["id"]]
        mine = [p for p in p_plans if p["therapist_id"] == me and _is_current(p, day)]
        areas = sorted({(exercises.get(p["exercise_id"]) or {}).get("body_area") or "" for p in mine} - {""})
        days = sorted({d for p in mine for d in (p.get("days_of_week") or [])})
        last = _last_log(p_logs)
        out.append({
            "id": u["id"],
            "first_name": u.get("first_name"),
            "last_name": u.get("last_name"),
            "full_name": u.get("full_name"),
            "email": u.get("email"),
            "program": {"exercise_count": len(mine), "body_areas": areas, "days_of_week": days},
            "adherence_pct": sch.adherence_pct(p_plans, p_logs, day),
            "last_session_date": str(last["local_date"])[:10] if last else None,
            "status": _roster_status(p_plans, p_logs, day),
        })
    out.sort(key=lambda r: (r.get("first_name") or r.get("full_name") or r.get("email") or "").lower())
    return jsonify(date=day.isoformat(), patients=out)


# ---------- program (Flow 6) ----------
@bp.get("/therapist/patients/<patient_id>/program")
@require_role("therapist")
def get_program(patient_id):
    day = _local_date(request.args.get("date"))
    if day is None:
        return jsonify(error="date must be YYYY-MM-DD"), 400
    if not _is_linked(g.client, g.profile["id"], patient_id):
        return jsonify(error=NOT_FOUND), 404
    return jsonify(_program_payload(g.client, g.profile["id"], patient_id, day))


@bp.put("/therapist/patients/<patient_id>/program")
@require_role("therapist")
def save_program(patient_id):
    client, me = g.client, g.profile["id"]
    if not _is_linked(client, me, patient_id):
        return jsonify(error=NOT_FOUND), 404
    body = request.get_json(silent=True) or {}
    start = _local_date(body.get("start_date"))
    if start is None:
        return jsonify(error="start_date must be YYYY-MM-DD"), 400
    items, err = _validate_items(body.get("items"))
    if err:
        return jsonify(error=err), 400

    found = _exercises_by_id(client, [i["exercise_id"] for i in items])
    if any(i["exercise_id"] not in found or found[i["exercise_id"]].get("active") is False for i in items):
        return jsonify(error="One of those exercises isn't in the library."), 400

    plans = client.table("plans").select("*").eq("patient_id", patient_id).eq("therapist_id", me).execute().data or []
    current = {p["exercise_id"]: p for p in plans if _is_current(p, start)}
    wanted = {i["exercise_id"] for i in items}

    for order, it in enumerate(items):
        fields = {"sets": it["sets"], "reps": it["reps"], "days_of_week": it["days_of_week"], "sort_order": order}
        existing = current.get(it["exercise_id"])
        if existing:
            client.table("plans").update({**fields, "status": "active", "end_date": None}).eq("id", existing["id"]).execute()
        else:
            client.table("plans").insert({
                **fields,
                "patient_id": patient_id,
                "therapist_id": me,
                "exercise_id": it["exercise_id"],
                "start_date": start.isoformat(),
                "status": "active",
            }).execute()

    for ex_id, p in current.items():
        if ex_id not in wanted:
            # Ended, not deleted: past sessions keep their plan and the streak/adherence history stays right.
            client.table("plans").update({"end_date": (start - timedelta(days=1)).isoformat()}).eq("id", p["id"]).execute()

    _notify_patient(client, patient_id)
    return jsonify(_program_payload(client, me, patient_id, start))


def _notify_patient(client, patient_id: str) -> None:
    try:
        rows = client.table("device_push_tokens").select("token").eq("user_id", patient_id).execute().data or []
        tokens = [r["token"] for r in rows]
        if tokens:
            send_push(
                current_app.config, tokens,
                title="Your exercise program was updated",
                body=f"{display_name(g.profile)} updated your exercises. Open Kinetic to see today's plan.",
                data={"type": "program_updated"},
            )
    except Exception:  # a push failure must never fail the save
        current_app.logger.exception("program push failed")

"""Exercise library, scheduled delivery and session logging (tasks 1.7, 2.1–2.4, 3.2).

Library (any signed-in patient or therapist):
  GET  /exercises                     ?body_area=Knee&q=bridge — the active library, A→Z
  GET  /exercises/body-areas          distinct body areas with counts (for filter chips)
  GET  /therapist/exercises           same as /exercises, under the CORS-enabled portal prefix

Patient (iPhone app):
  GET  /patient/today?date=YYYY-MM-DD the day's due exercises + dashboard numbers (F03/F04). `date` is
                                      the PHONE's local date; the server falls back to its own UTC date.
  GET  /patient/schedule?date=…       just the exercises due that day (task 2.2's contract)
  POST /patient/sessions              save a finished (or ended-early) session to exercise_logs
  POST /patient/push-test             task 1.7: send a test push to my registered devices
"""
from datetime import date, datetime, timedelta, timezone

from flask import Blueprint, current_app, g, jsonify, request

from .. import schedule as sch
from ..auth import display_name, require_role
from ..notify import send_push

bp = Blueprint("program", __name__)

EXERCISE_COLUMNS = (
    "id, slug, name, body_area, description, instructions, positioning_tip, sensor_mode, diagram, "
    "default_sets, default_reps, target_angle_deg, return_angle_deg, target_rotation_deg, est_minutes, "
    "difficulty, equipment, tags, accent_color, active"
)
MAX_SESSION_SECONDS = 4 * 60 * 60


# ---------- helpers ----------
def _local_date(raw) -> date | None:
    if raw is None or raw == "":
        return datetime.now(timezone.utc).date()
    try:
        return date.fromisoformat(str(raw))
    except ValueError:
        return None


def _exercise_public(ex: dict) -> dict:
    return {k: ex.get(k) for k in [c.strip() for c in EXERCISE_COLUMNS.split(",")] if k != "active"}


def _search_library(client, body_area: str | None, q: str | None) -> list[dict]:
    rows = client.table("exercises").select(EXERCISE_COLUMNS).eq("active", True).execute().data or []
    if body_area:
        rows = [r for r in rows if (r.get("body_area") or "").lower() == body_area.strip().lower()]
    if q:
        needle = q.strip().lower()
        rows = [
            r for r in rows
            if needle in " ".join(
                [r.get("name") or "", r.get("body_area") or "", r.get("description") or "", *(r.get("tags") or [])]
            ).lower()
        ]
    return sorted(rows, key=lambda r: (r.get("name") or "").lower())


def _load_program(client, patient_id: str, since: date):
    plans = client.table("plans").select("*").eq("patient_id", patient_id).execute().data or []
    logs = (
        client.table("exercise_logs")
        .select("id, plan_id, exercise_id, local_date, completed, completed_at, reps_completed, avg_rom_degrees")
        .eq("patient_id", patient_id)
        .gte("local_date", since.isoformat())
        .execute()
        .data
        or []
    )
    ex_ids = sorted({p["exercise_id"] for p in plans})
    exercises = {}
    if ex_ids:
        for e in client.table("exercises").select(EXERCISE_COLUMNS).in_("id", ex_ids).execute().data or []:
            exercises[e["id"]] = e
    th_ids = sorted({p["therapist_id"] for p in plans})
    therapists = {}
    if th_ids:
        for t in client.table("users").select("id, first_name, last_name, full_name").in_("id", th_ids).execute().data or []:
            therapists[t["id"]] = display_name(t)
    return plans, logs, exercises, therapists


def _item(plan: dict, exercises: dict, therapists: dict, done: set, attempted: set) -> dict:
    ex = exercises.get(plan["exercise_id"]) or {"id": plan["exercise_id"], "name": "Exercise"}
    return {
        "plan_id": plan["id"],
        "sets": plan["sets"],
        "reps": plan["reps"],
        "therapist_id": plan["therapist_id"],
        "therapist_name": therapists.get(plan["therapist_id"], "Your care team"),
        "done": plan["id"] in done,
        "attempted": plan["id"] in attempted,
        "exercise": _exercise_public(ex),
    }


# ---------- library ----------
@bp.get("/exercises")
@bp.get("/therapist/exercises")
@require_role(("patient", "therapist"))
def list_exercises():
    rows = _search_library(g.client, request.args.get("body_area"), request.args.get("q"))
    return jsonify(exercises=[_exercise_public(r) for r in rows], count=len(rows))


@bp.get("/exercises/body-areas")
@bp.get("/therapist/exercises/body-areas")
@require_role(("patient", "therapist"))
def list_body_areas():
    counts: dict[str, int] = {}
    for r in _search_library(g.client, None, None):
        counts[r["body_area"]] = counts.get(r["body_area"], 0) + 1
    return jsonify(body_areas=[{"name": k, "count": v} for k, v in sorted(counts.items())])


# ---------- scheduled delivery ----------
@bp.get("/patient/schedule")
@require_role("patient")
def patient_schedule():
    day = _local_date(request.args.get("date"))
    if day is None:
        return jsonify(error="date must be YYYY-MM-DD"), 400
    plans, logs, exercises, therapists = _load_program(g.client, g.profile["id"], day)
    day_logs = [l for l in logs if str(l.get("local_date"))[:10] == day.isoformat()]
    done, attempted = sch.done_plan_ids(day_logs), sch.attempted_plan_ids(day_logs)
    items = [_item(p, exercises, therapists, done, attempted) for p in sch.due_plans(plans, day)]
    return jsonify(date=day.isoformat(), exercises=items)


@bp.get("/patient/today")
@require_role("patient")
def patient_today():
    day = _local_date(request.args.get("date"))
    if day is None:
        return jsonify(error="date must be YYYY-MM-DD"), 400
    since = day - timedelta(days=sch.STREAK_LOOKBACK_DAYS)
    plans, logs, exercises, therapists = _load_program(g.client, g.profile["id"], since)

    day_logs = [l for l in logs if str(l.get("local_date"))[:10] == day.isoformat()]
    done, attempted = sch.done_plan_ids(day_logs), sch.attempted_plan_ids(day_logs)
    due = sch.due_plans(plans, day)
    items = [_item(p, exercises, therapists, done, attempted) for p in due]

    # "Up next": the next scheduled day after today, so a rest day still shows what's coming.
    up_next = None
    for ahead in range(1, 8):
        nxt = sch.due_plans(plans, day + timedelta(days=ahead))
        if nxt:
            up_next = {
                "date": (day + timedelta(days=ahead)).isoformat(),
                "exercises": [_item(p, exercises, therapists, set(), set()) for p in nxt],
            }
            break

    current_streak = sch.streak(plans, logs, day)
    minutes = sum((i["exercise"].get("est_minutes") or 5) for i in items if not i["done"])
    return jsonify(
        date=day.isoformat(),
        status=sch.today_status(plans, due, done, day),
        exercises=items,
        remaining_minutes=minutes,
        up_next=up_next,
        week=sch.week_strip(plans, logs, day),
        streak=current_streak,
        next_milestone=sch.next_milestone(current_streak),
        stats={
            "adherence_pct": sch.adherence_pct(plans, logs, day),
            "rom_change_deg": sch.rom_change(logs, day),
        },
    )


# ---------- session logging ----------
def _int(body, key, lo=0, hi=10_000):
    v = body.get(key)
    if v is None:
        return None
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not lo <= v <= hi:
        raise ValueError(key)
    return int(v)


def _num(body, key, lo=0, hi=1000):
    v = body.get(key)
    if v is None:
        return None
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not lo <= v <= hi:
        raise ValueError(key)
    return round(float(v), 2)


@bp.post("/patient/sessions")
@require_role("patient")
def save_session():
    body = request.get_json(silent=True) or {}
    uid = g.profile["id"]
    day = _local_date(body.get("local_date"))
    if day is None:
        return jsonify(error="local_date must be YYYY-MM-DD"), 400

    plan_id, exercise_id = body.get("plan_id"), body.get("exercise_id")
    if plan_id:
        rows = g.client.table("plans").select("id, patient_id, exercise_id").eq("id", plan_id).limit(1).execute().data
        if not rows or rows[0]["patient_id"] != uid:
            return jsonify(error="That exercise isn't part of your program."), 404
        exercise_id = rows[0]["exercise_id"]
    elif body.get("exercise_slug"):
        rows = g.client.table("exercises").select("id").eq("slug", body["exercise_slug"]).limit(1).execute().data
        if not rows:
            return jsonify(error="Unknown exercise."), 404
        exercise_id = rows[0]["id"]
    if not exercise_id:
        return jsonify(error="plan_id or exercise_slug is required"), 400

    try:
        row = {
            "patient_id": uid,
            "plan_id": plan_id or None,
            "exercise_id": exercise_id,
            "local_date": day.isoformat(),
            "reps_completed": _int(body, "reps_completed"),
            "sets_completed": _int(body, "sets_completed", hi=100),
            "target_sets": _int(body, "target_sets", lo=1, hi=100),
            "target_reps": _int(body, "target_reps", lo=1, hi=1000),
            "duration_seconds": _int(body, "duration_seconds", hi=MAX_SESSION_SECONDS),
            "avg_rom_degrees": _num(body, "avg_rom_degrees", hi=360),
            "form_score": _num(body, "form_score", hi=100),
            "completed": bool(body.get("completed", True)),
            "summary": body.get("summary") if isinstance(body.get("summary"), dict) else {},
        }
    except ValueError as bad:
        return jsonify(error=f"{bad} is out of range"), 400

    saved = g.client.table("exercise_logs").insert(row).execute().data[0]
    return jsonify(session={"id": saved["id"], "local_date": row["local_date"], "completed": row["completed"]}), 201


# ---------- task 1.7: test push ----------
@bp.post("/patient/push-test")
@require_role("patient")
def push_test():
    rows = g.client.table("device_push_tokens").select("token").eq("user_id", g.profile["id"]).execute().data or []
    tokens = [r["token"] for r in rows]
    if not tokens:
        return jsonify(sent=False, devices=0, error="This account has no registered device yet. Open the app on your iPhone and allow notifications."), 409
    sent = send_push(
        current_app.config, tokens,
        title="Kinetic test notification",
        body="Push notifications are working. You'll get exercise reminders here.",
        data={"type": "test"},
    )
    return jsonify(sent=sent, devices=len(tokens)), (200 if sent else 502)

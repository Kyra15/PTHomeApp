"""Scheduled exercise delivery (task 2.2 / F04) + the dashboard numbers built on it (task 2.1 / F03).

Pure functions over plain dicts, so they can be tested without a database. A *plan* is one exercise
assigned to one patient on a weekly schedule (see public.plans). A *log* is one row of
public.exercise_logs, keyed to the patient's own calendar day (`local_date`) so "today" follows the
phone's time zone rather than the server's.

Rules (from docs/features.md):
  * A plan is due on day D when it is active, D is on/after start_date, D is on/before end_date (if
    set), and D's weekday is in days_of_week (0 = Sunday … 6 = Saturday, like JavaScript).
  * An exercise is "done" for D once a completed log for that plan exists with local_date = D.
    An ended-early session counts as attempted (partial) but not done.
  * A scheduled day is complete when every plan due that day is done. Streak = consecutive scheduled
    days that were complete; days with nothing scheduled neither extend nor break it, and today only
    breaks it once today is over.
  * Schedule edits apply from the plan's start_date forward; MVP limitation: an edited days_of_week
    is applied to past days too (there is no plan history table yet), which only affects history views.
"""
from __future__ import annotations

from datetime import date, timedelta

STREAK_LOOKBACK_DAYS = 120
ADHERENCE_WINDOW_DAYS = 30
STREAK_MILESTONES = (3, 7, 14, 30, 60, 100)


def js_weekday(d: date) -> int:
    """0 = Sunday … 6 = Saturday (Python's weekday() is 0 = Monday)."""
    return (d.weekday() + 1) % 7


def _as_date(value) -> date | None:
    if value is None or isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def plan_status(plan: dict) -> str:
    return plan.get("status") or "active"


def is_due(plan: dict, d: date) -> bool:
    if plan_status(plan) != "active":
        return False
    start = _as_date(plan.get("start_date"))
    end = _as_date(plan.get("end_date"))
    if start and d < start:
        return False
    if end and d > end:
        return False
    return js_weekday(d) in (plan.get("days_of_week") or [])


def due_plans(plans: list[dict], d: date) -> list[dict]:
    due = [p for p in plans if is_due(p, d)]
    return sorted(due, key=lambda p: (p.get("sort_order") or 0, str(p.get("created_at") or ""), p["id"]))


def _logs_by_day(logs: list[dict]) -> dict[date, list[dict]]:
    out: dict[date, list[dict]] = {}
    for log in logs:
        day = _as_date(log.get("local_date"))
        if day:
            out.setdefault(day, []).append(log)
    return out


def done_plan_ids(day_logs: list[dict]) -> set[str]:
    return {l["plan_id"] for l in day_logs if l.get("plan_id") and l.get("completed", True)}


def attempted_plan_ids(day_logs: list[dict]) -> set[str]:
    return {l["plan_id"] for l in day_logs if l.get("plan_id")}


def day_state(plans: list[dict], by_day: dict[date, list[dict]], d: date) -> dict:
    due = due_plans(plans, d)
    done = done_plan_ids(by_day.get(d, []))
    n_done = sum(1 for p in due if p["id"] in done)
    return {
        "date": d.isoformat(),
        "scheduled": len(due),
        "done": n_done,
        "complete": bool(due) and n_done == len(due),
    }


def streak(plans: list[dict], logs: list[dict], today: date) -> int:
    by_day = _logs_by_day(logs)
    count = 0
    for back in range(STREAK_LOOKBACK_DAYS):
        d = today - timedelta(days=back)
        s = day_state(plans, by_day, d)
        if s["scheduled"] == 0:
            continue
        if s["complete"]:
            count += 1
        elif d == today:
            continue  # today isn't over yet
        else:
            break
    return count


def adherence_pct(plans: list[dict], logs: list[dict], today: date, window: int = ADHERENCE_WINDOW_DAYS) -> int | None:
    """% of scheduled exercises done over the last `window` days. Today counts only once it's done,
    so the number doesn't drop every morning. None when nothing has been scheduled yet."""
    by_day = _logs_by_day(logs)
    scheduled = done = 0
    for back in range(window):
        d = today - timedelta(days=back)
        s = day_state(plans, by_day, d)
        if d == today and not s["complete"]:
            continue
        scheduled += s["scheduled"]
        done += s["done"]
    return round(100 * done / scheduled) if scheduled else None


def rom_change(logs: list[dict], today: date, window: int = ADHERENCE_WINDOW_DAYS) -> float | None:
    """Average change in range of motion over the window: for each exercise with ≥2 measured sessions,
    latest avg ROM minus earliest, averaged across exercises. None without enough data."""
    since = today - timedelta(days=window - 1)
    per_ex: dict[str, list[tuple[str, float]]] = {}
    for l in logs:
        day = _as_date(l.get("local_date"))
        rom = l.get("avg_rom_degrees")
        if day is None or rom is None or day < since or day > today:
            continue
        per_ex.setdefault(str(l.get("exercise_id")), []).append((f"{day.isoformat()} {l.get('completed_at') or ''}", float(rom)))
    deltas = []
    for rows in per_ex.values():
        if len(rows) >= 2:
            rows.sort()
            deltas.append(rows[-1][1] - rows[0][1])
    return round(sum(deltas) / len(deltas), 1) if deltas else None


def week_strip(plans: list[dict], logs: list[dict], today: date) -> list[dict]:
    """Monday→Sunday of the week containing `today`, for the dashboard's streak row."""
    by_day = _logs_by_day(logs)
    monday = today - timedelta(days=today.weekday())
    out = []
    for i in range(7):
        d = monday + timedelta(days=i)
        s = day_state(plans, by_day, d)
        if d > today:
            state = "upcoming" if s["scheduled"] else "rest"
        elif s["scheduled"] == 0:
            state = "rest"
        elif s["complete"]:
            state = "done"
        elif d == today:
            state = "today"
        else:
            state = "missed"
        out.append({**s, "state": state, "is_today": d == today})
    return out


def next_milestone(current: int) -> int | None:
    return next((m for m in STREAK_MILESTONES if m > current), None)


def effective_status(plan: dict, d: date) -> str:
    """Like plan_status, but an active plan whose end_date has passed counts as ended."""
    end = _as_date(plan.get("end_date"))
    status = plan_status(plan)
    return "ended" if status == "active" and end and d > end else status


def today_status(plans: list[dict], due: list[dict], done: set[str], d: date | None = None) -> str:
    """no_program | paused | ended | rest_day | due | complete"""
    if not plans:
        return "no_program"
    if not due:
        statuses = {effective_status(p, d) if d else plan_status(p) for p in plans}
        if "active" not in statuses:
            return "paused" if "paused" in statuses else "ended"
        return "rest_day"
    return "complete" if all(p["id"] in done for p in due) else "due"

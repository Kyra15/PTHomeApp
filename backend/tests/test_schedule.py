"""Task 2.2 definition of done: the right exercise list for a patient/day across 3 test schedules,
plus the streak / adherence / week-strip numbers the dashboard (2.1) shows."""
from datetime import date

from app import schedule as sch

# Oct 2026: Mon 26, Tue 27, Wed 28, Thu 29, Fri 30, Sat 31; Sun Nov 1
MON, TUE, WED, THU, FRI, SAT = (date(2026, 10, d) for d in (26, 27, 28, 29, 30, 31))
SUN = date(2026, 11, 1)


def plan(pid, days, **kw):
    return {"id": pid, "exercise_id": f"ex-{pid}", "therapist_id": "t1", "sets": 3, "reps": 10,
            "days_of_week": days, "start_date": "2026-10-01", "end_date": None, "status": "active", **kw}


def log(pid, d, completed=True, rom=None, ex=None):
    return {"plan_id": pid, "exercise_id": ex or f"ex-{pid}", "local_date": d.isoformat(),
            "completed": completed, "avg_rom_degrees": rom}


def ids(plans, d):
    return [p["id"] for p in sch.due_plans(plans, d)]


def test_weekday_convention_matches_javascript():
    assert sch.js_weekday(SUN) == 0 and sch.js_weekday(MON) == 1 and sch.js_weekday(SAT) == 6


# ---- schedule A: one exercise, Mon/Wed/Fri ----
def test_schedule_a_mwf():
    plans = [plan("a", [1, 3, 5])]
    assert ids(plans, MON) == ["a"]
    assert ids(plans, TUE) == []
    assert ids(plans, WED) == ["a"]
    assert ids(plans, SAT) == [] and ids(plans, SUN) == []


# ---- schedule B: two doctors, overlapping days, one plan starting mid-week ----
def test_schedule_b_multi_plan_with_start_date():
    plans = [
        plan("knee", [1, 2, 3, 4, 5], sort_order=0),
        plan("shoulder", [2, 4], therapist_id="t2", start_date="2026-10-29", sort_order=1),
    ]
    assert ids(plans, TUE) == ["knee"]            # shoulder hasn't started yet
    assert ids(plans, THU) == ["knee", "shoulder"]
    assert ids(plans, SAT) == []


# ---- schedule C: every day, but with an end date and a paused plan ----
def test_schedule_c_end_date_and_paused():
    plans = [
        plan("daily", [0, 1, 2, 3, 4, 5, 6], end_date="2026-10-30"),
        plan("paused", [0, 1, 2, 3, 4, 5, 6], status="paused"),
    ]
    assert ids(plans, FRI) == ["daily"]
    assert ids(plans, SAT) == []                  # ended
    assert sch.today_status(plans, sch.due_plans(plans, SAT), set(), SAT) == "paused"
    assert sch.today_status(plans[:1], [], set(), SAT) == "ended"


def test_today_status_variants():
    assert sch.today_status([], [], set()) == "no_program"
    plans = [plan("a", [1, 3, 5])]
    assert sch.today_status(plans, sch.due_plans(plans, TUE), set()) == "rest_day"
    assert sch.today_status(plans, sch.due_plans(plans, MON), set()) == "due"
    assert sch.today_status(plans, sch.due_plans(plans, MON), {"a"}) == "complete"
    assert sch.today_status([plan("a", [1], status="ended")], [], set()) == "ended"


def test_partial_session_is_attempted_not_done():
    logs = [log("a", MON, completed=False)]
    assert sch.done_plan_ids(logs) == set()
    assert sch.attempted_plan_ids(logs) == {"a"}


def test_streak_skips_rest_days_and_tolerates_unfinished_today():
    plans = [plan("a", [1, 3, 5])]
    logs = [log("a", date(2026, 10, 21)), log("a", date(2026, 10, 23)), log("a", MON), log("a", WED)]
    # Fri: today, not done yet -> doesn't break; Wed, Mon, Fri 23, Wed 21 done; Mon 19 missing breaks
    assert sch.streak(plans, logs, FRI) == 4
    assert sch.streak(plans, logs + [log("a", FRI)], FRI) == 5
    # a missed Wed breaks it
    assert sch.streak(plans, [log("a", MON), log("a", FRI)], FRI) == 1


def test_streak_needs_every_exercise_that_day():
    plans = [plan("a", [1]), plan("b", [1])]
    assert sch.streak(plans, [log("a", MON)], TUE) == 0
    assert sch.streak(plans, [log("a", MON), log("b", MON)], TUE) == 1


def test_adherence_and_rom_change():
    plans = [plan("a", [1, 3, 5])]
    logs = [log("a", MON, rom=60), log("a", WED, rom=72)]
    # window Oct 2..Oct 30 contains 13 M/W/F days before Fri (Fri itself not done -> excluded); 2 done
    pct = sch.adherence_pct(plans, logs, FRI)
    assert pct == round(100 * 2 / 12)
    assert sch.rom_change(logs, FRI) == 12.0
    assert sch.adherence_pct([], [], FRI) is None
    assert sch.rom_change([log("a", MON, rom=60)], FRI) is None


def test_week_strip_states():
    plans = [plan("a", [1, 3, 5])]
    week = sch.week_strip(plans, [log("a", MON)], THU)
    assert [w["state"] for w in week] == ["done", "rest", "missed", "rest", "upcoming", "rest", "rest"]
    week = sch.week_strip(plans, [log("a", MON)], WED)
    assert week[2]["state"] == "today" and week[2]["is_today"]


def test_next_milestone():
    assert sch.next_milestone(0) == 3 and sch.next_milestone(7) == 14 and sch.next_milestone(500) is None

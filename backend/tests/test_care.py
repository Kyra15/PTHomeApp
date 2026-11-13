"""Therapist program editor + roster summary (Flow 5/6: F09, F10, F12)."""
import json
from pathlib import Path

import pytest

from app import create_app
from app.config import Config
from tests.fakes import FakeSupabase

LIBRARY = json.loads((Path(__file__).resolve().parents[2] / "shared" / "exercise-library.json").read_text())
SLUG_TO_ID = {ex["slug"]: f"ex{i}" for i, ex in enumerate(LIBRARY["exercises"])}
TODAY = "2026-11-04"  # a Wednesday (js weekday 3)


class Cfg(Config):
    SUPABASE_URL = "https://example.supabase.co"
    SUPABASE_SECRET_KEY = "sb_secret_fake"


@pytest.fixture
def env(monkeypatch):
    db = FakeSupabase()
    monkeypatch.setattr("app.auth.supabase_ext.client", lambda _app: db)
    pushes = []
    monkeypatch.setattr("app.routes.care.send_push", lambda cfg, tokens, **kw: pushes.append((tokens, kw)) or True)
    for i, ex in enumerate(LIBRARY["exercises"]):
        db.tables.setdefault("exercises", []).append({"id": f"ex{i}", "active": True, **ex})
    t1 = db.add_user("t1", "therapist", "dr@clinic.com", first="Grace", last="Hopper")
    t2 = db.add_user("t2", "therapist", "dr2@clinic.com", first="Ada", last="Lovelace")
    p1 = db.add_user("p1", "patient", "pat@example.com", first="Alex", last="Kim")
    p2 = db.add_user("p2", "patient", "stranger@example.com", first="Sam")
    db.tables["care_links"] = [
        {"id": "cl1", "therapist_id": "t1", "patient_id": "p1", "status": "active"},
        {"id": "cl2", "therapist_id": "t2", "patient_id": "p1", "status": "active"},
    ]
    db.tables["plans"] = []
    db.tables["exercise_logs"] = []
    db.tables["device_push_tokens"] = [{"id": "d1", "user_id": "p1", "token": "ExponentPushToken[abc]"}]
    return type("Env", (), dict(db=db, client=create_app(Cfg).test_client(), t1=t1, t2=t2, p1=p1, p2=p2, pushes=pushes))


def program(*slugs_sets_reps_days):
    return {
        "start_date": TODAY,
        "items": [
            {"exercise_id": SLUG_TO_ID[s], "sets": sets, "reps": reps, "days_of_week": days}
            for s, sets, reps, days in slugs_sets_reps_days
        ],
    }


VARIED = program(
    ("shoulder-flexion", 2, 8, [1, 3, 5]),          # tilt
    ("seated-knee-extension", 3, 10, [0, 1, 2, 3, 4, 5, 6]),  # tilt
    ("shoulder-circles", 2, 5, [3]),                # rotation
    ("ankle-pumps", 2, 15, [3, 6]),                 # tilt
)


def test_requires_therapist_and_link(env):
    assert env.client.get("/therapist/patients/p1/program").status_code == 401
    assert env.client.get("/therapist/patients/p1/program", headers=env.p1).status_code == 403
    # p2 isn't on t1's caseload -> 404, both for reading and writing
    assert env.client.get("/therapist/patients/p2/program", headers=env.t1).status_code == 404
    assert env.client.put("/therapist/patients/p2/program", json=VARIED, headers=env.t1).status_code == 404


def test_empty_and_invalid_programs_are_rejected(env):
    put = lambda body: env.client.put("/therapist/patients/p1/program", json=body, headers=env.t1)
    assert "at least one exercise" in put({"start_date": TODAY, "items": []}).get_json()["error"]
    bad = [
        program(("shoulder-flexion", 0, 8, [1])),
        program(("shoulder-flexion", 2, 99, [1])),
        program(("shoulder-flexion", 2, 8, [])),
        program(("shoulder-flexion", 2, 8, [7])),
        program(("shoulder-flexion", 2, 8, [1]), ("shoulder-flexion", 3, 8, [2])),
        {"start_date": TODAY, "items": [{"exercise_id": "nope", "sets": 2, "reps": 8, "days_of_week": [1]}]},
        {"start_date": "11/04/2026", **{k: v for k, v in program(("shoulder-flexion", 2, 8, [1])).items() if k != "start_date"}},
    ]
    for body in bad:
        assert put(body).status_code == 400, body
    assert env.db.tables["plans"] == []


def test_assign_varied_program_shows_up_for_patient_today(env):
    r = env.client.put("/therapist/patients/p1/program", json=VARIED, headers=env.t1)
    assert r.status_code == 200
    body = r.get_json()
    assert [p["exercise"]["slug"] for p in body["program"]] == [
        "shoulder-flexion", "seated-knee-extension", "shoulder-circles", "ankle-pumps",
    ]
    assert {p["exercise"]["sensor_mode"] for p in body["program"]} == {"tilt", "rotation"}
    assert len(env.db.tables["plans"]) == 4 and all(p["start_date"] == TODAY for p in env.db.tables["plans"])
    assert env.pushes and env.pushes[0][0] == ["ExponentPushToken[abc]"]

    # The patient app sees all four on Wednesday, with the prescribed sets/reps and doctor's name.
    today = env.client.get(f"/patient/today?date={TODAY}", headers=env.p1).get_json()
    assert today["status"] == "due"
    assert [(i["exercise"]["slug"], i["sets"], i["reps"]) for i in today["exercises"]] == [
        ("shoulder-flexion", 2, 8), ("seated-knee-extension", 3, 10), ("shoulder-circles", 2, 5), ("ankle-pumps", 2, 15),
    ]
    assert {i["therapist_name"] for i in today["exercises"]} == {"Grace Hopper"}
    # Thursday only has the daily exercise.
    thu = env.client.get("/patient/schedule?date=2026-11-05", headers=env.p1).get_json()
    assert [i["exercise"]["slug"] for i in thu["exercises"]] == ["seated-knee-extension"]


def test_editing_keeps_history_and_only_touches_my_plans(env):
    env.client.put("/therapist/patients/p1/program", json=VARIED, headers=env.t1)
    # another doctor prescribes for the same patient
    env.client.put("/therapist/patients/p1/program", json=program(("wrist-circles", 2, 6, [3])), headers=env.t2)
    flex = next(p for p in env.db.tables["plans"] if p["exercise_id"] == SLUG_TO_ID["shoulder-flexion"])
    # the patient finished shoulder flexion today
    env.db.tables["exercise_logs"].append({
        "id": "log1", "patient_id": "p1", "plan_id": flex["id"], "exercise_id": flex["exercise_id"],
        "local_date": TODAY, "completed": True, "reps_completed": 16, "target_sets": 2, "target_reps": 8,
        "avg_rom_degrees": 74, "completed_at": f"{TODAY}T15:00:00+00:00",
    })

    # Next day: t1 changes flexion to 3x12, drops ankle pumps, adds glute bridges.
    edit = program(
        ("shoulder-flexion", 3, 12, [1, 3, 5]),
        ("seated-knee-extension", 3, 10, [0, 1, 2, 3, 4, 5, 6]),
        ("shoulder-circles", 2, 5, [3]),
        ("glute-bridge", 2, 10, [2, 4]),
    )
    edit["start_date"] = "2026-11-05"
    r = env.client.put("/therapist/patients/p1/program", json=edit, headers=env.t1).get_json()
    assert [p["exercise"]["slug"] for p in r["program"]] == ["shoulder-flexion", "seated-knee-extension", "shoulder-circles", "glute-bridge"]
    # flexion updated in place (same plan row, so today's log still counts)
    assert flex["sets"] == 3 and flex["reps"] == 12
    ankle = next(p for p in env.db.tables["plans"] if p["exercise_id"] == SLUG_TO_ID["ankle-pumps"])
    assert ankle["end_date"] == TODAY  # ended, not deleted
    # the other doctor's plan is untouched and shown read-only
    assert [o["exercise"]["slug"] for o in r["other_programs"]] == ["wrist-circles"]
    assert r["other_programs"][0]["therapist_name"] == "Ada Lovelace"
    assert r["recent_sessions"][0]["exercise_name"] == "Shoulder Flexion"
    assert r["recent_sessions"][0]["target_reps_total"] == 16

    # Wednesday the 4th still shows ankle pumps in the patient's history; Saturday the 7th no longer does.
    sat = env.client.get("/patient/schedule?date=2026-11-07", headers=env.p1).get_json()
    assert "ankle-pumps" not in [i["exercise"]["slug"] for i in sat["exercises"]]
    wed = env.client.get(f"/patient/schedule?date={TODAY}", headers=env.p1).get_json()
    assert "ankle-pumps" in [i["exercise"]["slug"] for i in wed["exercises"]]


def test_re_adding_a_removed_exercise_creates_a_fresh_plan(env):
    env.client.put("/therapist/patients/p1/program", json=program(("ankle-pumps", 2, 15, [3]), ("heel-slides", 2, 10, [3])), headers=env.t1)
    env.client.put("/therapist/patients/p1/program", json=program(("heel-slides", 2, 10, [3])), headers=env.t1)
    r = env.client.put("/therapist/patients/p1/program", json=program(("heel-slides", 2, 10, [3]), ("ankle-pumps", 1, 5, [3])), headers=env.t1)
    assert [p["exercise"]["slug"] for p in r.get_json()["program"]] == ["heel-slides", "ankle-pumps"]
    assert len([p for p in env.db.tables["plans"] if p["exercise_id"] == SLUG_TO_ID["ankle-pumps"]]) == 2


def test_roster_summary(env):
    r = env.client.get(f"/therapist/patients?date={TODAY}", headers=env.t1).get_json()
    assert [(p["id"], p["status"], p["program"]["exercise_count"]) for p in r["patients"]] == [("p1", "none", 0)]

    env.client.put("/therapist/patients/p1/program", json=VARIED, headers=env.t1)
    p = env.client.get(f"/therapist/patients?date={TODAY}", headers=env.t1).get_json()["patients"][0]
    assert p["program"] == {"exercise_count": 4, "body_areas": ["Ankle & Foot", "Knee", "Shoulder"], "days_of_week": [0, 1, 2, 3, 4, 5, 6]}
    assert p["status"] == "none" and p["last_session_date"] is None

    # Two days later, with nothing done, the patient is flagged.
    later = env.client.get("/therapist/patients?date=2026-11-06", headers=env.t1).get_json()["patients"][0]
    assert later["status"] == "missed" and later["adherence_pct"] == 0

    # t2 sees the shared patient but none of t1's exercises in "their" program column
    other = env.client.get(f"/therapist/patients?date={TODAY}", headers=env.t2).get_json()["patients"][0]
    assert other["program"]["exercise_count"] == 0
    assert env.client.get("/therapist/patients", headers=env.p1).status_code == 403


# ---------- manual activities (custom, check-off only) ----------
def manual(name, days, instructions="", exercise_id=None):
    item = {"manual": {"name": name, "instructions": instructions}, "days_of_week": days}
    if exercise_id:
        item["exercise_id"] = exercise_id
    return item


def test_manual_activity_is_private_and_checked_off(env):
    body = program(("shoulder-flexion", 2, 8, [3]))
    body["items"].append(manual("Walk 10 minutes", [1, 3, 5], "Easy pace, flat ground."))
    r = env.client.put("/therapist/patients/p1/program", json=body, headers=env.t1)
    assert r.status_code == 200, r.get_json()
    prog = r.get_json()["program"]
    walk = prog[1]
    assert walk["exercise"]["sensor_mode"] == "manual" and walk["exercise"]["name"] == "Walk 10 minutes"
    assert walk["exercise"]["description"] == "Easy pace, flat ground."
    assert (walk["sets"], walk["reps"]) == (1, 1)
    assert "created_by" not in walk["exercise"]
    row = next(e for e in env.db.tables["exercises"] if e["id"] == walk["exercise"]["id"])
    assert row["created_by"] == "t1" and row["slug"].startswith("manual-")

    # never shows up in the shared library, for anyone
    lib = env.client.get("/therapist/exercises", headers=env.t1).get_json()
    assert lib["count"] == 20 and "Walk 10 minutes" not in [e["name"] for e in lib["exercises"]]

    # roster doesn't list "Custom" as a body area
    p = env.client.get(f"/therapist/patients?date={TODAY}", headers=env.t1).get_json()["patients"][0]
    assert p["program"]["body_areas"] == ["Shoulder"] and p["program"]["exercise_count"] == 2

    # the patient sees it in today's program and checks it off
    today = env.client.get(f"/patient/today?date={TODAY}", headers=env.p1).get_json()
    item = next(i for i in today["exercises"] if i["exercise"]["sensor_mode"] == "manual")
    assert not item["done"]
    url = f"/patient/manual/{item['plan_id']}"
    assert env.client.post(url, json={"local_date": TODAY, "done": True}, headers=env.p1).status_code == 200
    assert env.client.post(url, json={"local_date": TODAY, "done": True}, headers=env.p1).status_code == 200  # idempotent
    logs = [l for l in env.db.tables["exercise_logs"] if l["plan_id"] == item["plan_id"]]
    assert len(logs) == 1 and logs[0]["completed"] and logs[0]["summary"] == {"manual": True}
    today = env.client.get(f"/patient/today?date={TODAY}", headers=env.p1).get_json()
    assert next(i for i in today["exercises"] if i["plan_id"] == item["plan_id"])["done"]

    # the clinician sees it as a checked-off session
    detail = env.client.get(f"/therapist/patients/p1/program?date={TODAY}", headers=env.t1).get_json()
    assert detail["recent_sessions"][0]["manual"] is True
    assert detail["recent_sessions"][0]["exercise_name"] == "Walk 10 minutes"

    # untick
    assert env.client.post(url, json={"local_date": TODAY, "done": False}, headers=env.p1).get_json()["done"] is False
    assert not [l for l in env.db.tables["exercise_logs"] if l["plan_id"] == item["plan_id"]]

    # a tracked exercise can't be ticked off; another patient can't tick this one
    tracked = next(i for i in today["exercises"] if i["exercise"]["sensor_mode"] != "manual")
    assert env.client.post(f"/patient/manual/{tracked['plan_id']}", json={"local_date": TODAY}, headers=env.p1).status_code == 400
    assert env.client.post(url, json={"local_date": TODAY}, headers=env.p2).status_code == 404
    assert env.client.post(url, json={"local_date": TODAY, "done": "yes"}, headers=env.p1).status_code == 400


def test_editing_a_manual_activity_keeps_its_plan(env):
    body = {"start_date": TODAY, "items": [manual("Theraband rows", [3])]}
    walk = env.client.put("/therapist/patients/p1/program", json=body, headers=env.t1).get_json()["program"][0]
    ex_id, plan_id = walk["exercise"]["id"], walk["plan_id"]

    body = {"start_date": TODAY, "items": [manual("Theraband rows — green band", [1, 3], "3 sets of 12", ex_id)]}
    edited = env.client.put("/therapist/patients/p1/program", json=body, headers=env.t1).get_json()["program"][0]
    assert edited["plan_id"] == plan_id and edited["exercise"]["id"] == ex_id
    assert edited["exercise"]["name"] == "Theraband rows — green band" and edited["days_of_week"] == [1, 3]
    assert len([e for e in env.db.tables["exercises"] if e.get("created_by")]) == 1


def test_manual_activity_validation_and_ownership(env):
    put = lambda items, h=env.t1: env.client.put("/therapist/patients/p1/program", json={"start_date": TODAY, "items": items}, headers=h)
    assert put([manual("", [3])]).status_code == 400
    assert put([manual("x" * 81, [3])]).status_code == 400
    assert put([manual("Walk", [3], "x" * 501)]).status_code == 400
    assert put([manual("Walk", [])]).status_code == 400
    assert put([{"manual": "Walk", "days_of_week": [3]}]).status_code == 400

    ex_id = put([manual("Walk", [3])]).get_json()["program"][0]["exercise"]["id"]
    # t2 can't edit t1's activity, or prescribe it as a "library" exercise
    assert put([manual("Hijack", [3], exercise_id=ex_id)], env.t2).status_code == 400
    assert put([{"exercise_id": ex_id, "sets": 1, "reps": 1, "days_of_week": [3]}], env.t2).status_code == 400
    assert next(e for e in env.db.tables["exercises"] if e["id"] == ex_id)["name"] == "Walk"

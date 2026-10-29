import json
from pathlib import Path

import pytest

from app import create_app
from app.config import Config
from tests.fakes import FakeSupabase

LIBRARY = json.loads((Path(__file__).resolve().parents[2] / "shared" / "exercise-library.json").read_text())


class Cfg(Config):
    SUPABASE_URL = "https://example.supabase.co"
    SUPABASE_SECRET_KEY = "sb_secret_fake"


@pytest.fixture
def env(monkeypatch):
    db = FakeSupabase()
    monkeypatch.setattr("app.auth.supabase_ext.client", lambda _app: db)
    pushes = []
    monkeypatch.setattr("app.routes.program.send_push", lambda cfg, tokens, **kw: pushes.append((tokens, kw)) or True)
    for i, ex in enumerate(LIBRARY["exercises"]):
        db.tables.setdefault("exercises", []).append({"id": f"ex{i}", "active": True, **ex})
    t1 = db.add_user("t1", "therapist", "dr@clinic.com", first="Grace", last="Hopper")
    p1 = db.add_user("p1", "patient", "pat@example.com", first="Alex")
    p2 = db.add_user("p2", "patient", "other@example.com")
    db.tables["plans"] = [
        {"id": "pl1", "patient_id": "p1", "therapist_id": "t1", "exercise_id": "ex0", "sets": 3, "reps": 10,
         "days_of_week": [1, 3, 5], "start_date": "2026-10-01", "end_date": None, "status": "active", "sort_order": 0},
        {"id": "pl2", "patient_id": "p1", "therapist_id": "t1", "exercise_id": "ex13", "sets": 2, "reps": 8,
         "days_of_week": [3], "start_date": "2026-10-01", "end_date": None, "status": "active", "sort_order": 1},
    ]
    db.tables["exercise_logs"] = []
    return type("Env", (), dict(db=db, client=create_app(Cfg).test_client(), t1=t1, p1=p1, p2=p2, pushes=pushes))


def test_library_has_twenty_unique_trackable_exercises():
    exs = LIBRARY["exercises"]
    assert len(exs) == 20
    assert len({e["slug"] for e in exs}) == 20
    for e in exs:
        assert e["sensor_mode"] in ("tilt", "rotation")
        if e["sensor_mode"] == "tilt":
            assert e["target_angle_deg"] > e["return_angle_deg"] > 0
        else:
            assert e["target_rotation_deg"] > 0
        assert len(e["instructions"]) >= 3 and e["positioning_tip"]


def test_library_requires_auth_and_filters(env):
    assert env.client.get("/exercises").status_code == 401
    all_ = env.client.get("/exercises", headers=env.p1).get_json()
    assert all_["count"] == 20
    names = [e["name"] for e in all_["exercises"]]
    assert names == sorted(names, key=str.lower)
    knee = env.client.get("/therapist/exercises?body_area=knee", headers=env.t1).get_json()
    assert knee["count"] == 5 and all(e["body_area"] == "Knee" for e in knee["exercises"])
    assert env.client.get("/exercises?q=rotator", headers=env.t1).get_json()["count"] == 3
    assert env.client.get("/exercises?q=zzz", headers=env.t1).get_json()["count"] == 0
    areas = env.client.get("/exercises/body-areas", headers=env.t1).get_json()["body_areas"]
    assert sum(a["count"] for a in areas) == 20


def test_schedule_for_day(env):
    wed = env.client.get("/patient/schedule?date=2026-10-28", headers=env.p1).get_json()
    assert [e["plan_id"] for e in wed["exercises"]] == ["pl1", "pl2"]
    assert wed["exercises"][0]["exercise"]["slug"] == "shoulder-flexion"
    assert wed["exercises"][0]["therapist_name"] == "Grace Hopper"
    tue = env.client.get("/patient/schedule?date=2026-10-27", headers=env.p1).get_json()
    assert tue["exercises"] == []
    assert env.client.get("/patient/schedule?date=nope", headers=env.p1).status_code == 400
    assert env.client.get("/patient/schedule", headers=env.t1).status_code == 403


def test_today_dashboard_flow(env):
    h = env.p1
    today = env.client.get("/patient/today?date=2026-10-28", headers=h).get_json()
    assert today["status"] == "due" and len(today["exercises"]) == 2
    assert today["up_next"]["date"] == "2026-10-30"
    assert len(today["week"]) == 7 and today["week"][2]["is_today"]

    r = env.client.post("/patient/sessions", headers=h, json={
        "plan_id": "pl1", "local_date": "2026-10-28", "reps_completed": 30, "sets_completed": 3,
        "target_sets": 3, "target_reps": 10, "duration_seconds": 240, "avg_rom_degrees": 71.5,
        "completed": True, "summary": {"sample_rate_hz": 49.8}})
    assert r.status_code == 201
    saved = env.db.tables["exercise_logs"][0]
    assert saved["exercise_id"] == "ex0" and saved["local_date"] == "2026-10-28"

    # ended-early counts as attempted, not done
    env.client.post("/patient/sessions", headers=h, json={"plan_id": "pl2", "local_date": "2026-10-28",
                                                          "reps_completed": 4, "completed": False})
    today = env.client.get("/patient/today?date=2026-10-28", headers=h).get_json()
    by = {e["plan_id"]: e for e in today["exercises"]}
    assert by["pl1"]["done"] and not by["pl2"]["done"] and by["pl2"]["attempted"]
    assert today["status"] == "due"

    env.client.post("/patient/sessions", headers=h, json={"plan_id": "pl2", "local_date": "2026-10-28", "completed": True})
    today = env.client.get("/patient/today?date=2026-10-28", headers=h).get_json()
    assert today["status"] == "complete" and today["streak"] == 1 and today["next_milestone"] == 3


def test_no_program_and_paused(env):
    assert env.client.get("/patient/today?date=2026-10-28", headers=env.p2).get_json()["status"] == "no_program"
    for p in env.db.tables["plans"]:
        p["status"] = "paused"
    assert env.client.get("/patient/today?date=2026-10-28", headers=env.p1).get_json()["status"] == "paused"


def test_session_validation(env):
    h = env.p1
    assert env.client.post("/patient/sessions", headers=h, json={"local_date": "2026-10-28"}).status_code == 400
    # can't log against someone else's plan
    env.db.tables["plans"].append({"id": "x", "patient_id": "p2", "therapist_id": "t1", "exercise_id": "ex0",
                                   "sets": 1, "reps": 1, "days_of_week": [1]})
    assert env.client.post("/patient/sessions", headers=h, json={"plan_id": "x"}).status_code == 404
    assert env.client.post("/patient/sessions", headers=h, json={"plan_id": "pl1", "reps_completed": -3}).status_code == 400
    # demo exercises (no plan) log by slug
    r = env.client.post("/patient/sessions", headers=h, json={"exercise_slug": "ankle-pumps", "local_date": "2026-10-28"})
    assert r.status_code == 201
    assert env.db.tables["exercise_logs"][-1]["plan_id"] is None


def test_push_test(env):
    assert env.client.post("/patient/push-test", headers=env.p1).status_code == 409
    env.db.tables["device_push_tokens"] = [{"user_id": "p1", "token": "ExponentPushToken[abc]"}]
    r = env.client.post("/patient/push-test", headers=env.p1)
    assert r.status_code == 200 and r.get_json() == {"sent": True, "devices": 1}
    assert env.pushes[0][0] == ["ExponentPushToken[abc]"]

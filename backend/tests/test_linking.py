from datetime import datetime, timedelta, timezone

import pytest

from app import create_app
from app.config import Config
from tests.fakes import FakeSupabase


class Cfg(Config):
    SUPABASE_URL = "https://example.supabase.co"
    SUPABASE_SECRET_KEY = "sb_secret_fake"
    ADMIN_PROVISION_KEY = "k"
    RESEND_API_KEY = ""          # no email provider in tests
    PORTAL_URL = "https://portal.test"


@pytest.fixture
def env(monkeypatch):
    db = FakeSupabase()
    monkeypatch.setattr("app.auth.supabase_ext.client", lambda _app: db)
    sent = {"email": [], "push": []}
    monkeypatch.setattr("app.routes.linking.send_invite_email", lambda cfg, **kw: sent["email"].append(kw) or True)
    monkeypatch.setattr("app.routes.linking.send_push", lambda cfg, tokens, **kw: sent["push"].append((tokens, kw)) or True)
    client = create_app(Cfg).test_client()
    t1 = db.add_user("t1", "therapist", "dr.one@clinic.com", office="o1", first="Grace", last="Hopper")
    t2 = db.add_user("t2", "therapist", "dr.two@clinic.com", office="o1", first="Alan", last="Turing")
    t3 = db.add_user("t3", "therapist", "dr.three@other.com", office="o2", first="Ada", last="Lovelace")
    return SimpleNamespaceEnv(db, client, sent, t1, t2, t3)


class SimpleNamespaceEnv:
    def __init__(self, db, client, sent, t1, t2, t3):
        self.db, self.client, self.sent, self.t1, self.t2, self.t3 = db, client, sent, t1, t2, t3


def invite(env, email="pat@example.com", headers=None, **extra):
    return env.client.post("/therapist/invitations", json={"email": email, **extra}, headers=headers or env.t1)


# ---------- auth ----------
def test_requires_token_and_role(env):
    assert env.client.get("/therapist/invitations").status_code == 401
    pat = env.db.add_user("p1", "patient", "pat@example.com")
    assert env.client.get("/therapist/invitations", headers=pat).status_code == 403
    assert env.client.get("/patient/invitations", headers=env.t1).status_code == 403
    assert env.client.get("/therapist/invitations", headers={"Authorization": "Bearer nope"}).status_code == 401


# ---------- creating invitations ----------
def test_invite_new_patient_sends_email_not_push(env):
    resp = invite(env, "New.Patient@Example.com", patient_name="Pat")
    body = resp.get_json()
    assert resp.status_code == 201
    assert body["invitation"]["email"] == "new.patient@example.com"      # normalised
    assert body["invitation"]["display_status"] == "pending"
    assert body["existing_patient"] is False and body["email_sent"] is True and body["push_sent"] is False
    assert len(body["invitation"]["code"]) == 8
    assert env.sent["email"][0]["link"] == f"https://portal.test/invite/{body['invitation']['code']}"
    assert env.sent["push"] == []


def test_invite_existing_patient_also_pushes_and_marks_in_app(env):
    env.db.add_user("p1", "patient", "pat@example.com")
    env.db.tables["device_push_tokens"] = [{"user_id": "p1", "token": "ExponentPushToken[abc]"}]
    body = invite(env).get_json()
    assert body["existing_patient"] is True and body["push_sent"] is True and body["email_sent"] is True
    assert env.sent["push"][0][0] == ["ExponentPushToken[abc]"]
    assert env.db.tables["invitations"][0]["patient_id"] == "p1"


def test_invite_validations(env):
    assert invite(env, "not-an-email").status_code == 400
    assert invite(env, "dr.two@clinic.com").status_code == 400                 # staff email
    assert invite(env).status_code == 201
    dup = invite(env)
    assert dup.status_code == 409                                              # already pending


def test_reinvite_after_expiry_retires_old_invite(env):
    first = invite(env).get_json()["invitation"]
    env.db.tables["invitations"][0]["expires_at"] = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    assert env.client.get("/therapist/invitations", headers=env.t1).get_json()["invitations"][0]["display_status"] == "expired"
    assert invite(env).status_code == 201
    statuses = sorted(i["status"] for i in env.db.tables["invitations"])
    assert statuses == ["pending", "revoked"] and first["id"] != env.db.tables["invitations"][1]["id"]


def test_cannot_invite_patient_already_on_caseload(env):
    env.db.add_user("p1", "patient", "pat@example.com")
    env.db.tables["care_links"] = [{"id": "l", "therapist_id": "t1", "patient_id": "p1", "status": "active"}]
    assert invite(env).status_code == 409


def test_list_is_scoped_to_therapist_and_resend_revoke(env):
    inv = invite(env).get_json()["invitation"]
    assert env.client.get("/therapist/invitations", headers=env.t2).get_json()["invitations"] == []
    assert env.client.post(f"/therapist/invitations/{inv['id']}/resend", headers=env.t2).status_code == 404
    assert env.client.post(f"/therapist/invitations/{inv['id']}/resend", headers=env.t1).status_code == 200
    assert len(env.sent["email"]) == 2
    assert env.client.post(f"/therapist/invitations/{inv['id']}/revoke", headers=env.t1).status_code == 200
    assert env.client.post(f"/therapist/invitations/{inv['id']}/revoke", headers=env.t1).status_code == 409
    assert env.client.post(f"/therapist/invitations/{inv['id']}/resend", headers=env.t1).status_code == 409


# ---------- patient accepting ----------
def test_accept_by_code_links_patient_and_shows_activated(env):
    code = invite(env).get_json()["invitation"]["code"]
    pat = env.db.add_user("p1", "patient", "pat@example.com")
    resp = env.client.post("/patient/invitations/accept", json={"code": code.lower()[:4] + "-" + code[4:]}, headers=pat)
    assert resp.status_code == 200 and resp.get_json()["therapist_name"] == "Grace Hopper"
    assert env.db.tables["care_links"][0]["therapist_id"] == "t1"
    assert env.client.get("/therapist/invitations", headers=env.t1).get_json()["invitations"][0]["display_status"] == "accepted"
    again = env.client.post("/patient/invitations/accept", json={"code": code}, headers=pat)
    assert again.status_code == 404                                            # one-time use


def test_unconfirmed_email_cannot_accept(env):
    code = invite(env).get_json()["invitation"]["code"]
    pat = env.db.add_user("p1", "patient", "pat@example.com", confirmed=False)
    resp = env.client.post("/patient/invitations/accept", json={"code": code}, headers=pat)
    assert resp.status_code == 403 and resp.get_json()["code"] == "email_not_confirmed"
    assert env.client.get("/patient/invitations", headers=pat).get_json() == {"invitations": [], "email_confirmed": False}
    assert "care_links" not in env.db.tables or env.db.tables["care_links"] == []


def test_code_only_works_for_the_invited_email(env):
    code = invite(env).get_json()["invitation"]["code"]
    other = env.db.add_user("p2", "patient", "someone.else@example.com")
    resp = env.client.post("/patient/invitations/accept", json={"code": code}, headers=other)
    assert resp.status_code == 404
    assert env.db.tables["invitations"][0]["status"] == "pending"


def test_expired_code_rejected(env):
    code = invite(env).get_json()["invitation"]["code"]
    env.db.tables["invitations"][0]["expires_at"] = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    pat = env.db.add_user("p1", "patient", "pat@example.com")
    assert env.client.post("/patient/invitations/accept", json={"code": code}, headers=pat).status_code == 404


def test_in_app_invitation_accept_and_decline(env):
    env.db.add_user("p1", "patient", "pat@example.com")
    pat = {"Authorization": "Bearer tok-p1"}
    first = invite(env).get_json()["invitation"]
    second = invite(env, headers=env.t2).get_json()["invitation"]
    listed = env.client.get("/patient/invitations", headers=pat).get_json()["invitations"]
    assert {i["therapist_name"] for i in listed} == {"Grace Hopper", "Alan Turing"}
    assert env.client.post(f"/patient/invitations/{first['id']}/accept", headers=pat).status_code == 200
    assert env.client.post(f"/patient/invitations/{second['id']}/decline", headers=pat).status_code == 200
    assert [i["display_status"] for i in env.client.get("/therapist/invitations", headers=env.t2).get_json()["invitations"]] == ["declined"]
    assert env.client.get("/patient/invitations", headers=pat).get_json()["invitations"] == []


def test_multiple_doctors_can_link_to_one_patient(env):
    pat = env.db.add_user("p1", "patient", "pat@example.com")
    for hdr in (env.t1, env.t2):
        code = invite(env, headers=hdr).get_json()["invitation"]["code"]
        assert env.client.post("/patient/invitations/accept", json={"code": code}, headers=pat).status_code == 200
    assert sorted(l["therapist_id"] for l in env.db.tables["care_links"]) == ["t1", "t2"]


def test_link_failure_rolls_claim_back(env):
    code = invite(env).get_json()["invitation"]["code"]
    pat = env.db.add_user("p1", "patient", "pat@example.com")
    env.db.fail_insert = "care_links"
    assert env.client.post("/patient/invitations/accept", json={"code": code}, headers=pat).status_code == 500
    assert env.db.tables["invitations"][0]["status"] == "pending"


# ---------- push token ----------
def test_register_push_token(env):
    pat = env.db.add_user("p1", "patient", "pat@example.com")
    assert env.client.post("/patient/push-token", json={"token": "bogus"}, headers=pat).status_code == 400
    for _ in range(2):
        assert env.client.post("/patient/push-token", json={"token": "ExponentPushToken[xyz]", "platform": "ios"}, headers=pat).status_code == 200
    assert len(env.db.tables["device_push_tokens"]) == 1


# ---------- transfer ----------
def test_colleagues_only_same_office(env):
    names = [c["name"] for c in env.client.get("/therapist/colleagues", headers=env.t1).get_json()["colleagues"]]
    assert names == ["Alan Turing"]


def test_transfer_calls_rpc_and_pushes_patient(env):
    env.db.add_user("p1", "patient", "pat@example.com")
    env.db.tables["device_push_tokens"] = [{"user_id": "p1", "token": "ExponentPushToken[abc]"}]
    resp = env.client.post("/therapist/patients/p1/transfer", json={"to_therapist_id": "t2"}, headers=env.t1)
    assert resp.status_code == 200
    assert env.db.rpc_calls == [("transfer_patient", {"p_patient": "p1", "p_from": "t1", "p_to": "t2"})]
    assert "Alan Turing" in env.sent["push"][0][1]["body"]


def test_transfer_surfaces_business_rule_errors(env):
    env.db.rpc_error = "{'message': 'transfer_error: both therapists must be active members of the same office'}"
    resp = env.client.post("/therapist/patients/p1/transfer", json={"to_therapist_id": "t3"}, headers=env.t1)
    assert resp.status_code == 400 and "same office" in resp.get_json()["error"]
    assert env.client.post("/therapist/patients/p1/transfer", json={}, headers=env.t1).status_code == 400

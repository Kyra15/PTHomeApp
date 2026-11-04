"""Create (or reuse) a demo doctor + patient, link them, and optionally give the patient a program.

A backup for demo day: Supabase's built-in email is rate-limited, so a live patient sign-up can get
stuck waiting for the confirmation email. This makes both accounts already confirmed.

    cd backend
    export SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=sb_secret_...
    python scripts/demo_setup.py --doctor dr.lee@example.com --patient jordan@example.com --password demo-pass-123
    python scripts/demo_setup.py ... --no-program      # link only; assign exercises live in the portal

Safe to re-run: existing accounts are reused (their passwords are NOT changed), the link is only created
once, and the doctor's program for this patient is replaced with the demo program.
"""
import argparse
import os
import sys
from datetime import date, timedelta

from supabase import create_client

# Varied on purpose: two tilt (accelerometer) and two rotation (gyroscope) exercises, small rep counts so a
# live demo is quick. Every day, so they're always "due today".
DEMO_PROGRAM = [
    ("shoulder-flexion", 2, 5),
    ("seated-knee-extension", 1, 5),
    ("shoulder-circles", 1, 3),
    ("seated-trunk-rotation", 1, 4),
]
EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]


def find_user(client, email):
    rows = client.table("users").select("id, role").eq("email", email.lower()).limit(1).execute().data
    return rows[0] if rows else None


def ensure_user(client, email, password, first, last):
    found = find_user(client, email)
    if found:
        print(f"  reusing {email}")
        return found["id"], False
    created = client.auth.admin.create_user({
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": {"first_name": first, "last_name": last, "full_name": f"{first} {last}"},
    })
    print(f"  created {email}")
    return created.user.id, True


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--doctor", required=True)
    ap.add_argument("--patient", required=True)
    ap.add_argument("--password", required=True, help="used for newly created accounts only")
    ap.add_argument("--doctor-name", default="Morgan Lee")
    ap.add_argument("--patient-name", default="Jordan Rivera")
    ap.add_argument("--office", default="Kinetic Demo Clinic")
    ap.add_argument("--no-program", action="store_true", help="link only; don't assign exercises")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SECRET_KEY first.")
    client = create_client(url, key)

    print("Doctor:")
    df, dl = (args.doctor_name.split(" ", 1) + [""])[:2]
    doctor_id, _ = ensure_user(client, args.doctor, args.password, df, dl)
    office = client.table("offices").select("id").ilike("name", args.office).limit(1).execute().data
    office_id = office[0]["id"] if office else client.table("offices").insert({"name": args.office}).execute().data[0]["id"]
    client.table("users").update({"role": "therapist", "active": True, "office_id": office_id}).eq("id", doctor_id).execute()

    print("Patient:")
    pf, pl = (args.patient_name.split(" ", 1) + [""])[:2]
    patient_id, _ = ensure_user(client, args.patient, args.password, pf, pl)
    if (find_user(client, args.patient) or {}).get("role") != "patient":
        sys.exit(f"{args.patient} is not a patient account.")

    link = (
        client.table("care_links").select("id").eq("therapist_id", doctor_id).eq("patient_id", patient_id)
        .eq("status", "active").limit(1).execute().data
    )
    if not link:
        client.table("care_links").insert({"therapist_id": doctor_id, "patient_id": patient_id}).execute()
    print("Linked doctor -> patient.")

    if args.no_program:
        print("Skipped the program (--no-program). Assign it in the portal: Patients -> Assign program.")
        return

    slugs = [s for s, _, _ in DEMO_PROGRAM]
    ex = {e["slug"]: e["id"] for e in client.table("exercises").select("id, slug").in_("slug", slugs).execute().data or []}
    missing = [s for s in slugs if s not in ex]
    if missing:
        sys.exit(f"Exercise library is missing {missing}. Run migrations 0006 + 0007 first.")
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    # Replace this doctor's current program for the patient (ended yesterday, not deleted, so history is kept).
    current = (
        client.table("plans").select("id, end_date").eq("patient_id", patient_id).eq("therapist_id", doctor_id)
        .execute().data or []
    )
    for p in current:
        if not p.get("end_date") or str(p["end_date"]) >= today:
            client.table("plans").update({"end_date": yesterday}).eq("id", p["id"]).execute()
    for order, (slug, sets, reps) in enumerate(DEMO_PROGRAM):
        client.table("plans").insert({
            "patient_id": patient_id, "therapist_id": doctor_id, "exercise_id": ex[slug],
            "sets": sets, "reps": reps, "days_of_week": EVERY_DAY, "start_date": today,
            "status": "active", "sort_order": order,
        }).execute()
    print("Assigned:", ", ".join(f"{s} {a}x{b}" for s, a, b in DEMO_PROGRAM))


if __name__ == "__main__":
    main()

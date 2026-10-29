# backend (Flask)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in SUPABASE_URL and SUPABASE_SECRET_KEY
export $(grep -v '^#' .env | xargs)
flask --app wsgi run        # http://127.0.0.1:5000/health
pytest
```

- `GET /health` – 200 whenever the server is up; body reports the Supabase status.
- `GET /health/db` – 200 only if Supabase is reachable, otherwise 503.
- `POST /admin/therapists` – creates a therapist account (first_name, last_name, email, password, optional
  `office_name`). Open sign-up, no code or header needed; this is what the portal's "Create account" form calls.
  The role is set server-side. Example:
  ```bash
  curl -X POST http://127.0.0.1:5000/admin/therapists -H "Content-Type: application/json" \
    -d '{"email":"pt@example.com","password":"a-strong-password","first_name":"Grace","last_name":"Hopper","office_name":"Rehab Partners"}'
  ```
- Database schema lives in `supabase/migrations/`; `supabase/tests_rls.sql` checks the RLS policies.

### Invitations + linking (weekly sprint, migration `0005_invitations_linking.sql`)

All of these need `Authorization: Bearer <Supabase access token>`; the account's email must be confirmed.

Therapist (admin-web):
- `POST /therapist/invitations` `{email, patient_name?}` – creates an invite (8-char code, 14-day expiry), emails it
  (Resend), and for emails that already have an app account also sends an Expo push + shows an in-app invitation.
- `GET /therapist/invitations` – every invite with `display_status`: `pending | expired | declined | revoked | accepted`.
- `POST /therapist/invitations/<id>/resend` · `POST /therapist/invitations/<id>/revoke`
- `GET /therapist/colleagues` – other active therapists in the same office.
- `POST /therapist/patients/<id>/transfer` `{to_therapist_id}` – atomic hand-off within the office (`transfer_patient()` SQL fn).

Patient (iPhone app):
- `GET /patient/invitations` – pending in-app invitations addressed to the signed-in, confirmed email.
- `POST /patient/invitations/accept` `{code}` · `POST /patient/invitations/<id>/accept` · `POST /patient/invitations/<id>/decline`
- `POST /patient/push-token` `{token, platform}`

Env vars: `RESEND_API_KEY`, `EMAIL_FROM`, `PORTAL_URL` (link target in emails), optional `INVITE_TTL_DAYS`, `EXPO_PUSH_URL`.
Therapists who enter the same office name at sign-up (case-insensitive) can transfer patients between each other.
Supabase dashboard: Authentication → Providers → Email → **Confirm email must be ON** (that is what forces patients to verify).


### Library, schedule & sessions (catch-up sprint, migrations `0006` + `0007`)

Run in the Supabase SQL editor, in order:

1. `supabase/migrations/0006_exercise_library_schedule.sql` — library columns on `exercises`
   (slug, instructions, positioning tip, sensor settings, tags), `plans.status` (active/paused/ended),
   and `exercise_logs.local_date` / sets / completed.
2. `supabase/migrations/0007_seed_exercise_library.sql` — the 20-exercise library. **Generated** from
   `shared/exercise-library.json` by `python backend/scripts/gen_exercise_seed.py`; edit the JSON, re-run
   the script, re-run the SQL (it upserts on slug).
3. (dev only) `supabase/dev_seed_test_program.sql` — put your test patient + therapist emails in, run it,
   and that patient gets a 4-exercise program so the dashboard has real data.

| Endpoint | Who | What |
|---|---|---|
| `GET /exercises?body_area=&q=` (also `/therapist/exercises`) | patient, therapist | Library, A→Z, filter by body area, search name/description/tags |
| `GET /exercises/body-areas` | patient, therapist | Body areas + counts |
| `GET /patient/schedule?date=YYYY-MM-DD` | patient | Exercises due that day (task 2.2) |
| `GET /patient/today?date=YYYY-MM-DD` | patient | Dashboard payload: status, today's exercises with done flags, week strip, streak, adherence %, ROM change, up next (task 2.1) |
| `POST /patient/sessions` | patient | Save a finished or ended-early session to `exercise_logs` |
| `POST /patient/push-test` | patient | Task 1.7: send a test push to my registered phones |

`date` is always the **phone's** local date, so "today" follows the patient's time zone. Scheduling
rules live in `app/schedule.py` (pure functions, tested in `tests/test_schedule.py` against 3 schedules).

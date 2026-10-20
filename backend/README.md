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


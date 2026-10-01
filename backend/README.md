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
- `POST /admin/therapists` – provisions a therapist/admin account (name, email, password).
  Requires header `X-Admin-Key: <ADMIN_PROVISION_KEY>`. There is no therapist sign-up screen
  anywhere on purpose — this is the only way to create one. Example:
  ```bash
  curl -X POST http://127.0.0.1:5000/admin/therapists \
    -H "X-Admin-Key: $ADMIN_PROVISION_KEY" -H "Content-Type: application/json" \
    -d '{"email":"pt@example.com","password":"a-strong-password","first_name":"Grace","last_name":"Hopper"}'
  ```
- Database schema lives in `supabase/migrations/`; `supabase/tests_rls.sql` checks the RLS policies.

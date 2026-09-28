# backend (Flask)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
export $(grep -v '^#' .env | xargs)
flask --app wsgi run        # http://127.0.0.1:5000/health
pytest
```

- `GET /health` – 200 whenever the server is up; body reports the Supabase status.
- `GET /health/db` – 200 only if Supabase is reachable, otherwise 503.
- Database schema lives in `supabase/migrations/`; `supabase/tests_rls.sql` checks the RLS policies.

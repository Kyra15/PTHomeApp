# admin-web

Clinician / admin web portal (React + Vite + TypeScript). Sign-in only for now — the patient
roster is an empty placeholder until task 3.1+.

```bash
cd admin-web
npm install
cp .env.example .env.local   # fill in your Supabase URL and publishable key
npm run dev                  # http://localhost:5173
```

Build for deployment: `npm run build` (output in `dist/`).

Uses the Supabase **publishable** key (`sb_publishable_...`) — safe to ship in a browser bundle.
Never put the `sb_secret_...` key here.

# admin-web

Clinician / admin web portal (React + Vite + TypeScript), styled to match the patient app's
theme (cream background, teal accent, see `src/index.css`).

```bash
cd admin-web
npm install
cp .env.example .env.local   # fill in Supabase + backend values
npm run dev                  # http://localhost:5173
```

Build for deployment: `npm run build` (output in `dist/`).

## Accounts

There's no therapist sign-up screen that's wide open to anyone — **Create a clinician account**
requires an **organization access code**, which is just your backend's `ADMIN_PROVISION_KEY`
(see `backend/README.md`). The sign-up form calls `POST /admin/therapists` on the backend; the
backend checks the code, creates the Supabase user, and sets its role to `therapist`. The
publishable key in `.env.local` can never do this on its own, by design.

## Patient roster

The dashboard queries `public.users` for patients whose `assigned_therapist_id` is the signed-in
therapist. Row Level Security enforces this server-side, so a therapist can only ever see their
own patients. There's no enrollment UI yet (task 3.1+), so until a patient is assigned to a
therapist — by hand, in the Supabase table editor, by setting `users.assigned_therapist_id` — the
roster shows "No patients yet".

Uses the Supabase **publishable** key (`sb_publishable_...`) — safe to ship in a browser bundle.
Never put the `sb_secret_...` key here.

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

**Create a clinician account** is open sign-up: name, email, password and (optionally) an office / clinic
name. The form calls `POST /admin/therapists` on the backend, which creates the Supabase user and sets its role
to `therapist` (the publishable key in `.env.local` can never set a role on its own). Therapists who enter the
same office name can transfer patients to each other.

## Patient roster

The dashboard lists the signed-in therapist's active `care_links` (patients on their caseload). Row Level Security enforces this server-side, so a therapist can only ever see their
own patients. There's no enrollment UI yet (task 3.1+), so until a patient is assigned to a
therapist — by hand, in the Supabase table editor, by setting `users.assigned_therapist_id` — the
roster shows "No patients yet".

Uses the Supabase **publishable** key (`sb_publishable_...`) — safe to ship in a browser bundle.
Never put the `sb_secret_...` key here.

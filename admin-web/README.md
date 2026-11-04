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

The dashboard (`/` and `/patients`) lists the signed-in therapist's active `care_links` — patients join a caseload by
accepting an invitation. Each row shows the therapist's program for that patient (exercise count, body areas, days),
30-day adherence, last session and a status flag (On track / Missed sessions / Not started), all from
`GET /therapist/patients`. A therapist can only ever see patients linked to them.

## Patient detail & program editor (Flow 6)

Click a patient (or **Assign program** / **Edit program**) to open `/patients/:id`:

- stats: adherence, streak, last session, status
- **Exercise program**: *Add exercise* opens the library (search + body-area filter); for each exercise set sets,
  reps and the days of the week (S M T W T F S), reorder with the arrows, remove with the bin, then **Save program**.
  An empty program, or an exercise with no days, is rejected. Changes apply from today, so a patient sees new
  exercises in the app straight away if today is one of the chosen days.
- exercises prescribed by the patient's *other* clinicians are shown read-only; saving never touches them
- **Recent sessions**: every session the iPhone uploaded (reps, average range of motion, time, finished / ended early)

Saving calls `PUT /therapist/patients/:id/program` (see `backend/README.md`).

Uses the Supabase **publishable** key (`sb_publishable_...`) — safe to ship in a browser bundle.
Never put the `sb_secret_...` key here.

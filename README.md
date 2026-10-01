# Kinetic

Kinetic is an iPhone app that helps people recovering from a musculoskeletal (MSK) injury do
their prescribed physical therapy exercises correctly and consistently at home. It uses the
iPhone's built-in accelerometer and gyroscope — no camera, no extra hardware — to track a
patient's movement in real time during an exercise: counting reps, measuring range of motion,
and flagging form issues as they happen. A companion admin portal lets nurses and other clinical
staff assign exercise programs on a schedule and monitor how each patient is doing remotely.

## Problem & Who It's For

People recovering from MSK injuries (shoulder, knee, back, neck) often do worse than they
should because home exercise programs — tracked only on paper or from memory — are done
inconsistently and sometimes with the wrong form, and clinicians have no visibility into any of
it between visits. Kinetic gives patients real-time feedback and gentle accountability at home,
and gives admins a way to assign, schedule, and monitor exercise programs remotely without extra
hardware or a webcam.

The two primary users are:
- **Patients** — people recovering from an MSK injury who do assigned exercises at home.
- **Admins** — nurses, physical therapists, or other clinical staff who assign programs and
  monitor patients.

See [`docs/features.md`](./docs/features.md) for the full feature set.

## MVP Overview

The first release focuses on: a patient completing an admin-assigned, scheduled exercise
program with real-time motion tracking, push notification reminders, and a streak system to
encourage adherence; and an admin assigning/adjusting programs and reviewing patient progress
remotely.

See [`docs/mvp.md`](./docs/mvp.md) for the full MVP scope, the complete feature list, and what
is explicitly excluded from this first release.

## Tech Stack

| Piece | Choice | Status |
|---|---|---|
| Patient app | React Native (Expo), iOS-only for the MVP | Prototype exists in the repo root |
| Backend | Flask (Python), deployed on Render | Skeleton with `/health` built |
| Database & auth | Supabase (Postgres + Row Level Security) | Core schema and RLS policies written |
| Admin portal | Web app (planned: React) | Placeholder folder only |
| Push notifications | Apple Push Notification service (APNs) | Not started |

Because the app handles personal health information, backend and hosting choices will need
HIPAA-aware handling. That has not been designed yet.

## Project Status

Foundation tasks 1.1–1.4 are done: repo structure, React Native app, Supabase schema with RLS,
and a Flask skeleton. The schedule and remaining tasks are in
[`docs/project-plan/`](./docs/project-plan/) (project start: Monday, Sept 21, 2026; demo the
week of Dec 14).

## Development Setup

### Patient app (iOS)

Requires Node.js and npm. Building for the iOS simulator also needs a Mac with Xcode.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL and publishable key
npx expo start --clear       # dev server (restart it after changing .env.local)
npx expo run:ios             # build and launch in the iOS simulator (Mac + Xcode only)
```

The app uses the Supabase **publishable** key (`sb_publishable_...`), which is safe to ship in the app.
Never put the `sb_secret_...` key in the app.

### Admin / clinician web portal

See [`admin-web/README.md`](./admin-web/README.md).

### Backend (Flask)

Requires Python 3.12. Full details in [`backend/README.md`](./backend/README.md).

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # fill in SUPABASE_URL and SUPABASE_SECRET_KEY
flask --app wsgi run      # http://127.0.0.1:5000/health
pytest
```

`SUPABASE_SECRET_KEY` is the `sb_secret_...` key from your Supabase project. Keep it private:
never commit it or put it in the app.

### Database (Supabase)

Run each file in `backend/supabase/migrations/` in order (`0001`, `0002`, then `0003`) in the Supabase SQL Editor, then run
`backend/supabase/tests_rls.sql` to check the access rules. Every row it returns should show
`passed = true`.

## Repository Structure

```
.
├── App.tsx, index.ts, app.json, package.json   # React Native (Expo) patient app
├── src/                    # app screens, components, hooks, navigation, theme
├── assets/                 # icons and sounds
├── backend/                # Flask API
│   ├── app/                #   app factory, config, routes
│   ├── supabase/           #   SQL migrations and RLS tests
│   ├── tests/              #   pytest tests
│   └── render.yaml         #   Render deployment config
├── admin-web/              # admin portal (placeholder)
├── todo.md
└── docs/
    ├── mvp.md              # MVP scope, feature list, and what's excluded
    ├── features.md         # full spec for every MVP feature
    ├── user-flows.md       # step-by-step user journeys
    ├── system_architecture/
    ├── mockups/
    ├── pitch/
    └── project-plan/       # plan, tasks.csv, availability, tracking setup
```

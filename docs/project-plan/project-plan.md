# Kinetic — MVP Project Plan

Built from `docs/mvp.md`, `docs/features.md`, `docs/user-flows.md`,
`docs/system_architecture_document.md`, and `availability.md` (this folder). Task breakdown is
sized against the ~125–135 effective hours calculated in `availability.md` §4.

## 0. Assumptions & decisions made to build this plan

Two source docs disagreed with each other, so these had to be resolved before tasks could be
sized. Revisit if they're wrong:

1. **Mobile client: React Native** (per your direction — updated from the earlier native
   Swift/SwiftUI assumption). `README.md` and `mvp.md` scoped a native app specifically because
   real-time Core Motion access was assumed to need one; with React Native, accelerometer/
   gyroscope access instead goes through a bridge library (e.g. `react-native-sensors`) or a
   small custom native module if the library can't hit the needed sample rate reliably. This is
   now the single biggest technical risk in the plan — see the updated F05 note below. iOS is
   still the only target platform for MVP (per `mvp.md`'s explicit Android exclusion); React
   Native doesn't change that scope, it just leaves the codebase positioned to add Android later
   without a rewrite.
2. **Backend: Flask** (per your direction — updated from FastAPI). Still Python, still talking
   to the same Supabase Postgres + RLS design from `system_architecture_document.md`. One real
   consequence: Flask has no built-in async task runner the way FastAPI does, so the scheduled
   reminder job (F06) is planned around **APScheduler running in-process** rather than
   Celery+Redis — enough for MVP scale without adding infrastructure to operate. Hosting
   provider is still open — this plan assumes a low-cost/free-tier host (e.g., Railway or
   Render); swap in whatever you actually pick.
3. **Billing/subscriptions:** the architecture doc includes a Billing Service (Stripe/App
   Store) and a `subscriptions` table, but no MVP feature (F01–F13) requires it. **Cut from this
   plan entirely** — it's post-MVP scope creep relative to `mvp.md`.
4. **Push notifications:** iOS-only means **APNs only**; the architecture doc's FCM path is
   unused for MVP.
5. **F05 (motion tracking) is the highest-risk task in the whole plan — more so now.** On top of
   the underlying signal-processing problem (rep counting, ROM measurement, form-deviation
   detection from raw sensor data), React Native adds a second risk layer: getting
   high-frequency (50–100Hz) accelerometer/gyroscope data across the JS bridge reliably. Task
   2.4 now starts with evaluating `react-native-sensors` (or similar) against the real target
   device *before* building the rep-counting algorithm on top of it — if it can't sustain the
   needed sample rate, the fallback is a small custom native Swift module that just forwards
   Core Motion data into JS, which is more setup work but removes the reliability risk. Either
   way, this plan still scopes the *first* working version to **2–3 exercise types** with
   hand-tuned thresholds, not a general solution. Expanding exercise/algorithm coverage is left
   for after MVP.

## 1. Milestones

| # | Milestone | Target date | What it proves |
|---|---|---|---|
| M1 | Foundation & Infrastructure Ready | **Fri, Oct 16, 2026** | Accounts, repo, database, backend, and both app shells exist and a user can sign in. |
| M2 | Core Patient Experience Functional | **Fri, Nov 13, 2026** | A patient can complete a real motion-tracked exercise session end to end. |
| M3 | Admin Portal & Data Loop Complete | **Fri, Dec 4, 2026** | An admin can assign a program, and review the data a patient's session produced. |
| M4 | Polish & Demo Readiness | **Fri, Dec 11, 2026** (dev cutoff) | The whole system is stable enough to demo live. |
| — | Buffer / demo setup | Dec 14–18, 2026 | No new development — see `availability.md` §1. |

## 2. Task breakdown

Effort is in focused hours (i.e., already assumes the 70% efficiency factor from
`availability.md` — these are hours of actual output, not hours sitting at the desk).

### Milestone 1 — Foundation & Infrastructure (Sept 28 – Oct 16, ~32h)

| Task | Effort | Depends on | Target date | Features | Definition of done |
|---|---|---|---|---|---|
| 1.1 Repo structure (`ios/`, `backend/`, `admin-web/`, `docs/`) | 2h | 1.1 | 9/29 | infra | Repo pushed with the folder structure in place and this plan committed under `docs/project-plan/`. |
| 1.2 React Native project scaffold (iOS target) | 4h | 1.3 (can start before approval finishes) | 10/2 | infra | Blank RN app builds and runs on the iOS simulator via Xcode/CocoaPods; Metro bundler and dev workflow confirmed working. |
| 1.3 Supabase project + core schema + RLS | 5h | 1.1 | 10/6 | all | `users`, `health_profiles`, `exercises`, `plans`, `exercise_logs` tables exist with RLS policies; a test patient row is visible to itself and to a therapist role, not to a different patient. |
| 1.4 Flask skeleton, deployed | 4h | 1.5 | 10/9 | infra | `/health` returns 200 from a public URL; connects to Supabase successfully; app-factory structure in place so routes aren't all in one file. |
| 1.5 Auth end-to-end (F01, F02) | 6h | 1.4, 1.6 | 10/13 | F01, F02 | Patient signs in from the iPhone app and reaches an empty dashboard; admin signs in on web and reaches an empty roster. |
| 1.6 Admin web portal scaffold, deployed | 4h | 1.1 | 10/13 | infra | Admin portal live at a URL; shows the sign-in screen. |
| 1.7 APNs push certificate + test send | 2h | 1.3 | 10/16 | F06 | A manually triggered test push is received on a real or simulator device. |
| 1.8 Milestone review / buffer | 2h | all above | 10/16 | — | Every M1 row above is checked off; anything unfinished is explicitly rescheduled into M2, not silently dropped. |

### Milestone 2 — Core Patient Experience (Oct 19 – Nov 13, ~49h)

| Task | Effort | Depends on | Target date | Features | Definition of done |
|---|---|---|---|---|---|
| 2.1 Home Dashboard UI | 5h | 1.7 | 10/23 | F03 | Dashboard renders real data (today's exercises, streak, quick stats) from a manually seeded test plan; shows the correct empty state with no program assigned. |
| 2.2 Scheduled delivery logic | 4h | 1.5, 1.6 | 10/25 | F04 | API returns the correct exercise list for a given patient/day, verified against 3 different test schedules. |
| 2.3 Exercise player shell (pre-exercise screen) | 5h | 2.1 | 10/28 | F05 | Instructions screen shows demo placeholder, target sets/reps, and a phone-positioning tip, and transitions into a session on "Start Exercise." |
| 2.4 Sensor capture via RN bridge | 9h | 2.3 | 11/3 | F05 | Library (e.g. `react-native-sensors`) evaluated against target sample rate on a real device — decision recorded, custom native module fallback used if it can't keep up; accelerometer + gyroscope stream captured and visible (console/log) at the target rate during a live session; pause/resume on backgrounding works. |
| 2.5 Rep counting & ROM algorithm | 10h | 2.4 | 11/8 | F05 | For 2–3 chosen exercise types (see §0.5), rep count is accurate within ±1 across 5 test runs each, and a per-rep ROM angle is computed and displayed. |
| 2.6 Live form feedback + session summary | 5h | 2.5 | 11/10 | F05 | "Good form"/"Adjust position" indicator updates live; session summary (reps, avg ROM, form score, duration) is shown and POSTed to `exercise_logs`. |
| 2.7 Push reminders + streak-at-risk (F06) | 5h | 1.9, 2.2 | 11/12 | F06 | Test patient receives a standard reminder if the day's session is incomplete, and a distinct streak-at-risk push if they have an active streak. |
| 2.8 Streak tracking (F07) | 3h | 2.6 | 11/13 | F07 | Completing all of a scheduled day's exercises increments a visible streak; missing a fully-scheduled day resets it to zero; a milestone badge appears at a defined threshold. |
| 2.9 Milestone review / integration test | 3h | all above | 11/13 | — | Full patient flow — sign in → dashboard → complete a real motion-tracked session → streak updates — works without any manual database edits. |

### Milestone 3 — Admin Portal & Data Loop (Nov 16 – Dec 4, ~37h)

*Spans the Thanksgiving week (Nov 23–29) — task 3.3 is deliberately given extra calendar room
to absorb the reduced-capacity days.*

| Task | Effort | Depends on | Target date | Features | Definition of done |
|---|---|---|---|---|---|
| 3.1 Patient Roster Dashboard | 5h | 1.7, 1.8 | 11/20 | F09 | Roster lists ≥3 seeded test patients with correct adherence %, last-session date, and a status flag; empty state with "Add Patient" works with zero patients. |
| 3.2 Exercise Library + seed data | 4h | 1.8 | 11/22 | F11 | 10–15 seeded exercises, taggable/searchable by body area; empty search state handled. |
| 3.3 Program assignment editor | 8h | 3.2 | 11/29 | F10 | Admin builds a program (schedule days + exercises + sets/reps), saves it, and it's blocked from saving with zero exercises; it correctly appears in the patient app starting the next scheduled day. |
| 3.4 Patient Detail & Progress Review | 5h | 3.1 | 12/2 | F12 | Opening a patient shows profile, current program summary, key stats, ROM trend chart, and recent sessions list; empty state before any sessions exist. |
| 3.5 Session Data Review | 8h | 2.5, 2.6, 3.4 | 12/4 | F13 | Admin opens a completed session, sees rep-by-rep ROM chart with flagged deviations explained in plain language (or "No issues flagged"), and can save a persisting clinical note. |
| 3.6 Patient Progress & Adherence History | 5h | 2.6 | 12/4 | F08 | Patient-side Progress tab shows adherence %, ROM trend, form-score trend, and session list, filterable by week/month/all-time, from ≥5 seeded sessions. |
| 3.7 Milestone review | 2h | all above | 12/4 | — | Full admin loop — assign program → patient completes it → admin reviews the session → adds a note — works end to end. |

### Milestone 4 — Polish & Demo Readiness (Dec 7 – Dec 11, ~15h + buffer week)

| Task | Effort | Depends on | Target date | Features | Definition of done |
|---|---|---|---|---|---|
| 4.1 Bug bash & edge cases | 5h | M1–M3 complete | 12/9 | all | Empty states, error handling, and the edge cases listed in `features.md` for F01–F13 are spot-checked, not just the happy path. |
| 4.2 Realistic demo data | 2h | 4.1 | 12/9 | all | 3–4 demo patients exist with real-looking history (varied adherence, at least one flagged form issue) so the demo isn't a blank slate. |
| 4.3 Deployment hardening | 3h | 4.1 | 12/11 | infra | Backend and admin portal are stable on their real hosting (not just localhost); env vars/secrets are not hardcoded. |
| 4.4 Demo script & rehearsal | 2h | 4.2, 4.3 | 12/11 | — | A written walkthrough exists covering both the patient and admin sides, and has been run through at least once end to end. |
| 4.5 Contingency buffer | ~3h | — | 12/11 | — | Absorbs whatever slipped from M1–M3; if nothing slipped, spend it expanding F05's exercise coverage beyond the MVP minimum. |

**Dec 14–18:** no new development scheduled — this window is for final demo-environment setup
and rehearsal only, per the assignment's instruction not to schedule work through the deadline.

## 3. Total effort check

M1 (~32h) + M2 (~49h) + M3 (~37h) + M4 (~15h) = **~133 focused hours**, against the **~125–135
effective hours** budgeted in `availability.md` §4 — an even tighter match than before, since
moving to React Native added a little effort (and real risk) to task 2.4 without removing
anything elsewhere. There is essentially **no slack**: if any `TODO (you)` item in
`availability.md` §3 turns out to reduce available hours (a college visit week, a field trip),
or if 2.4's sensor-bridge evaluation forces the custom-native-module fallback, that time has to
come out of scope — most likely by cutting M4's contingency buffer first, then narrowing F05's
exercise coverage in §0.5, rather than by trying to compress M2 or M3's core build time. Given
the added risk, it's worth doing 2.4's library evaluation as early as possible so any fallback
is known well before M2's deadline, not discovered late.
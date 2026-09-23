# Kinetic — MVP Project Plan

Built from `docs/mvp.md`, `docs/features.md`, `docs/user-flows.md`,
`docs/system_architecture_document.md`, and `availability.md` (this folder). Task breakdown is
sized against the ~125–135 effective hours calculated in `availability.md` §4.

## 0. Assumptions & decisions made to build this plan

Two source docs disagreed with each other, so these had to be resolved before tasks could be
sized. Revisit if they're wrong:

1. **Mobile client:** `system_architecture_document.md` suggests React Native/Flutter;
   `README.md` and `mvp.md` both say native iOS (Swift/SwiftUI), since real-time Core Motion
   access and the explicit "Android is out of scope" decision only make sense for a native
   client. **This plan assumes native Swift/SwiftUI**, not React Native/Flutter.
2. **Backend:** treated `system_architecture_document.md`'s Supabase (Postgres + RLS) + FastAPI
   design as the decided backend, since `README.md` marks backend as "not yet decided" but the
   architecture doc is a complete, specific design. Hosting provider for the FastAPI service is
   still open — this plan assumes a low-cost/free-tier host (e.g., Railway or Render); swap in
   whatever you actually pick.
3. **Billing/subscriptions:** the architecture doc includes a Billing Service (Stripe/App
   Store) and a `subscriptions` table, but no MVP feature (F01–F13) requires it. **Cut from this
   plan entirely** — it's post-MVP scope creep relative to `mvp.md`.
4. **Push notifications:** iOS-only means **APNs only**; the architecture doc's FCM path is
   unused for MVP.
5. **F05 (motion tracking) is the highest-risk task in the whole plan.** Real-time rep counting,
   ROM measurement, and form-deviation detection from raw accelerometer/gyroscope data is a
   genuine signal-processing problem, not a CRUD feature. To keep it achievable in the time
   available, this plan scopes the *first* working version to **2–3 exercise types** with
   hand-tuned thresholds (peak detection on a filtered signal), not a general solution that
   works for any exercise. Expanding exercise coverage is explicitly left for after MVP.

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

### Milestone 1 — Foundation & Infrastructure (Sept 28 – Oct 16, ~31h)

| Task | Effort | Depends on | Target date | Features | Definition of done |
|---|---|---|---|---|---|
| 1.1 Confirm architecture decisions | 2h | — | 9/29 | infra | §0 decisions above are accepted (or revised) and recorded in `system_architecture_document.md`; nothing blocking setup is still undecided. |
| 1.2 Repo structure (`ios/`, `backend/`, `admin-web/`, `docs/`) | 2h | 1.1 | 9/29 | infra | Repo pushed with the folder structure in place and this plan committed under `docs/project-plan/`. |
| 1.3 Apple Developer Program enrollment | 1h active (+ up to 48h approval wait) | — | 9/30 (start immediately — longest lead time item) | infra | Account approved, Team ID available for Xcode signing. |
| 1.4 Xcode project scaffold | 3h | 1.3 (can start before approval finishes) | 10/2 | infra | Blank SwiftUI app builds and runs on simulator/device. |
| 1.5 Supabase project + core schema + RLS | 5h | 1.1 | 10/6 | all | `users`, `health_profiles`, `exercises`, `plans`, `exercise_logs` tables exist with RLS policies; a test patient row is visible to itself and to a therapist role, not to a different patient. |
| 1.6 FastAPI skeleton, deployed | 4h | 1.5 | 10/9 | infra | `/health` returns 200 from a public URL; connects to Supabase successfully. |
| 1.7 Auth end-to-end (F01, F02) | 6h | 1.4, 1.6 | 10/13 | F01, F02 | Patient signs in from the iPhone app and reaches an empty dashboard; admin signs in on web and reaches an empty roster. |
| 1.8 Admin web portal scaffold, deployed | 4h | 1.1 | 10/13 | infra | Admin portal live at a URL; shows the sign-in screen. |
| 1.9 APNs push certificate + test send | 2h | 1.3 | 10/16 | F06 | A manually triggered test push is received on a real or simulator device. |
| 1.10 Milestone review / buffer | 2h | all above | 10/16 | — | Every M1 row above is checked off; anything unfinished is explicitly rescheduled into M2, not silently dropped. |

### Milestone 2 — Core Patient Experience (Oct 19 – Nov 13, ~48h)

| Task | Effort | Depends on | Target date | Features | Definition of done |
|---|---|---|---|---|---|
| 2.1 Home Dashboard UI | 5h | 1.7 | 10/23 | F03 | Dashboard renders real data (today's exercises, streak, quick stats) from a manually seeded test plan; shows the correct empty state with no program assigned. |
| 2.2 Scheduled delivery logic | 4h | 1.5, 1.6 | 10/25 | F04 | API returns the correct exercise list for a given patient/day, verified against 3 different test schedules. |
| 2.3 Exercise player shell (pre-exercise screen) | 5h | 2.1 | 10/28 | F05 | Instructions screen shows demo placeholder, target sets/reps, and a phone-positioning tip, and transitions into a session on "Start Exercise." |
| 2.4 Core Motion sensor capture | 8h | 2.3 | 11/3 | F05 | Accelerometer + gyroscope stream is captured and visible (console/log) at the target sample rate during a live test session; pause/resume on backgrounding works. |
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

M1 (~31h) + M2 (~48h) + M3 (~37h) + M4 (~15h) = **~131 focused hours**, against the **~125–135
effective hours** budgeted in `availability.md` §4 — a tight but workable match. There is
essentially **no slack**: if any `TODO (you)` item in `availability.md` §3 turns out to reduce
available hours (a college visit week, a field trip), that time has to come out of scope, most
likely by cutting M4's contingency buffer first, then narrowing F05's exercise coverage in §0.5,
rather than by trying to compress M2 or M3's core build time.

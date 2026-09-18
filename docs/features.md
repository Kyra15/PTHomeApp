# Feature Specifications

This document gives a full specification for every MVP feature listed in [`mvp.md`](./mvp.md).
Feature IDs match across all documents in this repository.

---

## F01 — Patient Account & Sign In

**Name:** Patient Account & Sign In

**User goal:** As a patient, I want to create an account and sign back in, so that my exercise
program, schedule, and progress are saved and private to me.

**Expected behavior:**
1. On first launch, the patient sees a welcome screen with "Continue with Apple" and "Sign In"
   options.
2. A new patient creates an account (name, email, password or Sign in with Apple).
3. An existing patient signs in with their credentials.
4. Once signed in, the patient is taken to their Home Dashboard (F03).
5. The patient's session stays signed in across app launches until they explicitly sign out.
6. A patient's account is typically created by, or linked to, an admin who has enrolled them
   (see F10); a patient does not assign their own program.

**Error conditions / edge cases:**
- Incorrect password: show an inline error; do not specify whether the email exists (avoid
  account enumeration).
- No internet connection at sign-in: show a clear offline message; do not silently fail.
- Patient tries to sign in before an admin has enrolled them / created their record: show a
  message directing them to contact their care team.
- Forgotten password: standard reset-via-email flow.

---

## F02 — Admin Account & Sign In

**Name:** Admin (Nurse/Clinician) Account & Sign In

**User goal:** As an admin, I want to sign in to a separate, secure portal, so that I can manage
my patients' programs without exposing that functionality in the patient-facing app.

**Expected behavior:**
1. Admins use a distinct sign-in surface (separate portal/URL from the patient app).
2. Admin accounts are provisioned by the organization (not self-serve sign-up in the MVP).
3. On successful sign-in, the admin is taken to the Patient Roster Dashboard (F09).
4. Sessions persist per standard web session handling; admin can sign out explicitly.

**Error conditions / edge cases:**
- Incorrect credentials: inline error, no account enumeration.
- Admin account deactivated (e.g., staff member who left): sign-in attempt is blocked with a
  clear message; does not reveal whether the account ever existed.
- Session timeout for security: after a period of inactivity, require re-authentication given
  the sensitivity of patient health data.

---

## F03 — Patient Home Dashboard

**Name:** Patient Home Dashboard

**User goal:** As a patient, I want a single screen that tells me what to do today and how I'm
doing overall, so I don't have to dig for it.

**Expected behavior:**
1. On sign-in (or app open), the patient lands on the Home Dashboard.
2. The dashboard shows: current streak, this week's adherence at a glance, today's assigned
   exercise(s) pulled from F04, and a prominent action to start today's session.
3. The dashboard also surfaces quick stats (e.g., adherence %, recent range-of-motion change).
4. If the patient has already completed today's assigned exercises, the dashboard reflects that
   (e.g., "Today's session complete") rather than prompting them again.
5. If the patient has no program assigned yet, the dashboard shows an empty/waiting state
   explaining that their care team is setting up their program.

**Error conditions / edge cases:**
- No assigned program yet: show an explanatory empty state, not a broken/blank screen.
- Assigned program paused or ended by an admin: dashboard reflects that status rather than
  showing stale exercises.
- Multiple exercises scheduled for today: list all of them; indicate which are complete.

---

## F04 — Scheduled Exercise Delivery

**Name:** Scheduled Exercise Delivery

**User goal:** As a patient, I want the app to show me the right exercises on the right days
automatically, so I don't have to remember my program's schedule myself.

**Expected behavior:**
1. An admin defines a schedule as part of program assignment (F10) — e.g., specific days of the
   week, with a set of exercises (and sets/reps) for each scheduled day.
2. Each day, the app determines which exercises (if any) are due for the patient based on that
   schedule and surfaces them on the Home Dashboard (F03).
3. Once a scheduled exercise is completed for the day, it's marked done and does not need to be
   repeated that day.
4. If a scheduled day is missed entirely (no exercises completed by end of day), it counts as a
   missed day for adherence (F08) and streak (F07) purposes; the app does not retroactively
   require makeup sessions in the MVP.

**Error conditions / edge cases:**
- Admin changes the schedule mid-week: the new schedule takes effect from the next scheduled
  day forward; it does not rewrite history for days already passed.
- Time zone changes (patient travels): "today" is computed from the patient's device time zone.
- Program ends or is paused by an admin: no further exercises are delivered until resumed.

---

## F05 — Guided Exercise Session

**Name:** Guided Exercise Session (motion-tracked)

**User goal:** As a patient, I want real-time guidance and feedback while I do a prescribed
exercise, so that I do it correctly and consistently without needing a therapist physically
present.

**Expected behavior:**
1. From the Home Dashboard, the patient starts a scheduled exercise, which opens a pre-exercise
   instructions screen: a short demo, the target sets/reps, and a tip on holding the iPhone
   (no mount or camera required).
2. The patient taps "Start Exercise," which begins live tracking.
3. During live tracking, the app uses the iPhone's accelerometer and gyroscope (Core Motion) to:
   - Count completed reps in real time.
   - Measure range of motion (ROM) per rep.
   - Detect and flag form deviations, shown as a "Good form" / "Adjust position" indicator.
4. The patient can pause and resume, or end the session early.
5. When all sets/reps are complete (or the patient ends early), the app shows a Session Summary:
   reps completed, average/peak ROM, a form score, and session duration, plus how it compares to
   the previous session.
6. Completed session data feeds into Progress & Adherence History (F08), Streaks (F07), and is
   available to admins via Session Data Review (F13).

**Error conditions / edge cases:**
- Patient ends the session before completing all sets: summary reflects partial completion
  (e.g., "18/30 reps"); this still counts toward adherence but is marked as incomplete.
- Phone motion is erratic or inconsistent with the expected exercise pattern (e.g., patient
  puts the phone down mid-exercise): the app should pause rep counting rather than count
  incorrect reps, and should prompt the patient to reposition.
- Interruption (phone call, app backgrounded) mid-session: session pauses automatically; patient
  can resume from where they left off within the same day.
- Sensor data suggests a fall or sudden non-exercise motion: flag the session for admin review
  rather than silently discarding it.

---

## F06 — Push Notification Reminders

**Name:** Push Notification Reminders

**User goal:** As a patient, I want to be reminded to do my exercises, so I don't forget and
break my routine.

**Expected behavior:**
1. On a scheduled exercise day, if the patient hasn't completed the day's exercises by a default
   reminder time, the app sends one push notification reminding them.
2. If the patient still hasn't completed the day's exercises later in the day and has an active
   streak, the app sends a second "streak at risk" notification (distinct copy, e.g., "Don't
   lose your streak — finish today's session").
3. Tapping a notification opens the app directly to the relevant exercise (F05) or Home
   Dashboard (F03).
4. Patients can turn notifications off entirely in their device/app settings; the app respects
   the OS-level permission the patient grants at first launch.

**Error conditions / edge cases:**
- Patient has already completed today's session: no reminder is sent.
- Patient has denied notification permission: app functions normally without sending
  notifications; no repeated permission nagging.
- No exercises scheduled for today: no reminder is sent.
- Patient has no active streak: only the standard reminder is sent, not the streak-risk variant.

---

## F07 — Streaks & Rewards

**Name:** Streaks & Rewards

**User goal:** As a patient, I want to see a visible sign of my consistency, so I stay motivated
to keep doing my exercises.

**Expected behavior:**
1. The app tracks a streak counter: the number of consecutive scheduled days on which the
   patient completed all of that day's assigned exercises.
2. Completing all of today's scheduled exercises increments the streak; missing a fully
   scheduled day resets it to zero.
3. Days with no exercises scheduled do not break or extend the streak.
4. The current streak is shown on the Home Dashboard (F03) with a simple visual (e.g., a flame
   icon and day count).
5. Reaching defined milestones (e.g., 3, 7, 14, 30 days) awards a badge, shown in the patient's
   progress/profile area.

**Error conditions / edge cases:**
- Patient completes an exercise late (after midnight, before checking the next day's tasks):
  credit applies to the day the exercise was scheduled for, not the day it happened to be
  completed, as long as it's still within a reasonable grace window (e.g., before the next
  scheduled day begins).
- Admin retroactively changes a past day's schedule: does not recalculate historical streak
  data.
- Partial completion of a scheduled day's exercises: does not count toward the streak; all of
  that day's assigned exercises must be completed.

---

## F08 — Progress & Adherence History

**Name:** Progress & Adherence History

**User goal:** As a patient, I want to see how I'm trending over time, so I can tell whether
I'm improving and stay motivated.

**Expected behavior:**
1. A dedicated Progress screen shows: adherence percentage over a selectable period (week/
   month/all time), a range-of-motion trend chart, and a form-score trend.
2. A list of recent sessions is shown, each with date, exercise, duration, and rep completion.
3. Data shown here is calculated from completed Guided Exercise Sessions (F05).

**Error conditions / edge cases:**
- No sessions yet: show an empty state explaining that history will appear after the first
  completed session.
- Gaps in data (e.g., patient paused for two weeks for medical reasons): chart should reflect
  the gap rather than falsely interpolating.

---

## F09 — Patient Roster Dashboard

**Name:** Patient Roster Dashboard

**User goal:** As an admin, I want a single view of all my patients and who needs attention, so
I can prioritize my time.

**Expected behavior:**
1. On sign-in, the admin sees a roster (table) of all patients assigned to them: name, current
   program, adherence percentage, date of last session, and a status indicator.
2. Status indicators flag patients who need attention — e.g., "Missed sessions" or "Form alert"
   — computed from adherence and form-score data.
3. Summary stats are shown at the top (e.g., number of active patients, average adherence,
   number needing attention).
4. Selecting a patient opens their Patient Detail & Progress Review screen (F12).
5. The admin can search/filter the roster and add a new patient.

**Error conditions / edge cases:**
- Admin has no patients yet: show an empty state with a clear "Add Patient" action.
- A patient who was removed/discharged: no longer appears in the active roster (moved to an
  archived state, not deleted).

---

## F10 — Exercise Program Assignment

**Name:** Exercise Program Assignment

**User goal:** As an admin, I want to build and adjust a structured exercise program for a
specific patient, so their home exercise plan matches their clinical needs.

**Expected behavior:**
1. From a patient's detail view, the admin opens "Edit Program."
2. The admin sets a program name and condition/category (e.g., "Post-op shoulder").
3. The admin sets a schedule: which days of the week the program is active.
4. The admin adds exercises to the program from the Exercise Library (F11), and for each,
   sets sets and reps.
5. The admin can reorder or remove exercises, and can save changes.
6. Saved changes take effect for the patient's next scheduled day (see F04's edge case on
   mid-week changes).

**Error conditions / edge cases:**
- Admin tries to save a program with zero exercises: block save with an inline validation
  message.
- Admin edits a program while the patient is mid-session on the old version: the in-progress
  session is not interrupted; changes apply starting the next scheduled day.
- Two admins edit the same patient's program at the same time: last save wins in the MVP (no
  conflict resolution UI); this is a known limitation, not a designed feature.

---

## F11 — Exercise Library

**Name:** Exercise Library

**User goal:** As an admin, I want to find and select from a pre-built set of exercises when
building a program, so I don't have to define motion-tracking logic myself.

**Expected behavior:**
1. Within program assignment (F10), the admin can search or browse a library of exercises,
   each tagged by body area/condition (e.g., "Shoulder," "Knee," "Low back").
2. Each library entry shows a name, a short demo/instructions, and a category tag.
3. The admin adds an entry directly into the program being built.
4. The library is maintained centrally (not per-admin or per-patient) in the MVP.

**Error conditions / edge cases:**
- Search returns no results: show a clear empty state rather than a blank list.
- An exercise is later removed from the library: existing patient programs that already
  reference it continue to work; it just becomes unavailable for new assignments.

---

## F12 — Patient Detail & Progress Review

**Name:** Patient Detail & Progress Review

**User goal:** As an admin, I want to see everything relevant about one patient in one place,
so I can make informed decisions about their program.

**Expected behavior:**
1. Selecting a patient from the roster (F09) opens their detail view.
2. The view shows: patient profile info (condition, referring provider, start date), their
   current program summary, key stats (adherence, latest ROM, form score, sessions logged),
   a range-of-motion trend chart, and a list of recent sessions.
3. From here, the admin can navigate to Edit Program (F10) or into a specific session's detail
   (F13).

**Error conditions / edge cases:**
- Patient has not completed any sessions yet: stats and charts show an empty state rather than
  zeros that could be misread as poor performance.

---

## F13 — Session Data Review

**Name:** Session Data Review

**User goal:** As an admin, I want to inspect the motion data behind a specific session, so I
can understand exactly what happened and give informed clinical guidance.

**Expected behavior:**
1. From a patient's session list (F12), the admin opens a specific session.
2. The view shows summary stats for that session (reps, average/peak ROM, form score, duration)
   and a rep-by-rep range-of-motion chart.
3. Reps or moments flagged for a form deviation during the session (F05) are highlighted with
   an explanation (e.g., "Rep 16: ROM dropped to 118° with elevated shoulder shrug detected").
4. The admin can add a free-text clinical note to the session record.

**Error conditions / edge cases:**
- Session was ended early / incomplete: the review clearly indicates partial data rather than
  implying the full program was done.
- No form deviations were flagged: show a positive confirmation (e.g., "No issues flagged")
  rather than an empty-looking section.

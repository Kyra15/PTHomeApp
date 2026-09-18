# User Flows

This document walks through each essential journey a person takes through Kinetic, in plain
text. Each step is marked as an app response or a user action, and references the relevant
feature ID(s) from [`features.md`](./features.md). "Admin" refers to a nurse, physical
therapist, or other clinical staff member using the admin portal.

---

## Flow 1 — Patient: First Sign-In

**Starting point:** Patient has just been enrolled by their care team and received an
invitation to download the app.

- user - opens the app for the first time
- app - shows the welcome screen with "Continue with Apple" and "Sign In" [F01]
- user - signs in with the credentials their care team set up
- app - verifies the account and loads the patient's record
- app - displays the Home Dashboard [F03]
- app - shows an empty/waiting state if no program has been assigned yet [F03]

**Outcome:** Patient is signed in and looking at their Home Dashboard, ready to see their
program once an admin assigns one.

---

## Flow 2 — Patient: Complete a Scheduled Exercise Session (core flow)

**Starting point:** Patient opens the app on a day when exercises are scheduled.

- user - opens the app
- app - displays the Home Dashboard with today's scheduled exercise(s) [F03] [F04]
- user - taps "Start Today's Session"
- app - shows the pre-exercise instructions screen: demo, target sets/reps, phone-positioning
  tip [F05]
- user - taps "Start Exercise"
- app - begins live motion tracking using the accelerometer and gyroscope [F05]
- app - counts reps, measures range of motion, and shows a live "Good form" / "Adjust position"
  indicator [F05]
- user - completes the prescribed sets and reps (or ends the session early)
- app - displays the Session Summary: reps completed, average ROM, form score, duration [F05]
- app - updates the patient's streak [F07]
- app - updates progress and adherence history [F08]
- user - taps "Done," returning to the Home Dashboard
- app - Home Dashboard now shows today's session as complete [F03]

**Outcome:** A completed (or partially completed) session is recorded, and the patient's
streak, adherence, and progress data are all updated.

---

## Flow 3 — Patient: Notification-Triggered Reminder

**Starting point:** Patient has a scheduled exercise today and has not yet completed it by the
default reminder time.

- app - sends a push notification reminding the patient to do today's exercise [F06]
- user - taps the notification
- app - opens directly to the relevant exercise's pre-exercise instructions screen [F05] [F06]
- user - continues into Flow 2 from the "Start Exercise" step

**Alternate branch — streak at risk:**
- app - later in the day, if the exercise is still incomplete and the patient has an active
  streak, sends a second "streak at risk" notification [F06] [F07]
- user - taps the notification and completes the exercise (continues into Flow 2)

**Outcome:** Patient is brought back into the app at the moment they're needed, reducing missed
scheduled days.

---

## Flow 4 — Patient: Check Progress and Streak

**Starting point:** Patient wants to see how they're doing over time.

- user - opens the app
- app - displays the Home Dashboard, including current streak [F03] [F07]
- user - navigates to the Progress tab
- app - displays adherence percentage, range-of-motion trend chart, form-score trend, and a
  list of recent sessions [F08]
- user - selects a time range (week / month / all time)
- app - updates the charts to reflect the selected range [F08]

**Outcome:** Patient understands their trend and consistency without needing to ask their care
team.

---

## Flow 5 — Admin: Sign In and Review the Roster

**Starting point:** Admin starts their day and wants to see which patients need attention.

- user - opens the admin portal
- app - shows the admin sign-in screen [F02]
- user - signs in
- app - displays the Patient Roster Dashboard: all assigned patients, adherence, last session,
  and status flags [F09]
- user - scans the roster for patients flagged "Missed sessions" or "Form alert" [F09]
- user - selects a flagged patient
- app - opens that patient's Patient Detail & Progress Review screen [F12]

**Outcome:** Admin has identified which patients need attention today and is looking at the
first one's full detail.

---

## Flow 6 — Admin: Assign or Edit a Patient's Exercise Program

**Starting point:** Admin is on a patient's detail screen and needs to set up or adjust their
program.

- user - selects "Edit Program" from the patient's detail screen [F12]
- app - opens the program editor, pre-filled with the current program (if one exists) [F10]
- user - sets the program name and condition/category [F10]
- user - sets which days of the week the program is active [F10] [F04]
- user - searches the Exercise Library for an exercise to add [F11]
- app - displays matching results from the library [F11]
- user - adds an exercise to the program and sets its sets/reps [F10]
- user - repeats adding exercises as needed, and can reorder or remove any of them [F10]
- user - taps "Save Program"
- app - validates the program (e.g., rejects an empty program) [F10]
- app - saves the program; changes take effect starting the patient's next scheduled day [F10]
  [F04]

**Outcome:** The patient's program and schedule are updated, and the patient will see the new
exercises the next time they're scheduled.

---

## Flow 7 — Admin: Review a Completed Session's Motion Data

**Starting point:** Admin wants to understand why a specific session was flagged, or just
wants to check in on a patient's technique.

- user - opens a patient's detail screen [F12]
- user - selects a specific session from the recent sessions list [F12]
- app - opens the Session Data Review screen: summary stats and a rep-by-rep range-of-motion
  chart [F13]
- app - highlights any reps flagged for a form deviation, with a plain-language explanation
  [F13] [F05]
- user - reads the flagged issue and adds a clinical note [F13]
- app - saves the note to the session record [F13]

**Outcome:** Admin has a clear, data-backed understanding of what happened in the session and
has recorded guidance for the care team's records.

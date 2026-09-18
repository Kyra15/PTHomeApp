# MVP Definition

This document defines the Minimum Viable Product (MVP) for Kinetic: the smallest set of features
needed to release a useful, functional product for both of the app's primary users.

> A note on roles: the app has two primary users. **Patients** are people recovering from a
> musculoskeletal (MSK) injury who do exercises at home. **Admins** are the nurses, physical
> therapists, or clinical staff who assign exercise programs and monitor patients remotely.
> "Admin" is used as shorthand for "nurse/admin" throughout this document.

## MVP Statement

The MVP will allow **patients** recovering from a musculoskeletal injury to **complete their
clinician-assigned home exercise program on schedule, with real-time motion tracking and
feedback**, by using the app's scheduled exercise delivery, guided exercise session, push
notification reminders, and streak-tracking features.

The MVP will allow **admins** (nurses/clinical staff) to **assign and adjust a structured,
scheduled exercise program for each patient and remotely monitor adherence and exercise
quality**, by using the app's patient roster, program assignment, exercise library, and
session review features.

## MVP Feature List

Each feature has a stable ID used consistently across `mvp.md`, `features.md`, and
`user-flows.md`. Full specifications for every feature below are in
[`features.md`](./features.md).

| ID | Feature | Role | Short description |
|----|---------|------|--------------------|
| F01 | Patient Account & Sign In | Patient | Create an account and sign in to the patient app. |
| F02 | Admin Account & Sign In | Admin | Sign in to a separate clinician/admin portal. |
| F03 | Patient Home Dashboard | Patient | Landing screen showing today's assigned exercises, streak, and quick stats. |
| F04 | Scheduled Exercise Delivery | Patient | The app surfaces the right exercises on the right days, based on the schedule an admin set. |
| F05 | Guided Exercise Session | Patient | The core flow: instructions, then live rep counting, ROM measurement, and form feedback using the iPhone's accelerometer and gyroscope, then a summary. |
| F06 | Push Notification Reminders | Patient | Reminders to complete scheduled exercises, and a warning when a streak is at risk. |
| F07 | Streaks & Rewards | Patient | Tracks consecutive days of completed exercise and awards simple milestone badges. |
| F08 | Progress & Adherence History | Patient | A patient's own view of their adherence rate, range-of-motion trend, and past sessions. |
| F09 | Patient Roster Dashboard | Admin | An admin's home view of all assigned patients, with adherence and alerts at a glance. |
| F10 | Exercise Program Assignment | Admin | An admin builds or edits a patient's program: which exercises, how many sets/reps, and on what schedule. |
| F11 | Exercise Library | Admin | A pre-built, searchable catalog of exercises an admin can add to a patient's program. |
| F12 | Patient Detail & Progress Review | Admin | An admin's view of one patient's profile, current program, and progress over time. |
| F13 | Session Data Review | Admin | An admin's detailed view of a single completed session's motion data, with any flagged form issues and a place to leave a clinical note. |

## Explicitly Out of Scope for MVP

The following are deliberately **not** included in the first release. They are reasonable
future improvements, but are not required for a useful, functional product:

- **Real-time messaging/chat** between patient and admin (MVP includes one-way clinical notes
  only, visible to the care team; no in-app chat).
- **Custom exercise authoring** — in the MVP, admins can only assign exercises from the
  pre-built Exercise Library (F11); they cannot define a brand-new motion-tracked exercise.
- **Rewards marketplace / redeemable points** — MVP rewards (F07) are milestone badges only,
  with no point redemption, physical rewards, or gift cards.
- **Social features** — leaderboards, friend challenges, or sharing achievements outside the app.
- **Wearable device integration** (Apple Watch or other IMU wearables); MVP uses only the
  iPhone's built-in sensors.
- **Camera-based / computer-vision form checking** as a secondary or alternative tracking method.
- **Apple Health integration** or export of session data to other health apps.
- **EHR integration and billing/insurance claims support.**
- **Telehealth video visits.**
- **Android app** — MVP is iOS/iPhone only, since it depends on Core Motion.
- **Multi-language / localization support.**
- **Offline mode** (recording a session with no network connectivity and syncing later).
- **Advanced notification customization** — custom reminder times per exercise, snooze,
  quiet hours, or multiple reminders per day. MVP sends one default reminder per scheduled day.
- **Multi-clinic / organization-level administration** — billing across clinics, admin roles
  with different permission levels, or managing multiple care teams. MVP assumes a single,
  flat "admin" role.
- **Adaptive/AI-driven program adjustment** that automatically changes a patient's program
  based on their performance trends.
- **Clinical outcome reporting / exportable PDF reports** for referring physicians.
- **Family or caregiver companion accounts.**
- **In-app audio/voice coaching** during a live exercise session.

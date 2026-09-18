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

## Platform (Planned)

This section describes current intentions for what the system will be built and run on. None
of it has been built or verified yet — it will be updated as real decisions are made and
implementation begins.

- **Patient app:** Native iOS (Swift/SwiftUI). Real-time accelerometer/gyroscope tracking
  depends on Apple's Core Motion framework, which requires a native iOS app.
- **Admin portal:** A web application (planned: React), used by nurses/clinical staff on a
  desktop or tablet browser.
- **Push notifications:** Apple Push Notification service (APNs), planned.
- **Backend & data storage:** Not yet decided. Will need to support patient/admin accounts,
  program and schedule data, session summaries, and notification delivery. Hosting provider is
  also not yet decided. Given this app handles personal health information, backend and hosting
  choices will need to account for that (e.g., HIPAA-aware handling) — this has not been
  designed yet.

## Development Setup

No application code has been written yet. This repository currently contains product
documentation and design specifications only (see `docs/`). Build and run instructions will be
added here once the iOS project and admin portal codebases exist and have been verified to
actually build and run — this section intentionally does not include invented setup commands.

## Repository Structure

```
your-project-root/
├── README.md
└── docs/
    ├── mvp.md            # MVP scope, feature list, and what's excluded
    ├── features.md       # Full spec for every MVP feature
    └── user-flows.md      # Step-by-step user journeys through the app
```

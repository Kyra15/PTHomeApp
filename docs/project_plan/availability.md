# Availability & Time Budget — Kinetic MVP

This is the raw capacity data the project plan (`project-plan.md`) is built from. It's kept
separate so that if the schedule needs to change later, this is the only file that has to be
re-examined and fed back to AI — not the whole plan from scratch.

**Items marked `TODO (you)` are personal information only you know. Fill them in and regenerate
the plan (or ask AI to adjust it) once you have real dates — everything downstream currently
assumes the defaults stated next to each TODO.**

## 1. Key dates

| Item | Date | Note |
|---|---|---|
| Plan generated | 2026-09-23 | |
| Project start date | **Monday, Sept 28, 2026** | Per assignment instructions: start = Monday of the coming week. |
| Target deadline | **3rd week of December 2026 (Dec 14–18)** | Assumed demo/submission day: **Thursday, Dec 17, 2026**. `TODO (you): replace with your actual assignment due date once known.` |
| Development cutoff | **Friday, Dec 11, 2026** | No new feature work scheduled after this date — see §5. |
| Demo-prep buffer window | **Dec 14–18, 2026** | Reserved for deployment stability, seed data, rehearsal — not new development. |

Total window: **~11.5 weeks of development** (Sept 28 → Dec 11) + **1 buffer week**.

## 2. School holiday calendar

- **Thanksgiving break:** assumed **Wed Nov 25 – Fri Nov 27, 2026** off entirely (folded into
  the schedule as zero-capacity days). `TODO (you): confirm your school's actual Thanksgiving
  break dates and edit if different.`
- No other school breaks are assumed to fall before Dec 18 (winter break normally starts after
  this window). `TODO (you): confirm there's no early dismissal / in-service days / other
  district holidays between 9/28 and 12/18.`

## 3. Personal days, sick days, and reduced-capacity periods

- **Sick day reserve:** 2 days budgeted. Not tied to specific calendar dates — instead folded
  into the efficiency factor in §4, so if you get sick, that capacity is already "spent" in the
  estimates rather than needing to be re-planned.
- **Known personal days you'll be fully unavailable** (family events, appointments, etc.):
  `TODO (you): list any specific dates here.`
- **Known field trips / competitions / travel days:** `TODO (you): list dates. These get
  scheduled as zero-capacity days, same as a holiday.`
- **College visit weeks / college application weeks:** per the assignment, these aren't zeroed
  out entirely — capacity for these weeks should be dropped to ~50%. `TODO (you): list any
  known weeks and their dates; until filled in, none are assumed.`

Because none of the three items above have real dates yet, **the plan in `project-plan.md`
assumes only the Thanksgiving days are lost.** Any real dates you add here will shrink the
available hours below what's currently planned — regenerate milestone/task dates with AI once
you've filled these in, rather than trying to just "work faster" to compensate.

## 4. Daily capacity & buffer factor

- **Stated availability:** "a few hours every day." Assumed as **2 hours on school days
  (weekdays), 4 hours on weekend days**, every day the calendar isn't zeroed out above. `TODO
  (you): correct this split if your actual weekday/weekend availability is different.`
- Raw weekly capacity: (2h × 5) + (4h × 2) = **18 hours/week**.
- **Efficiency/padding factor: 70%.** Raw scheduled hours are discounted by 30% before being
  counted as "usable" hours, to account for the planning fallacy (we reliably overestimate what
  we'll get done), context-switching, and normal debugging/research friction. This is separate
  from — and in addition to — the AI-assisted development speedup already reflected in the task
  effort estimates themselves.
- **Effective usable capacity: ~12.5 hours/week** during full-capacity weeks, ~half that during
  the Thanksgiving week.
- **Total effective hours across the dev window (Sept 28 – Dec 11, 11 weeks, 1 reduced for
  Thanksgiving):** roughly **125–135 hours** — this is the real budget `project-plan.md` is
  sized against.

## 5. Developer capability context

`TODO (you): AI should ask you directly, but hasn't had the chance to yet — here's what would
sharpen the estimates if you answer it:`
- Prior experience with **Swift/SwiftUI**: none / some / comfortable?
- Prior experience with **Python/FastAPI** (or any backend framework): none / some / comfortable?
- Prior experience with **React** (for the admin web portal): none / some / comfortable?
- Have you used **Supabase** (or any Postgres-backed BaaS) before?

Until answered, the plan assumes a **motivated beginner-to-intermediate** developer working
with heavy AI assistance — i.e., the 70% efficiency factor above is already generous toward
"first time doing this," not toward "experienced iOS engineer." If you're more experienced than
that, you likely have real slack in this plan; if you're newer to all three of Swift, Python,
and React simultaneously, flag that and the estimates for Milestone 2 in particular (the
Core Motion / rep-counting work) should probably grow, not shrink.

## 6. Assumptions this file makes that aren't yet confirmed data

These aren't "your" data — they're defaults AI chose so the plan could be built now instead of
waiting. Listed here so they're easy to spot and override:
- 7-day-a-week availability (vs. weekdays-only) — confirm this is actually realistic for you,
  since school sports/activities often eat weekend time too.
- No other standing weekly commitments (job, practice, etc.) subtracted from capacity.

# Project Tracking System Setup

The assignment asks for the tasks above to live in an actual tracking tool (Trello, GitHub
Projects, ClickUp, etc.), not just in markdown. Since you're already using GitHub for the repo,
**GitHub Projects** is the lowest-friction option — free, no separate account, and issues can
link directly to commits/PRs later. `tasks.csv` in this folder has every task from
`project-plan.md` in an importable format if you'd rather use Trello or ClickUp instead.

## Option A — GitHub Projects (recommended, since the repo is already on GitHub)

1. In your GitHub repo, go to the **Projects** tab → **New project** → choose the **Board**
   template.
2. Create four columns matching the milestones: `M1 Foundation`, `M2 Patient Experience`,
   `M3 Admin Portal`, `M4 Polish`, plus a `Backlog` and `Done` column.
3. For each row in `project-plan.md`'s task tables, create an issue (Projects → **+ Add item** →
   **Create new issue**) with:
   - Title: the task name (e.g., "2.5 Rep counting & ROM algorithm")
   - Body: paste the Depends on / Target date / Features / Definition of done columns for that
     row
   - Labels: one per related feature ID (`F05`, `F10`, etc.) — create these labels once, reuse
     them everywhere
4. Set each issue's target date as a **due date** field (Projects supports custom date fields).
5. Move an issue to `Done` only when its Definition of Done is actually met — not when the code
   is merged but untested.

## Option B — Trello / ClickUp via CSV import

`tasks.csv` in this folder can be imported directly:
- **ClickUp:** Settings → Import → CSV, then map the columns (Title, Milestone, Effort,
  Dependencies, Target Date, Features, Definition of Done) to ClickUp fields on import.
- **Trello:** Trello's free tier doesn't have native CSV import — either add cards manually
  using the CSV as your source list, or use a free CSV-to-Trello import tool referenced in
  Trello's own Power-Up directory.

## What to submit

Per the assignment, submit whichever of these is actually feasible for your tool:
1. Grant your instructor access to the live board (share link with edit or view access), **or**
2. Export/print the board to PDF and upload it, **or**
3. Screenshot the board (all four milestone columns visible), **or**
4. If none of the above works cleanly, demo the live board in class instead — the assignment
   explicitly allows this as a fallback.

Whichever you choose, make sure the board reflects the same milestones and task list as
`project-plan.md` in this folder — that consistency is what shows the tool wasn't set up
separately from the actual plan.

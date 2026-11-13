-- Manual activities: a custom item a clinician prescribes that the app doesn't motion-track.
-- The patient just checks it off (e.g. "Walk 10 minutes", "Theraband rows — green band").
--
--  * A manual activity is an exercises row with sensor_mode = 'manual' and created_by = the clinician
--    who wrote it. It is private to the patient it was prescribed for: it never shows in the library
--    (the API filters on created_by is null), and RLS only lets the author / the patient's plan
--    holders read it.
--  * It is scheduled with a normal plans row (sets = reps = 1), so streaks, adherence, "today",
--    the week strip and transfers all work unchanged.
--  * Checking it off writes a normal exercise_logs row (completed = true, summary.manual = true).
--    Unchecking deletes that day's row.

alter table public.exercises
  add column if not exists created_by uuid references public.users (id) on delete set null;

alter table public.exercises drop constraint if exists exercises_sensor_mode_chk;
alter table public.exercises add constraint exercises_sensor_mode_chk
  check (sensor_mode in ('tilt', 'rotation', 'manual'));

-- A clinician-authored row must be a manual activity (library rows keep created_by null).
alter table public.exercises drop constraint if exists exercises_custom_manual_chk;
alter table public.exercises add constraint exercises_custom_manual_chk
  check (created_by is null or sensor_mode = 'manual');

create index if not exists exercises_created_by_idx on public.exercises (created_by) where created_by is not null;

-- Library rows stay readable by everyone signed in; custom rows only by their author or by anyone
-- who can see a plan that uses them (the patient, and that patient's linked therapists).
drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises for select to authenticated using (
  created_by is null
  or created_by = auth.uid()
  or exists (select 1 from public.plans p where p.exercise_id = exercises.id)
);

-- The backend (service role) deletes a manual check-off when the patient unticks it. No client policy
-- is needed for that; this comment is here so nobody adds a broad delete policy by accident.

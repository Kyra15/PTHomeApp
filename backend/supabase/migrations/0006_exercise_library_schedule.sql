-- Catch-up sprint (week of Oct 26): tasks 2.1–2.4 + exercise library (3.2 pulled forward).
--
--  * exercises     – richer library rows: stable slug, step-by-step instructions, phone positioning
--                    tip, sensor settings the app uses for live tracking, tags for search.
--  * plans.status  – active | paused | ended, so the dashboard can show a paused program (F03/F04)
--                    instead of stale exercises.
--  * exercise_logs – the patient's local calendar day (so "done today" follows the phone's time zone,
--                    F04 edge case), sets/target reps, and whether the session was finished or ended early.
--
-- Seed data for the 20 library exercises is in 0007_seed_exercise_library.sql (generated from
-- shared/exercise-library.json by backend/scripts/gen_exercise_seed.py).

-- ---------- exercises ----------
alter table public.exercises
  add column if not exists slug                text,
  add column if not exists instructions        jsonb   not null default '[]'::jsonb,
  add column if not exists positioning_tip     text,
  add column if not exists sensor_mode         text    not null default 'tilt',
  add column if not exists diagram             text    not null default 'dial',
  add column if not exists target_angle_deg    numeric,
  add column if not exists return_angle_deg    numeric,
  add column if not exists target_rotation_deg numeric,
  add column if not exists est_minutes         int,
  add column if not exists difficulty          text,
  add column if not exists equipment           text,
  add column if not exists tags                text[]  not null default '{}',
  add column if not exists accent_color        text,
  add column if not exists active              boolean not null default true;

-- give any pre-existing hand-made rows a slug so the unique index can be created
update public.exercises
   set slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') || '-' || left(id::text, 6)
 where slug is null;
alter table public.exercises alter column slug set not null;
create unique index if not exists exercises_slug_uq on public.exercises (slug);
create index if not exists exercises_body_area_idx on public.exercises (lower(body_area)) where active;

alter table public.exercises drop constraint if exists exercises_sensor_mode_chk;
alter table public.exercises add constraint exercises_sensor_mode_chk check (sensor_mode in ('tilt', 'rotation'));
alter table public.exercises drop constraint if exists exercises_difficulty_chk;
alter table public.exercises add constraint exercises_difficulty_chk
  check (difficulty is null or difficulty in ('easy', 'moderate', 'hard'));

-- ---------- plans ----------
alter table public.plans
  add column if not exists status text not null default 'active';
alter table public.plans drop constraint if exists plans_status_chk;
alter table public.plans add constraint plans_status_chk check (status in ('active', 'paused', 'ended'));
alter table public.plans
  add column if not exists sort_order int not null default 0;

-- ---------- exercise_logs ----------
alter table public.exercise_logs
  add column if not exists local_date     date,
  add column if not exists sets_completed int,
  add column if not exists target_sets    int,
  add column if not exists target_reps    int,
  add column if not exists completed      boolean not null default true;
update public.exercise_logs set local_date = (completed_at at time zone 'utc')::date where local_date is null;
create index if not exists exercise_logs_patient_day_idx on public.exercise_logs (patient_id, local_date);

-- DEV ONLY (task 2.1 "manually seeded test plan"): give one test patient a program so the dashboard
-- has real data. Run in the Supabase SQL editor AFTER migrations 0006 + 0007.
--
-- 1. Replace the two emails below with a real patient account (made in the app) and a real therapist
--    account (made in the portal).
-- 2. Run it. It links them (if not already linked), clears that therapist's old plans for this patient,
--    and assigns 4 exercises:
--      Shoulder Flexion   3×10  Mon Wed Fri
--      Shoulder Abduction 3×10  Mon Wed Fri
--      Seated Knee Str.   3×10  Tue Thu Sat
--      Ankle Pumps        2×15  every day
-- Safe to re-run.

with params as (
  select lower('PATIENT_EMAIL@example.com') as patient_email,
         lower('THERAPIST_EMAIL@example.com') as therapist_email
),
p as (select u.id from public.users u, params where u.email = params.patient_email and u.role = 'patient'),
t as (select u.id from public.users u, params where u.email = params.therapist_email and u.role = 'therapist'),
link as (
  insert into public.care_links (therapist_id, patient_id)
  select t.id, p.id from p, t
  on conflict (therapist_id, patient_id) where status = 'active' do nothing
  returning id
),
cleared as (
  delete from public.plans where patient_id = (select id from p) and therapist_id = (select id from t)
  returning id
)
insert into public.plans (patient_id, therapist_id, exercise_id, sets, reps, days_of_week, start_date, sort_order)
select p.id, t.id, e.id, v.sets, v.reps, v.days, current_date - 14, v.ord
from p, t,
     (values ('shoulder-flexion',      3, 10, array[1,3,5],         0),
             ('shoulder-abduction',    3, 10, array[1,3,5],         1),
             ('seated-knee-extension', 3, 10, array[2,4,6],         2),
             ('ankle-pumps',           2, 15, array[0,1,2,3,4,5,6], 3)) as v(slug, sets, reps, days, ord)
join public.exercises e on e.slug = v.slug;

-- Optional: pretend the patient did yesterday's session so the streak/week strip isn't empty.
-- insert into public.exercise_logs (patient_id, plan_id, exercise_id, local_date, reps_completed, completed, avg_rom_degrees)
-- select patient_id, id, exercise_id, current_date - 1, sets * reps, true, 65
-- from public.plans
-- where patient_id = (select id from public.users where email = lower('PATIENT_EMAIL@example.com'))
--   and extract(dow from current_date - 1)::int = any (days_of_week);

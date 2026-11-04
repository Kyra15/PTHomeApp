-- DEV / DEMO: connect an existing patient account to a doctor account and give the patient exercises.
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run). Safe to re-run.
--
-- Before running:
--   * The PATIENT is the account you made in the iPhone app.
--   * The DOCTOR needs an account too. Either sign up in the doctor portal, OR in the Supabase dashboard:
--     Authentication → Users → Add user → Create new user → email + password, tick "Auto Confirm User".
--     (A new account starts as a patient; this script turns it into a doctor.)
--   * Change the two emails on the two lines marked  <-- EDIT .
--
-- What it does:
--   1. makes the doctor email a doctor (therapist) account that can sign in to the portal
--   2. links doctor → patient (like accepting an invitation)
--   3. replaces that doctor's current exercises for the patient with 4 varied ones, every day, starting today:
--        Shoulder Flexion 2×5 (tilt) · Seated Knee Straightening 1×5 (tilt)
--        Shoulder Circles 3 (rotation) · Seated Trunk Twist 4 (rotation)
--      (old ones end yesterday instead of being deleted, so past sessions keep their history)
--   4. shows what the patient now has
-- If an email doesn't match an account, it stops with an error saying which one.

do $$
declare
  patient_email text := lower(trim('PATIENT_EMAIL@example.com'));   -- <-- EDIT: your app (patient) account
  doctor_email  text := lower(trim('DOCTOR_EMAIL@example.com'));    -- <-- EDIT: the doctor account
  p_id uuid; p_role text;
  d_id uuid;
  n int;
begin
  if patient_email = doctor_email then
    raise exception 'The patient and doctor emails are the same. Use two different accounts.';
  end if;

  select id, role into p_id, p_role from public.users where lower(email) = patient_email;
  if p_id is null then
    raise exception 'No account with email % (patient). Check the spelling, or create the account in the app first.', patient_email;
  end if;
  if p_role <> 'patient' then
    raise exception '% is a doctor account, not a patient. Use the email you signed up with in the iPhone app.', patient_email;
  end if;

  select id into d_id from public.users where lower(email) = doctor_email;
  if d_id is null then
    raise exception 'No account with email % (doctor). Create it first (see the top of this script).', doctor_email;
  end if;

  -- 1. doctor account (keeps any name/office it already has)
  update public.users
     set role = 'therapist',
         active = true,
         first_name = coalesce(first_name, 'Demo'),
         last_name  = coalesce(last_name, 'Doctor'),
         full_name  = coalesce(full_name, 'Demo Doctor')
   where id = d_id;
  if (select office_id from public.users where id = d_id) is null then
    insert into public.offices (name) values ('Kinetic Demo Clinic') on conflict do nothing;
    update public.users set office_id = (select id from public.offices where lower(name) = 'kinetic demo clinic')
     where id = d_id;
  end if;

  -- 2. link (no-op if already linked)
  insert into public.care_links (therapist_id, patient_id)
  values (d_id, p_id)
  on conflict (therapist_id, patient_id) where status = 'active' do nothing;

  -- 3. program: end this doctor's current exercises for the patient, then add the demo set
  update public.plans
     set end_date = current_date - 1
   where patient_id = p_id and therapist_id = d_id
     and (end_date is null or end_date >= current_date);

  insert into public.plans (patient_id, therapist_id, exercise_id, sets, reps, days_of_week, start_date, status, sort_order)
  select p_id, d_id, e.id, v.sets, v.reps, array[0,1,2,3,4,5,6], current_date, 'active', v.ord
  from (values ('shoulder-flexion',      2, 5, 0),
               ('seated-knee-extension', 1, 5, 1),
               ('shoulder-circles',      1, 3, 2),
               ('seated-trunk-rotation', 1, 4, 3)) as v(slug, sets, reps, ord)
  join public.exercises e on e.slug = v.slug;
  get diagnostics n = row_count;
  if n < 4 then
    raise exception 'Only % of 4 exercises were found. Run migrations 0006 and 0007 (the exercise library) first.', n;
  end if;
end $$;

-- 4. Result: the patient's current exercises and who prescribed them. (Change the email here too.)
select pu.email as patient, du.email as doctor, e.name as exercise, pl.sets, pl.reps,
       pl.days_of_week as days, pl.start_date
from public.plans pl
join public.users pu on pu.id = pl.patient_id
join public.users du on du.id = pl.therapist_id
join public.exercises e on e.id = pl.exercise_id
where pu.email = lower(trim('PATIENT_EMAIL@example.com'))                 -- <-- EDIT: same patient email
  and (pl.end_date is null or pl.end_date >= current_date)
order by du.email, pl.sort_order;

-- RLS verification for task 1.3. Run in the Supabase SQL Editor AFTER 0001_core_schema.sql.
-- Everything runs in one transaction and is rolled back, so it leaves no data behind.
begin;

-- fixtures (run as the privileged SQL-editor role; bypasses RLS)
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),  -- patient A
  ('00000000-0000-0000-0000-00000000000b'),  -- patient B
  ('00000000-0000-0000-0000-0000000000c1');  -- therapist
update public.users set role = 'therapist' where id = '00000000-0000-0000-0000-0000000000c1';
update public.users set assigned_therapist_id = '00000000-0000-0000-0000-0000000000c1'
  where id = '00000000-0000-0000-0000-00000000000a';   -- therapist is assigned to A only
insert into public.health_profiles (user_id, injury_area) values
  ('00000000-0000-0000-0000-00000000000a', 'shoulder'),
  ('00000000-0000-0000-0000-00000000000b', 'knee');

create temp table results (test text, passed boolean);
grant all on results to authenticated;

-- as patient A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into results select 'patient A sees own profile',        count(*) = 1 from public.health_profiles where user_id = '00000000-0000-0000-0000-00000000000a';
insert into results select 'patient A cannot see patient B',    count(*) = 0 from public.health_profiles where user_id = '00000000-0000-0000-0000-00000000000b';
insert into results select 'patient A sees only own user row',  count(*) = 1 from public.users;

-- as therapist
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into results select 'therapist sees assigned patient A',   count(*) = 1 from public.health_profiles where user_id = '00000000-0000-0000-0000-00000000000a';
insert into results select 'therapist cannot see unassigned B',   count(*) = 0 from public.health_profiles where user_id = '00000000-0000-0000-0000-00000000000b';

-- as patient B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
insert into results select 'patient B cannot see patient A',    count(*) = 0 from public.health_profiles where user_id = '00000000-0000-0000-0000-00000000000a';

reset role;
select * from results order by test;   -- every row should show passed = true
rollback;

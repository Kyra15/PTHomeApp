-- RLS verification for tasks 1.3 + the invitations/linking sprint.
-- Run in the Supabase SQL Editor AFTER migrations 0001-0005.
-- Everything runs in one transaction and is rolled back, so it leaves no data behind.
begin;

-- fixtures (run as the privileged SQL-editor role; bypasses RLS)
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),  -- patient A
  ('00000000-0000-0000-0000-00000000000b'),  -- patient B
  ('00000000-0000-0000-0000-0000000000c1'),  -- therapist 1 (office X)
  ('00000000-0000-0000-0000-0000000000c2'),  -- therapist 2 (office X)
  ('00000000-0000-0000-0000-0000000000c3');  -- therapist 3 (office Y)
update public.users set role = 'therapist' where id in
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3');

insert into public.offices (id, name) values
  ('00000000-0000-0000-0000-0000000000f1', 'Office X'),
  ('00000000-0000-0000-0000-0000000000f2', 'Office Y');
update public.users set office_id = '00000000-0000-0000-0000-0000000000f1' where id in
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');
update public.users set office_id = '00000000-0000-0000-0000-0000000000f2' where id = '00000000-0000-0000-0000-0000000000c3';

-- therapist 1 treats A; therapist 2 treats B. Later A also gets therapist 2 (multi-doctor).
insert into public.care_links (therapist_id, patient_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000b');
insert into public.health_profiles (user_id, injury_area) values
  ('00000000-0000-0000-0000-00000000000a', 'shoulder'),
  ('00000000-0000-0000-0000-00000000000b', 'knee');
insert into public.invitations (therapist_id, email, code) values
  ('00000000-0000-0000-0000-0000000000c1', 'new.patient@example.com', 'ABCD2345'),
  ('00000000-0000-0000-0000-0000000000c2', 'other@example.com',       'WXYZ6789');

create temp table results (test text, passed boolean);
grant all on results to authenticated;

-- as patient A (linked to therapist 1 only)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into results select 'patient A sees own profile',              count(*) = 1 from public.health_profiles where user_id = '00000000-0000-0000-0000-00000000000a';
insert into results select 'patient A cannot see patient B',          count(*) = 0 from public.health_profiles where user_id = '00000000-0000-0000-0000-00000000000b';
insert into results select 'patient A sees self + own therapist only', count(*) = 2 from public.users;
insert into results select 'patient A cannot read others'' invitations', count(*) = 0 from public.invitations;
insert into results select 'patient A cannot read push tokens table',   count(*) = 0 from public.device_push_tokens;

-- as therapist 1
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into results select 'therapist 1 sees assigned patient A',     count(*) = 1 from public.health_profiles where user_id = '00000000-0000-0000-0000-00000000000a';
insert into results select 'therapist 1 cannot see unassigned B',     count(*) = 0 from public.health_profiles where user_id = '00000000-0000-0000-0000-00000000000b';
insert into results select 'therapist 1 sees only own invitations',   count(*) = 1 from public.invitations;
insert into results select 'therapist 1 sees only own care links',    count(*) = 1 from public.care_links;

-- as patient B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
insert into results select 'patient B cannot see patient A',          count(*) = 0 from public.health_profiles where user_id = '00000000-0000-0000-0000-00000000000a';

-- back to the privileged role for the transfer + multi-doctor checks
reset role;
insert into public.care_links (therapist_id, patient_id) values   -- A now has two doctors
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000a');
insert into results select 'patient can have two active doctors',
  count(*) = 2 from public.care_links where patient_id = '00000000-0000-0000-0000-00000000000a' and status = 'active';

-- transfer A: therapist 1 -> therapist 2 (same office; 2 is already linked, so it just ends 1's link)
select public.transfer_patient('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');
insert into results select 'transfer ends the old link and keeps one active link to the new therapist',
  (select count(*) from public.care_links where patient_id = '00000000-0000-0000-0000-00000000000a' and status = 'active') = 1
  and (select count(*) from public.care_links where patient_id = '00000000-0000-0000-0000-00000000000a' and therapist_id = '00000000-0000-0000-0000-0000000000c1' and status = 'active') = 0;

-- transfer across offices must fail
do $$
begin
  perform public.transfer_patient('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3');
  insert into results values ('transfer to another office is rejected', false);
exception when others then
  insert into results values ('transfer to another office is rejected', sqlerrm like 'transfer_error:%');
end $$;

select * from results order by test;   -- every row should show passed = true
rollback;

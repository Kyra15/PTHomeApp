-- Task 1.5 (admin side): lets an admin account be deactivated (F02 edge case) without deleting
-- it. The admin-web app blocks sign-in for role <> 'therapist' or active = false.
alter table public.users
  add column if not exists active boolean not null default true;

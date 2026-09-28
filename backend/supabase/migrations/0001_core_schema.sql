-- Kinetic core schema + Row Level Security (task 1.3)
-- Roles: 'patient' and 'therapist' (nurse / PT / admin). A patient is linked to one
-- therapist via users.assigned_therapist_id; that therapist can see the patient's data.

create extension if not exists "pgcrypto";

-- ---------- tables ----------
create table public.users (
  id                    uuid primary key references auth.users (id) on delete cascade,
  role                  text not null default 'patient' check (role in ('patient', 'therapist')),
  full_name             text,
  assigned_therapist_id uuid references public.users (id) on delete set null,
  created_at            timestamptz not null default now()
);

create table public.health_profiles (
  user_id      uuid primary key references public.users (id) on delete cascade,
  injury_area  text,
  notes        text,
  updated_at   timestamptz not null default now()
);

create table public.exercises (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  body_area    text not null,
  description  text,
  default_sets int  not null default 3,
  default_reps int  not null default 10,
  created_at   timestamptz not null default now()
);

-- One row = one exercise assigned to one patient on a weekly schedule.
create table public.plans (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.users (id) on delete cascade,
  therapist_id uuid not null references public.users (id),
  exercise_id  uuid not null references public.exercises (id),
  sets         int  not null check (sets > 0),
  reps         int  not null check (reps > 0),
  days_of_week int[] not null check (days_of_week <@ array[0,1,2,3,4,5,6] and cardinality(days_of_week) > 0),
  start_date   date not null default current_date,
  end_date     date,
  created_at   timestamptz not null default now()
);

create table public.exercise_logs (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.users (id) on delete cascade,
  plan_id          uuid references public.plans (id) on delete set null,
  exercise_id      uuid not null references public.exercises (id),
  completed_at     timestamptz not null default now(),
  reps_completed   int,
  avg_rom_degrees  numeric,
  form_score       numeric,
  duration_seconds int,
  summary          jsonb not null default '{}'::jsonb
);

create index on public.plans (patient_id);
create index on public.exercise_logs (patient_id, completed_at desc);
create index on public.users (assigned_therapist_id);

-- ---------- helpers ----------
-- SECURITY DEFINER so policies on public.users can call these without recursing into RLS.
create function public.is_therapist() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'therapist');
$$;

create function public.is_therapist_of(patient uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.users p
    join public.users t on t.id = p.assigned_therapist_id
    where p.id = patient and p.role = 'patient'
      and t.id = auth.uid() and t.role = 'therapist'
  );
$$;

-- Every new auth user gets a 'patient' row. Therapist accounts are promoted manually / by the backend
-- (never trust a client-supplied role).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, role) values (new.id, 'patient');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS ----------
alter table public.users           enable row level security;
alter table public.health_profiles enable row level security;
alter table public.exercises       enable row level security;
alter table public.plans           enable row level security;
alter table public.exercise_logs   enable row level security;

-- users: read yourself, or your assigned patients. No client writes (backend uses service role).
create policy users_select_self      on public.users for select to authenticated using (id = auth.uid());
create policy users_select_patients  on public.users for select to authenticated using (public.is_therapist_of(id));

-- health_profiles
create policy hp_select_self      on public.health_profiles for select to authenticated using (user_id = auth.uid());
create policy hp_select_therapist on public.health_profiles for select to authenticated using (public.is_therapist_of(user_id));
create policy hp_insert_self      on public.health_profiles for insert to authenticated with check (user_id = auth.uid());
create policy hp_update_self      on public.health_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- exercises: library is readable by any signed-in user; writes via service role only.
create policy exercises_select on public.exercises for select to authenticated using (true);

-- plans
create policy plans_select_patient   on public.plans for select to authenticated using (patient_id = auth.uid());
create policy plans_select_therapist on public.plans for select to authenticated using (public.is_therapist_of(patient_id));
create policy plans_insert_therapist on public.plans for insert to authenticated
  with check (therapist_id = auth.uid() and public.is_therapist_of(patient_id));
create policy plans_update_therapist on public.plans for update to authenticated
  using (therapist_id = auth.uid() and public.is_therapist_of(patient_id))
  with check (therapist_id = auth.uid() and public.is_therapist_of(patient_id));
create policy plans_delete_therapist on public.plans for delete to authenticated
  using (therapist_id = auth.uid() and public.is_therapist_of(patient_id));

-- exercise_logs
create policy logs_select_patient   on public.exercise_logs for select to authenticated using (patient_id = auth.uid());
create policy logs_select_therapist on public.exercise_logs for select to authenticated using (public.is_therapist_of(patient_id));
create policy logs_insert_patient   on public.exercise_logs for insert to authenticated with check (patient_id = auth.uid());

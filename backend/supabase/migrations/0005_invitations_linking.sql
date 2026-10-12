-- Weekly sprint (Oct 12): doctor portal invitations + patient<->therapist linking.
--
--  * offices            – a clinic; therapists in the same office can transfer patients to each other
--  * users.email/office – email copied from auth.users so the backend can tell "existing patient"
--  * care_links         – MANY therapists per patient (replaces users.assigned_therapist_id)
--  * invitations        – emailed invite (code + link) from a therapist to a patient email
--  * device_push_tokens – Expo push tokens so existing app users get a push + in-app invite
--  * transfer_patient() – atomic hand-off of a patient (and that therapist's prescriptions)
--
-- users.assigned_therapist_id is kept (deprecated, unused) so older clients don't break.

-- ---------- offices ----------
create table public.offices (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index offices_name_uq on public.offices (lower(name));

alter table public.users
  add column if not exists office_id uuid references public.offices (id) on delete set null,
  add column if not exists email     text;
create index on public.users (office_id);
create unique index users_email_uq on public.users (lower(email)) where email is not null;

-- backfill email, and keep it in sync with auth.users from now on
update public.users u set email = lower(a.email) from auth.users a where a.id = u.id and u.email is null;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  f text := nullif(trim(new.raw_user_meta_data ->> 'first_name'), '');
  l text := nullif(trim(new.raw_user_meta_data ->> 'last_name'), '');
begin
  insert into public.users (id, role, first_name, last_name, full_name, email)
  values (
    new.id,
    'patient',  -- a client can never choose its own role
    f,
    l,
    coalesce(nullif(trim(concat_ws(' ', f, l)), ''), nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')),
    lower(new.email)
  );
  return new;
end;
$$;

create or replace function public.sync_user_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.users set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_user_email();

-- ---------- care_links (multi-therapist) ----------
create table public.care_links (
  id           uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.users (id) on delete cascade,
  patient_id   uuid not null references public.users (id) on delete cascade,
  status       text not null default 'active' check (status in ('active', 'ended')),
  created_at   timestamptz not null default now(),
  ended_at     timestamptz
);
create unique index care_links_active_uq on public.care_links (therapist_id, patient_id) where status = 'active';
create index on public.care_links (patient_id) where status = 'active';
create index on public.care_links (therapist_id) where status = 'active';

insert into public.care_links (therapist_id, patient_id)
select assigned_therapist_id, id from public.users where assigned_therapist_id is not null;

-- ---------- invitations ----------
-- status: pending | accepted ("activated") | declined | revoked. "Expired" is derived:
-- a pending row whose expires_at has passed. The portal shows pending / not accepted / activated.
create table public.invitations (
  id            uuid primary key default gen_random_uuid(),
  therapist_id  uuid not null references public.users (id) on delete cascade,
  email         text not null,                                   -- stored lower-cased
  patient_name  text,
  code          text not null unique,                            -- 8 chars, no 0/O/1/I
  patient_id    uuid references public.users (id) on delete set null,  -- set when the email already has an app account
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  email_sent_at timestamptz,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '14 days'),
  responded_at  timestamptz
);
create unique index invitations_pending_uq on public.invitations (therapist_id, lower(email)) where status = 'pending';
create index on public.invitations (therapist_id, created_at desc);
create index on public.invitations (lower(email)) where status = 'pending';

-- ---------- push tokens ----------
create table public.device_push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  token      text not null unique,
  platform   text,
  updated_at timestamptz not null default now()
);
create index on public.device_push_tokens (user_id);

-- ---------- helpers ----------
create or replace function public.is_therapist_of(patient uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.care_links l
    join public.users t on t.id = l.therapist_id and t.role = 'therapist' and t.active
    join public.users p on p.id = l.patient_id   and p.role = 'patient'
    where l.patient_id = patient and l.therapist_id = auth.uid() and l.status = 'active'
  );
$$;

-- A patient may read the rows of therapists they're linked to, or who have a pending invite for them
-- (so the app can show "Dr. X invited you" and the "Your care team" list).
create or replace function public.is_therapist_connected_to_me(therapist uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.care_links
                  where patient_id = auth.uid() and therapist_id = therapist and status = 'active')
      or exists (select 1 from public.invitations
                  where patient_id = auth.uid() and therapist_id = therapist and status = 'pending');
$$;

-- ---------- transfer ----------
-- Hand a patient from one therapist to another therapist IN THE SAME OFFICE. Atomic: either the whole
-- move happens or none of it. The old therapist's link is ended, the new one is created, and the
-- exercises the old therapist prescribed move to the new therapist (other doctors' plans are untouched).
-- Only callable with the service-role key (the Flask backend), never by a signed-in client.
create or replace function public.transfer_patient(p_patient uuid, p_from uuid, p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  from_office uuid;
  to_office   uuid;
begin
  if p_from = p_to then
    raise exception 'transfer_error: choose a different therapist';
  end if;

  select office_id into from_office from public.users where id = p_from and role = 'therapist' and active;
  select office_id into to_office   from public.users where id = p_to   and role = 'therapist' and active;
  if from_office is null or to_office is null or from_office <> to_office then
    raise exception 'transfer_error: both therapists must be active members of the same office';
  end if;

  if not exists (select 1 from public.care_links
                  where therapist_id = p_from and patient_id = p_patient and status = 'active') then
    raise exception 'transfer_error: this patient is not on your caseload';
  end if;

  update public.care_links set status = 'ended', ended_at = now()
   where therapist_id = p_from and patient_id = p_patient and status = 'active';

  insert into public.care_links (therapist_id, patient_id)
  values (p_to, p_patient)
  on conflict (therapist_id, patient_id) where status = 'active' do nothing;

  update public.plans set therapist_id = p_to
   where patient_id = p_patient and therapist_id = p_from;
end;
$$;
revoke all on function public.transfer_patient(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.transfer_patient(uuid, uuid, uuid) to service_role;

-- ---------- RLS ----------
alter table public.offices            enable row level security;
alter table public.care_links         enable row level security;
alter table public.invitations        enable row level security;
alter table public.device_push_tokens enable row level security;

-- All writes to these tables go through the Flask backend (service role); clients only read their own rows.
create policy offices_select_own on public.offices for select to authenticated
  using (id = (select office_id from public.users where id = auth.uid()));

create policy care_links_select_therapist on public.care_links for select to authenticated using (therapist_id = auth.uid());
create policy care_links_select_patient   on public.care_links for select to authenticated using (patient_id = auth.uid());

create policy invitations_select_therapist on public.invitations for select to authenticated using (therapist_id = auth.uid());
create policy invitations_select_patient   on public.invitations for select to authenticated using (patient_id = auth.uid());

create policy push_tokens_select_self on public.device_push_tokens for select to authenticated using (user_id = auth.uid());

create policy users_select_my_therapists on public.users for select to authenticated
  using (public.is_therapist_connected_to_me(id));

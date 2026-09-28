-- Sign-up now collects first and last name in separate fields.
-- The app sends first_name, last_name (and a joined full_name) as auth user metadata.
-- Existing rows keep their full_name; first_name/last_name stay null for them.
alter table public.users
  add column if not exists first_name text,
  add column if not exists last_name  text;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  f text := nullif(trim(new.raw_user_meta_data ->> 'first_name'), '');
  l text := nullif(trim(new.raw_user_meta_data ->> 'last_name'), '');
begin
  insert into public.users (id, role, first_name, last_name, full_name)
  values (
    new.id,
    'patient',  -- a client can never choose its own role
    f,
    l,
    coalesce(nullif(trim(concat_ws(' ', f, l)), ''), nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''))
  );
  return new;
end;
$$;

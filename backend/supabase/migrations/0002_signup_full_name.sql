-- Task 1.5: copy the name entered at sign-up into public.users.full_name.
-- The app sends it as user metadata: supabase.auth.signUp({ options: { data: { full_name } } }).
-- The role is still forced to 'patient' here; a client can never choose its own role.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, role, full_name)
  values (new.id, 'patient', nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''));
  return new;
end;
$$;

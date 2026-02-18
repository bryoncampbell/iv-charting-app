-- User profiles: role (nursing | provider | admin) and is_active.
-- Run after schema.sql. Requires auth.users (Supabase Auth).
--
-- To make the first user an admin, run after this script (replace with their user_id from Auth → Users):
--   update profiles set role = 'admin' where user_id = '<your-user-uuid>';

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'nursing' check (role in ('nursing', 'provider', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_user_id_idx on profiles (user_id);
create index if not exists profiles_role_idx on profiles (role);

-- Create profile when a new auth user is created (e.g. sign up or magic link).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, role, is_active)
  values (
    new.id,
    new.raw_user_meta_data->>'email',
    coalesce((new.raw_user_meta_data->>'role')::text, 'nursing'),
    true
  )
  on conflict (user_id) do update set
    email = coalesce(excluded.email, profiles.email),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ensure existing auth users get a profile (run once after creating table).
insert into public.profiles (user_id, email, role, is_active)
select id, email, 'nursing', true
from auth.users
on conflict (user_id) do update set email = coalesce(excluded.email, profiles.email), updated_at = now();

-- RLS: users read own profile; admins read/update all.
alter table profiles enable row level security;

drop policy if exists "Users read own profile" on profiles;
drop policy if exists "Admins read all profiles" on profiles;
create policy "Users read own or admins read all"
  on profiles for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin' and p.is_active = true)
  );

drop policy if exists "Users insert own profile" on profiles;
create policy "Users insert own profile"
  on profiles for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins update all profiles" on profiles;
create policy "Admins update all profiles"
  on profiles for update to authenticated
  using (
    exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin' and p.is_active = true)
  )
  with check (true);

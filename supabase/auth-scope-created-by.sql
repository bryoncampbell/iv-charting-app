-- Optional: scope patients and encounters by signed-in user.
-- Run after schema.sql and rls-policies.sql. Requires Supabase Auth (auth.users).
-- Existing rows have created_by null and will not match RLS until you backfill, e.g.:
--   update patients set created_by = '<first-user-uuid>' where created_by is null;
--   update encounters set created_by = '<first-user-uuid>' where created_by is null;

-- Add created_by column (nullable).
alter table patients add column if not exists created_by uuid references auth.users (id);
alter table encounters add column if not exists created_by uuid references auth.users (id);

create index if not exists patients_created_by_idx on patients (created_by);
create index if not exists encounters_created_by_idx on encounters (created_by);

-- Drop the permissive anon policies so we can scope by user.
drop policy if exists "Allow anon read write patients" on patients;
drop policy if exists "Allow anon read write encounters" on encounters;

-- Authenticated users: only their own rows.
create policy "Users own patients"
  on patients for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "Users own encounters"
  on encounters for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Optional: allow anon for share_summaries and any public read; keep audit_log as-is.
-- (share_summaries and audit_log are unchanged by this file.)
--
-- To let all roles (nursing, provider, admin) see all visits/patients, run auth-admin-see-all.sql next.

-- Allow the app (anon key) to read and write data.
-- Run this in Supabase SQL Editor if you see "Encounter not found" after starting a visit,
-- or if inserts/selects fail. Supabase may enable RLS by default on new projects.

-- Patients: allow anon to SELECT, INSERT, UPDATE
alter table patients enable row level security;
drop policy if exists "Allow anon read write patients" on patients;
create policy "Allow anon read write patients"
  on patients for all to anon using (true) with check (true);

-- Encounters: allow anon to SELECT, INSERT, UPDATE
alter table encounters enable row level security;
drop policy if exists "Allow anon read write encounters" on encounters;
create policy "Allow anon read write encounters"
  on encounters for all to anon using (true) with check (true);

-- Audit log: allow anon to SELECT, INSERT
alter table audit_log enable row level security;
drop policy if exists "Allow anon read write audit_log" on audit_log;
create policy "Allow anon read write audit_log"
  on audit_log for all to anon using (true) with check (true);

-- Allow all authenticated roles (nursing, provider, admin) to see and update all visits and patients.
-- Run after auth-scope-created-by.sql if you use created_by scoping.
-- Without this, users only see rows where created_by = their user id.

-- Patients: any authenticated user can read and update all (in addition to "Users own patients").
drop policy if exists "Admins read all patients" on patients;
drop policy if exists "Authenticated read all patients" on patients;
create policy "Authenticated read all patients"
  on patients for select to authenticated
  using (true);

drop policy if exists "Admins update all patients" on patients;
drop policy if exists "Authenticated update all patients" on patients;
create policy "Authenticated update all patients"
  on patients for update to authenticated
  using (true)
  with check (true);

-- Encounters: any authenticated user can read and update all (in addition to "Users own encounters").
drop policy if exists "Admins read all encounters" on encounters;
drop policy if exists "Authenticated read all encounters" on encounters;
create policy "Authenticated read all encounters"
  on encounters for select to authenticated
  using (true);

drop policy if exists "Admins update all encounters" on encounters;
drop policy if exists "Authenticated update all encounters" on encounters;
create policy "Authenticated update all encounters"
  on encounters for update to authenticated
  using (true)
  with check (true);

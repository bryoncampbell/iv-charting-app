-- Allow all authenticated roles (nursing, provider, admin) to see, create, and update all visits and patients.
-- Run after auth-scope-created-by.sql if you use created_by scoping.
-- Without this, users only see rows where created_by = their user id.

-- Patients: any authenticated user can read, insert, and update all.
drop policy if exists "Admins read all patients" on patients;
drop policy if exists "Authenticated read all patients" on patients;
create policy "Authenticated read all patients"
  on patients for select to authenticated
  using (true);

drop policy if exists "Authenticated insert all patients" on patients;
create policy "Authenticated insert all patients"
  on patients for insert to authenticated
  with check (true);

drop policy if exists "Admins update all patients" on patients;
drop policy if exists "Authenticated update all patients" on patients;
create policy "Authenticated update all patients"
  on patients for update to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated delete all patients" on patients;
create policy "Authenticated delete all patients"
  on patients for delete to authenticated
  using (true);

-- Encounters: any authenticated user can read, insert, update, and delete all.
drop policy if exists "Admins read all encounters" on encounters;
drop policy if exists "Authenticated read all encounters" on encounters;
create policy "Authenticated read all encounters"
  on encounters for select to authenticated
  using (true);

drop policy if exists "Authenticated insert all encounters" on encounters;
create policy "Authenticated insert all encounters"
  on encounters for insert to authenticated
  with check (true);

drop policy if exists "Admins update all encounters" on encounters;
drop policy if exists "Authenticated update all encounters" on encounters;
create policy "Authenticated update all encounters"
  on encounters for update to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated delete all encounters" on encounters;
create policy "Authenticated delete all encounters"
  on encounters for delete to authenticated
  using (true);

-- Audit log: allow authenticated users to read, insert, and delete (for Reset Demo Data).
drop policy if exists "Authenticated read all audit_log" on audit_log;
create policy "Authenticated read all audit_log"
  on audit_log for select to authenticated
  using (true);

drop policy if exists "Authenticated insert all audit_log" on audit_log;
create policy "Authenticated insert all audit_log"
  on audit_log for insert to authenticated
  with check (true);

drop policy if exists "Authenticated delete all audit_log" on audit_log;
create policy "Authenticated delete all audit_log"
  on audit_log for delete to authenticated
  using (true);

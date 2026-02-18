-- Enable Realtime for the encounters table (Phase 3).
-- Run in Supabase SQL Editor so the Visits page can subscribe to live changes.
-- Safe to run multiple times: only adds the table if not already in the publication.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'encounters'
  ) then
    alter publication supabase_realtime add table encounters;
  end if;
end $$;

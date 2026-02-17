-- Enable Realtime for the encounters table (Phase 3).
-- Run once in Supabase SQL Editor so the Visits page can subscribe to live changes.
-- See: Database → Replication in Supabase Dashboard, or run this.

alter publication supabase_realtime add table encounters;

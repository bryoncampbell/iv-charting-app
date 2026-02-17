-- Shared visit-summary links (for Vercel/serverless).
-- Run in Supabase SQL Editor so "Share link" / "Text link" work across instances.

create table if not exists share_summaries (
  token text primary key,
  payload jsonb not null,
  created_at timestamptz default now()
);

create index if not exists share_summaries_created_at_idx on share_summaries (created_at desc);

-- RLS: anon can insert (create link) and select (read by token)
alter table share_summaries enable row level security;
drop policy if exists "Allow anon read write share_summaries" on share_summaries;
create policy "Allow anon read write share_summaries"
  on share_summaries for all to anon using (true) with check (true);

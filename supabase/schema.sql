-- IV Charting App – Supabase schema (Phase 2)
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query) after creating your project.

-- Patients (snake_case columns; app will map to camelCase)
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  dob date not null,
  phone text,
  cell_phone text,
  email text,
  street_address text,
  city text,
  state text,
  zip_code text,
  mailing_list_agreement boolean default false,
  license_photo text,
  allergies jsonb default '[]',
  current_medications jsonb default '[]',
  past_medical_history jsonb default '[]',
  created_at timestamptz default now()
);

-- Encounters (visits)
create table if not exists encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null,
  patient_name text,
  date text,
  time text,
  revenue numeric,
  treatment text,
  notes text,
  intake jsonb,
  vitals jsonb,
  iv_access jsonb,
  administration jsonb,
  provider_note jsonb,
  discharge jsonb,
  addenda jsonb,
  -- Optional signing / workflow fields
  location text,
  protocol_name text,
  nursing_signed_at timestamptz,
  nursing_signed_by text,
  provider_signed_at timestamptz,
  provider_signed_by text,
  declined_to_treat_at timestamptz,
  declined_to_treat_by text,
  declined_to_treat_reason text,
  decline_acknowledged_at timestamptz,
  decline_acknowledged_by text,
  cancelled_at timestamptz,
  cancelled_by text,
  cancellation_reason text
);

create index if not exists encounters_patient_id_idx on encounters (patient_id);
create index if not exists encounters_created_at_idx on encounters (created_at desc);
create index if not exists encounters_status_idx on encounters (status);

-- Audit log
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details text
);

create index if not exists audit_log_timestamp_idx on audit_log (timestamp desc);

-- Optional: enable Row Level Security (RLS) later when you add auth
-- alter table patients enable row level security;
-- alter table encounters enable row level security;
-- alter table audit_log enable row level security;

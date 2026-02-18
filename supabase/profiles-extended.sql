-- Extended user profile: first name, last name, DOB, address, and license info for chart signing.
-- Run after profiles.sql. Safe to run multiple times (add column if not exists).

-- Demographics
alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;
alter table profiles add column if not exists date_of_birth date;

-- Contact
alter table profiles add column if not exists phone text;

-- Address
alter table profiles add column if not exists street_address text;
alter table profiles add column if not exists city text;
alter table profiles add column if not exists state text;
alter table profiles add column if not exists zip_code text;

-- License (used when signing chart actions, e.g. "Jane Doe, RN #12345 (TX)")
alter table profiles add column if not exists license_type text;
alter table profiles add column if not exists license_number text;
alter table profiles add column if not exists license_state text;
alter table profiles add column if not exists license_expiry date;

-- Keep display_name for backward compatibility; can be derived from first_name + last_name.

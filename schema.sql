-- Run this SQL in Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)
-- Create the requests table

create table if not exists public.requests (
  id text primary key,
  date text,
  time text,
  author text,
  location text,
  inv_number text,
  equipment_name text,
  model text,
  machine_number text,
  fault_description text,
  status text default 'open',
  downtime_count integer default 0,
  downtime_hours numeric default 0,
  production_item text,
  photos jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  repair_end_date text,
  repair_end_time text
);

-- Allow public access (for simplicity with anon key)
alter table public.requests enable row level security;

-- Allow anonymous access (you can restrict later)
create policy "Allow all on requests"
  on public.requests
  for all
  using (true)
  with check (true);

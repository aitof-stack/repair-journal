// Supabase configuration
// Table is already created. For new setup run this SQL in Supabase SQL Editor:
//   create table public.requests (id text primary key, date text, time text, author text,
//   location text, inv_number text, equipment_name text, model text, machine_number text,
//   fault_description text, status text default 'open', downtime_count int default 0,
//   downtime_hours numeric default 0, production_item text, photos jsonb default '[]',
//   created_at timestamptz default now(), updated_at timestamptz default now(),
//   repair_end_date text, repair_end_time text);
//   alter table public.requests enable row level security;
//   create policy "Allow all" on public.requests for all using (true) with check (true);

window.SUPABASE_URL = 'https://ebgumfttxyrbtsvexnys.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_94z_UvPnnF1lweLoolE45g_1NuW8FLb';

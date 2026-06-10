create table if not exists public.import_history_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references auth.users(id) on delete cascade,
  import_type text not null check (import_type in ('purchase', 'sale')),
  file_name text not null,
  imported_count integer not null default 0,
  error_count integer not null default 0,
  skipped_count integer not null default 0,
  date_range_start date,
  date_range_end date,
  status text check (status in ('success', 'partial', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists import_history_log_org_type_created_idx
  on public.import_history_log (organization_id, import_type, created_at desc);

create index if not exists import_history_log_org_type_range_idx
  on public.import_history_log (organization_id, import_type, date_range_start, date_range_end);

alter table public.import_history_log enable row level security;

drop policy if exists "Users manage own import logs" on public.import_history_log;

create policy "Users manage own import logs"
  on public.import_history_log
  for all
  using (auth.uid() = organization_id)
  with check (auth.uid() = organization_id);

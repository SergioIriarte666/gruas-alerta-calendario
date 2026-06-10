create table if not exists public.import_rut_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references auth.users(id) on delete cascade,
  import_type text not null check (import_type in ('purchase', 'sale')),
  source_rut text not null,
  source_name text not null,
  resolution text not null check (resolution in ('create', 'assign', 'ignore')),
  mapped_entity_id uuid,
  mapped_entity_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, import_type, source_rut)
);

create index if not exists import_rut_mappings_org_type_idx
  on public.import_rut_mappings (organization_id, import_type);

alter table public.import_rut_mappings enable row level security;

drop policy if exists "Users manage own mappings" on public.import_rut_mappings;

create policy "Users manage own mappings"
  on public.import_rut_mappings
  for all
  using (auth.uid() = organization_id)
  with check (auth.uid() = organization_id);

create or replace function public.set_import_rut_mappings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_import_rut_mappings_updated_at on public.import_rut_mappings;

create trigger set_import_rut_mappings_updated_at
  before update on public.import_rut_mappings
  for each row
  execute function public.set_import_rut_mappings_updated_at();

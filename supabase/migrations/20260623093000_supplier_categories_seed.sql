create extension if not exists pgcrypto;

create table if not exists public.supplier_categories (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  name text not null,
  description text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id)
);

create unique index if not exists supplier_categories_name_key on public.supplier_categories(name);
create unique index if not exists supplier_categories_label_key on public.supplier_categories(label);

insert into public.supplier_categories (label, name, description, is_active)
values
  ('Combustible', 'combustible', null, true),
  ('Repuestos', 'repuestos', null, true),
  ('Ferretería', 'ferreteria', null, true),
  ('Neumáticos', 'neumaticos', null, true),
  ('Mantención', 'mantencion', null, true),
  ('Servicios', 'servicios', null, true),
  ('Oficina', 'oficina', null, true),
  ('Otros', 'otros', null, true)
on conflict (name) do nothing;

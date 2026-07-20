-- Control de tesorería F29: facturas cuyo IVA débito fiscal ya fue apartado.
-- Es un registro informativo/manual (no altera invoices). Un check = una fila.
create table if not exists public.iva_f29_separations (
  invoice_id uuid primary key references public.invoices(id) on delete cascade,
  separated_at timestamptz not null default now(),
  separated_by uuid references public.profiles(id)
);

alter table public.iva_f29_separations enable row level security;

drop policy if exists iva_f29_separations_select on public.iva_f29_separations;
drop policy if exists iva_f29_separations_insert on public.iva_f29_separations;
drop policy if exists iva_f29_separations_delete on public.iva_f29_separations;

-- Lectura: personal interno (admin / operador / visor). El F29 no es dato de cliente.
create policy iva_f29_separations_select on public.iva_f29_separations
  for select to authenticated
  using (
    is_admin_user_safe()
    or has_role((select auth.uid()), 'operator'::app_role)
    or has_role((select auth.uid()), 'viewer'::app_role)
  );

-- Escritura: admin y operador. El visor es solo lectura.
create policy iva_f29_separations_insert on public.iva_f29_separations
  for insert to authenticated
  with check (
    is_admin_user_safe()
    or has_role((select auth.uid()), 'operator'::app_role)
  );

create policy iva_f29_separations_delete on public.iva_f29_separations
  for delete to authenticated
  using (
    is_admin_user_safe()
    or has_role((select auth.uid()), 'operator'::app_role)
  );

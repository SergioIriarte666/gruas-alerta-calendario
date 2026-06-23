create extension if not exists unaccent;

do $$
declare
  otros_id uuid;
begin
  select id into otros_id
  from public.supplier_categories
  where name = 'otros'
  limit 1;

  if otros_id is null then
    raise exception 'No existe la categoría de proveedor "otros" en public.supplier_categories';
  end if;

  update public.inventory_suppliers
  set category = otros_id::text
  where category is null or btrim(category) = '';

  update public.inventory_suppliers
  set category = otros_id::text
  where lower(unaccent(btrim(category))) in (
    'general',
    'generales',
    'otro',
    'otros',
    'other',
    'sin categoria',
    'sin categoria definida'
  );

  update public.inventory_suppliers s
  set category = c.id::text
  from public.supplier_categories c
  where lower(unaccent(btrim(s.category))) in (
    lower(unaccent(c.name)),
    lower(unaccent(c.label))
  );

  update public.inventory_suppliers s
  set category = otros_id::text
  where s.category ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and not exists (
      select 1
      from public.supplier_categories c
      where c.id::text = s.category
    );
end $$;

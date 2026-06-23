alter table public.inventory_suppliers
add column if not exists default_product_service text;

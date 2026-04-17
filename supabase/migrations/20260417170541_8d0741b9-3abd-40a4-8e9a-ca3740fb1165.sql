UPDATE public.inventory_items
SET sku = 'SKU-' || to_char(now(),'YYYYMMDD') || '-' ||
          upper(substr(md5(id::text || random()::text), 1, 4))
WHERE (sku IS NULL OR sku = '') AND is_active = true;
UPDATE public.inventory_movements
SET movement_date = (DATE '2026-04-17' + TIME '11:40:00') AT TIME ZONE 'America/Santiago'
WHERE id IN (
  'e45dac4a-c76c-4f61-8c97-6220c387bad6',
  '92ada6b2-11b6-4bb4-9cc2-c1c64e651164'
);
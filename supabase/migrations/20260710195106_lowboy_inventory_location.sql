-- Bodega separada para LowBoy Chile SpA: hasta ahora toda compra con
-- consumo inmediato (entrada+salida en inventory_movements) se resolvía
-- contra la primera ubicación activa (Bodega Principal, de G5N), por lo
-- que los gastos LowBoy quedaban excluidos del sync de bodega a propósito
-- (ver useXmlCostUpload.ts). Con esta ubicación propia, LowBoy pasa a
-- trackear su propio stock de herramientas/insumos sin mezclarse con G5N.
insert into public.inventory_locations (name, code, description, is_active)
values (
  'Bodega LowBoy',
  'LB001',
  'Bodega de herramientas e insumos de LowBoy Chile SpA',
  true
)
on conflict (code) do nothing;

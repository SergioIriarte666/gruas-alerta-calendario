-- Agrega columna `source` para distinguir registros importados como histórico
-- de los creados normalmente en el sistema. Usado por el módulo Finanzas / Históricos
-- para filtrar por origen (Todos / Históricos / Sistema).

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'sistema';

ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'sistema';

-- Backfill de ventas: única señal disponible hoy es el prefijo de folio usado por
-- el importador histórico (HIST-F/HIST-NC/HIST-ND) o el texto fijo en notes.
UPDATE public.invoices
SET source = 'historico'
WHERE folio LIKE 'HIST-%' OR notes LIKE 'Importación historial%';

-- supplier_invoices: no existe ninguna señal en los registros existentes para
-- distinguir histórico de sistema (el import histórico de compras nunca marcó
-- origen). Quedan todos en 'sistema' por defecto; limitación conocida y aceptada.
-- A partir de esta migración, el flujo de importación histórica de compras
-- setea explícitamente source = 'historico' en los nuevos inserts.

COMMENT ON COLUMN public.invoices.source IS
  'Origen del registro: ''sistema'' (creado en la app) o ''historico'' (importado vía Histórico de Ventas). Backfill inicial basado en folio LIKE ''HIST-%'' o notes.';

COMMENT ON COLUMN public.supplier_invoices.source IS
  'Origen del registro: ''sistema'' (creado en la app) o ''historico'' (importado vía Histórico de Compras). Sin backfill posible para registros previos a esta migración (no existía marcador de origen).';

CREATE INDEX IF NOT EXISTS idx_invoices_source ON public.invoices(source);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_source ON public.supplier_invoices(source);

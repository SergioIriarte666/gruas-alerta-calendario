BEGIN;

-- Cuadratura SII (ventas): las notas de crédito del RCV deben poder asociarse
-- al folio de la factura que referencian. El CSV de ventas del SII trae
-- "Tipo Docto. Referencia" y "Folio Docto. Referencia"; hasta ahora el parser
-- las descartaba y no había dónde guardarlas. Columnas opcionales: los CSV de
-- compras y los registros históricos quedan en NULL sin afectar la dedupe
-- (content_hash no las incluye).
ALTER TABLE public.sii_rcv_records
  ADD COLUMN ref_doc_type integer,
  ADD COLUMN ref_folio    bigint;

COMMENT ON COLUMN public.sii_rcv_records.ref_doc_type IS
  'Tipo Docto. Referencia del CSV del SII (p.ej. 33 en una nota de crédito que anula una factura). NULL si el CSV no lo trae.';
COMMENT ON COLUMN public.sii_rcv_records.ref_folio IS
  'Folio Docto. Referencia del CSV del SII: folio del documento que esta fila referencia (usado por la Cuadratura SII para asociar notas de crédito). NULL si el CSV no lo trae.';

COMMIT;

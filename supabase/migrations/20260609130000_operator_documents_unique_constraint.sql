BEGIN;

-- Agregar constraint UNIQUE en (operator_id, document_type)
-- requerida por el upsert con onConflict: 'operator_id,document_type'
-- en useOperatorDocuments.ts
ALTER TABLE public.operator_documents
  ADD CONSTRAINT operator_documents_operator_id_document_type_key
  UNIQUE (operator_id, document_type);

COMMIT;

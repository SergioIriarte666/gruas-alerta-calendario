BEGIN;

ALTER TABLE public.business_documents
  DROP CONSTRAINT IF EXISTS business_documents_category_check;

ALTER TABLE public.business_documents
  ADD CONSTRAINT business_documents_category_check CHECK (
    category IN (
      'contratos',
      'permisos',
      'seguros',
      'documentos_legales',
      'documentos_vehiculos',
      'documentos_operadores',
      'proveedores',
      'clientes',
      'facturas_y_respaldo',
      'importaciones',
      'otros'
    )
  );

COMMIT;

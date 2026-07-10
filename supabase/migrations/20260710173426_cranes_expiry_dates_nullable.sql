-- Los equipos sin documentos chilenos (ej. lowboys importados sin patente/
-- permiso de circulacion chileno) no tienen estas fechas. El cliente ya
-- normaliza "" a null antes de enviar; la columna debe aceptar null.
alter table public.cranes
  alter column circulation_permit_expiry drop not null,
  alter column insurance_expiry drop not null,
  alter column technical_review_expiry drop not null;

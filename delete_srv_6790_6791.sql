-- Elimina por completo SRV-6790 y SRV-6791, incluidas inspecciones (con sus fotos en BD)
-- y los objetos de Storage (fotos + PDFs) asociados a esos services.id.
-- Ejecutar dentro de una transacción para poder hacer rollback si algo no calza.

begin;

-- IDs de los servicios a eliminar
-- SRV-6790 -> 2b25b510-d0df-4a85-87f9-2789b30e8642
-- SRV-6791 -> a7c82f15-1ecd-498e-8757-83baafeb8773

-- 1) Objetos en Storage (fotos y PDFs de inspección)
delete from storage.objects
where bucket_id in ('inspection-photos', 'inspection-pdfs')
  and (
    name like '2b25b510-d0df-4a85-87f9-2789b30e8642/%'
    or name like 'a7c82f15-1ecd-498e-8757-83baafeb8773/%'
  );

-- 2) Filas dependientes en tablas con FK a services.id
delete from inspections
where service_id in ('2b25b510-d0df-4a85-87f9-2789b30e8642', 'a7c82f15-1ecd-498e-8757-83baafeb8773');

delete from service_resources
where service_id in ('2b25b510-d0df-4a85-87f9-2789b30e8642', 'a7c82f15-1ecd-498e-8757-83baafeb8773');

delete from service_change_history
where service_id in ('2b25b510-d0df-4a85-87f9-2789b30e8642', 'a7c82f15-1ecd-498e-8757-83baafeb8773');

-- Tablas verificadas sin filas para estos servicios (incluidas por completitud,
-- no deberían borrar nada): calendar_events, closure_services, costs,
-- invoice_services, service_cash_receipts, service_costs,
-- service_update_error_logs, trip_estimates, service_items.
delete from calendar_events where service_id in ('2b25b510-d0df-4a85-87f9-2789b30e8642', 'a7c82f15-1ecd-498e-8757-83baafeb8773');
delete from closure_services where service_id in ('2b25b510-d0df-4a85-87f9-2789b30e8642', 'a7c82f15-1ecd-498e-8757-83baafeb8773');
delete from costs where service_id in ('2b25b510-d0df-4a85-87f9-2789b30e8642', 'a7c82f15-1ecd-498e-8757-83baafeb8773');
delete from invoice_services where service_id in ('2b25b510-d0df-4a85-87f9-2789b30e8642', 'a7c82f15-1ecd-498e-8757-83baafeb8773');
delete from service_cash_receipts where service_id in ('2b25b510-d0df-4a85-87f9-2789b30e8642', 'a7c82f15-1ecd-498e-8757-83baafeb8773');
delete from service_costs where service_id in ('2b25b510-d0df-4a85-87f9-2789b30e8642', 'a7c82f15-1ecd-498e-8757-83baafeb8773');
delete from service_update_error_logs where service_id in ('2b25b510-d0df-4a85-87f9-2789b30e8642', 'a7c82f15-1ecd-498e-8757-83baafeb8773');
delete from trip_estimates where service_id in ('2b25b510-d0df-4a85-87f9-2789b30e8642', 'a7c82f15-1ecd-498e-8757-83baafeb8773');
delete from service_items where service_id in ('2b25b510-d0df-4a85-87f9-2789b30e8642', 'a7c82f15-1ecd-498e-8757-83baafeb8773');

-- Por si algún otro servicio quedó referenciando a estos como "relacionado"
update services set related_service_id = null
where related_service_id in ('2b25b510-d0df-4a85-87f9-2789b30e8642', 'a7c82f15-1ecd-498e-8757-83baafeb8773');

-- 3) Finalmente, los services
delete from services
where id in ('2b25b510-d0df-4a85-87f9-2789b30e8642', 'a7c82f15-1ecd-498e-8757-83baafeb8773');

commit;

-- Verificación post-borrado (debe devolver 0 filas en todas)
-- select * from services where folio in ('SRV-6790','SRV-6791');
-- select * from inspections where service_id in ('2b25b510-d0df-4a85-87f9-2789b30e8642','a7c82f15-1ecd-498e-8757-83baafeb8773');
-- select * from storage.objects where name like '2b25b510-d0df-4a85-87f9-2789b30e8642/%' or name like 'a7c82f15-1ecd-498e-8757-83baafeb8773/%';

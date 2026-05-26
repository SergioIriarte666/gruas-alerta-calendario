## Problema

En la pestaña "Servicios" del modal de facturas algunas facturas muestran "No hay servicios asociados" aunque sí tengan cierres asociados (ej. FACT-4235 → CIE-275). La causa es que la tabla `invoice_services` está vacía para esos registros, mientras que `invoice_closures` sí tiene el vínculo al cierre y `closure_services` contiene los servicios del cierre.

Diagnóstico en BD:
- 433 facturas en total
- 141 facturas sin filas en `invoice_services`
- **140 de esas 141** tienen al menos un cierre en `invoice_closures` → se pueden reconstruir automáticamente.

## Solución (un único migration SQL idempotente)

Recorrer la cadena `invoices → invoice_closures → closure_services → services` e insertar en `invoice_services` los pares `(invoice_id, service_id)` faltantes. Sin tocar nada más (no se modifican estados de facturas, servicios ni cierres).

```sql
INSERT INTO public.invoice_services (invoice_id, service_id)
SELECT DISTINCT ic.invoice_id, cs.service_id
FROM public.invoice_closures ic
JOIN public.closure_services cs ON cs.closure_id = ic.closure_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoice_services isv
   WHERE isv.invoice_id = ic.invoice_id
     AND isv.service_id = cs.service_id
);
```

### Cobertura esperada
- Repuebla las 140 facturas que tienen cierre pero no servicios vinculados.
- Queda 1 factura sin cierre y sin servicios — esa no se puede recuperar automáticamente (requiere vinculación manual desde la UI).

### Lo que NO hace (intencional)
- No modifica `services.status`, `services.invoice_folio` ni `services.invoice_numero_fiscal`.
- No crea ni borra cierres ni facturas.
- No afecta facturas que ya tengan `invoice_services` poblado (los `NOT EXISTS` lo evitan).
- Es seguro re-ejecutarla.

### Verificación post-migración
Después de correrla, consultaremos:
```sql
SELECT COUNT(*) FROM invoices i
WHERE NOT EXISTS (SELECT 1 FROM invoice_services s WHERE s.invoice_id = i.id);
```
Debería bajar de 141 a 1.

¿Aplico la migración?

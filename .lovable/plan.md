## Problema

En el PDF (y también en la tabla UI) de **Historial Completo del Vehículo**, las columnas **"N° Fiscal"** y **"Factura"** aparecen como `-` / `Sin factura`, aun cuando el servicio sí tiene número fiscal asignado (el modal de Detalle del Servicio muestra `Número Fiscal: 4034`).

## Causa raíz

`src/hooks/useVehicleFullHistory.ts` resuelve el número fiscal **solo a través del join `invoice_services → invoices.numero_fiscal`**. Si el servicio quedó marcado como facturado pero el vínculo en `invoice_services` no existe (caso muy frecuente: facturación rápida, cierres antiguos, importaciones), el hook no encuentra `relatedInvoice` y la tabla cae al fallback `-` / `Sin factura`.

La tabla `services` ya almacena `invoice_numero_fiscal` (y `invoice_folio`) de forma denormalizada — ese es el dato que usa el `ServiceDetailsModal` y por eso ahí sí se ve `4034`. El hook del historial no lo lee.

## Solución

Trabajo solo de lectura / presentación, sin tocar lógica de negocio.

1. **`src/hooks/useVehicleFullHistory.ts`**
   - Agregar `invoice_numero_fiscal, invoice_folio` al `select` de `services`.
   - Al construir cada registro:
     - Si existe `invoice` (vía `invoice_services`) → seguir igual.
     - Si **no** existe pero el servicio tiene `invoice_numero_fiscal` o `invoice_folio` → construir un `relatedInvoice` "ligero" con los datos denormalizados (`id: null`, `folio: invoice_folio ?? '-'`, `date: service_date`, `status: service.status === 'invoiced' ? 'sent' : 'pending'`, `value: serviceValue`, `numeroFiscal: invoice_numero_fiscal`).
   - Recalcular `totalInvoices` considerando también estos casos para que la métrica "Facturas" del resumen sea coherente.

2. **`src/utils/pdf/vehicleHistoryPdfGenerator.ts`**
   - No necesita cambios estructurales: al venir `relatedInvoice` poblado, las columnas "N° Fiscal" y "Factura" se rellenan automáticamente.
   - Pequeño ajuste de la columna "Factura": mostrar `numeroFiscal` y, si no hay, el `folio` interno (en vez de `Pendiente`) para casos donde solo exista folio.

3. **`src/components/vehicles/VehicleFullHistory.tsx`** (UI tabla del modal)
   - Mismo beneficio automático; verificar que el badge "Sin factura" ya no aparezca cuando hay número fiscal.

## Archivos a modificar

- `src/hooks/useVehicleFullHistory.ts`
- `src/utils/pdf/vehicleHistoryPdfGenerator.ts` (ajuste menor del fallback de texto)
- `src/components/vehicles/VehicleFullHistory.tsx` (sin cambios funcionales, solo verificación)

## Validación

- Buscar la patente `VGLB-42` en el modal: la fila SRV-6335 debe mostrar `N° Fiscal: 4034` y `Factura: 4034` (o el folio interno) en lugar de `-` / `Sin factura`.
- Exportar PDF y confirmar las mismas columnas pobladas.
- El contador "Facturas" del resumen debe pasar de `0` a `1` (o el número correcto).
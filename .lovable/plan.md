## Problema

En el modal de edición de servicios, al activar el toggle **"Marcar costos como pagados al crear"**, los costos se crean correctamente pero aparecen como **NO pagados** en el módulo de Costos.

## Causa raíz

El flag `markCostsPaidOnCreate` solo se aplica en el flujo de **creación** de servicios (`createServiceMutation` en `useServiceManager.ts`, líneas 393 y 450). En el flujo de **actualización** (`updateServiceMutation`, líneas 806-817), cuando se insertan los costos del servicio, el objeto mapeado **no incluye el campo `payment_date`**, por lo que siempre queda en `null` (no pagado), sin importar el estado del toggle.

Confirmado en BD: los dos costos más recientes (servicio `f28f0cf5...`, creados hoy a las 15:19 y 15:22 mediante edición) tienen `payment_date = NULL`, mientras que los costos creados directamente al crear el servicio sí tienen `payment_date` con la fecha del servicio.

## Solución

En `src/hooks/services/useServiceManager.ts`, dentro del `updateServiceMutation`, en el bloque que construye `serviceCosts` (≈línea 806):

1. Agregar el campo `payment_date` aplicando la misma lógica que en `createService`:
   ```ts
   payment_date: serviceData.markCostsPaidOnCreate
     ? (currentService?.service_date || serviceData.serviceDate || getTodayLocal())
     : null,
   ```

2. (Mejora consistente) Propagar también los campos opcionales que ya se persisten en creación pero se pierden al editar: `supplier_id`, `operator_id`, `document_type`, `document_number`, `location_text`, `other_reason`, `purchase_quantity`, `purchase_unit_cost`, `immediate_consumption`. Esto evita que al editar un servicio se pierdan datos del costo capturados en el formulario.

No se requieren cambios de UI ni de esquema. El campo ya existe en `formData` y se envía al hook; solo falta usarlo en el path de update.

## Archivos a modificar

- `src/hooks/services/useServiceManager.ts` — ajustar el mapeo de `serviceCosts` en `updateServiceMutation`.

## Verificación

1. Editar un servicio existente, activar el toggle, agregar/modificar costos y guardar.
2. Abrir el módulo Costos y confirmar que los costos del servicio aparecen como pagados (con fecha de pago = fecha del servicio).
3. Repetir con el toggle desactivado y confirmar que quedan como no pagados.

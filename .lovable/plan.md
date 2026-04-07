
# Plan: Corregir visibilidad y sincronización de costos en servicios tercerizados

## Problema detectado
Sí hay una inconsistencia real.

Según el código actual:

1. El modal de detalles (`ServiceDetailsModal`) no muestra en ninguna parte:
   - proveedor tercerizado
   - costo del tercero
   - notas del tercero

2. La pestaña **Costos** y el bloque **Finanzas** dependen de que exista un registro real en `costs`.
   - Si ese costo automático no se creó al guardar, el modal muestra `Total Costos = 0`.
   - Hoy, en edición, la lógica solo **actualiza** un costo tercerizado existente; si no existe, **no lo recrea**.

3. El hook mejorado (`useEnhancedServiceDetails`) sí carga `outsourcedProviderId`, `outsourcedCost` y `outsourcedNotes` desde `services`, pero esos datos no se renderizan en el modal.

## Qué voy a corregir

### 1. Mostrar datos tercerizados en el modal del servicio
En `src/components/services/ServiceDetailsModal.tsx`:
- Agregar una sección visible dentro de “Detalles” o “Finanzas” para servicios tercerizados con:
  - Proveedor tercero
  - Costo tercero
  - Notas del servicio tercero
- Mantener el mismo lenguaje visual del módulo de Costos.

Importante:
- El nombre del proveedor no puede mostrarse solo con `outsourcedProviderId`, así que hay que traer también la relación del proveedor o resolver su nombre antes de renderizar.

### 2. Completar datos del proveedor en la carga del servicio
En `src/hooks/useEnhancedServiceDetails.ts`:
- Extender la consulta del servicio para traer la relación con `inventory_suppliers` asociada a `outsourced_provider_id`.
- Exponer ese nombre en el objeto retornado para usarlo en el modal y PDF si corresponde.

### 3. Hacer robusta la sincronización del costo tercerizado
En `src/hooks/services/useServiceManager.ts`:
- Mantener intacta la lógica actual de creación/edición general.
- Ajustar solo el bloque de sincronización outsourced para que:
  - si existe el costo tercerizado, lo actualice;
  - si no existe y el servicio tiene proveedor + monto > 0, lo cree automáticamente.
- Si el proveedor o monto se eliminan, definir una conducta segura:
  - actualizar a 0 / null o eliminar el costo tercerizado asociado, según el patrón ya usado en el módulo.

Objetivo: que `costs` vuelva a ser la fuente de verdad financiera sin depender de que la creación inicial haya salido perfecta.

### 4. Asegurar que el tab “Costos” refleje el tercero
En `src/components/services/ServiceCostsSection.tsx` y flujo relacionado:
- Verificar que el costo tercerizado no quede excluido por la lógica de filtros.
- Si existe en `costs`, debe aparecer como cualquier otro costo del servicio.
- Si por timing todavía no cargó, el modal igualmente mostrará los datos tercerizados desde el servicio como respaldo visual en “Detalles”.

### 5. Revisar PDF del detalle del servicio
Como el usuario indicó que tampoco lo ve en el modal, conviene dejar consistente también el exportador:
- revisar `src/utils/pdf/serviceDetailsPdfGenerator` y/o el hook del PDF;
- incluir proveedor/costo tercerizado en el PDF del detalle del servicio cuando aplique.

## Archivos a modificar
- `src/components/services/ServiceDetailsModal.tsx`
- `src/hooks/useEnhancedServiceDetails.ts`
- `src/hooks/services/useServiceManager.ts`
- Posiblemente `src/types/serviceDetails.ts` o `src/types/index.ts` si hace falta tipar el proveedor tercerizado expandido
- Posiblemente `src/utils/pdf/serviceDetailsPdfGenerator.ts`

## Impacto esperado
Después del cambio:
- el modal mostrará explícitamente el proveedor y costo del tercero;
- el tab Costos dejará de quedar vacío en casos donde faltó recrear el costo automático;
- los totales financieros del servicio quedarán alineados con lo ingresado;
- no se tocará la lógica no relacionada ni el flujo general de costos que ya funciona.

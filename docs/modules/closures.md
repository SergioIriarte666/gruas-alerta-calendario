# closures

## Resumen
Modulo de **cierres** para agrupar servicios por cliente o periodo y preparar la facturacion posterior.

La implementacion actual combina listado, wizard por pasos, seleccion enriquecida de servicios, detalle y confirmacion que navega a facturas al terminar la creacion.

## Entrypoints vigentes
- Pagina: [Closures](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Closures.tsx)
- Componentes: [src/components/closures](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/closures)

## Ruta
- `/closures`

## Arquitectura actual de la pagina
La pagina principal se apoya en:

- `ClosuresHeader`
- `ClosuresTable`
- `ClosuresGroupedView`
- `ClosuresStats`
- `ClosureForm`
- `ClosureDetailsModal`
- `InvoiceConfirmationDialog`
- confirmaciones de borrado y tooling auxiliar

El formulario actual funciona como wizard y usa:

- `EnhancedServicesSelector`
- `ClosureSummaryPanel`
- `ClosureFormStepNavigation`

## Hooks y servicios clave
- `useServiceClosures`
- `useClosureData`
- `useClosureOperations`
- `useServicesForClosures`
- `useClosuresForInvoices`

Capacidad existente pero no central en la pagina actual:
- `useClosureAutomation`

## Datos y dependencias principales
Tablas y relaciones frecuentes:

- `service_closures`
- `closure_services`
- `invoice_closures`
- relaciones con `services`, `clients` e `invoices`

## Flujos vigentes

### 1. Listado y detalle
- La pagina muestra cierres en tabla o agrupados.
- El detalle y el borrado forman parte del flujo principal visible.

### 2. Creacion por pasos
- La creacion no es un formulario plano.
- Usa seleccion enriquecida de servicios, resumen y navegacion por pasos.
- La seleccion actual soporta busqueda global, deteccion de procesados y apoyo para completar servicios.

### 3. Transicion a facturas
- Al crear un cierre se abre una confirmacion.
- Luego se navega a `/invoices` con `preselectedClosureId` para continuar el flujo.

### 4. Reportes del modulo
- Existen componentes y estado para reporte de cierre.
- Hoy ese flujo no aparece claramente disparado desde la UI principal, por lo que no debe documentarse como experiencia central plenamente expuesta.

## Consideraciones de mantenimiento
- Documentar el flujo real de confirmacion hacia facturas despues de crear un cierre.
- Si se cambia la seleccion de servicios, revisar `useServicesForClosures` y su logica de servicios procesados o pendientes.
- Distinguir entre capacidades existentes del repositorio y acciones realmente visibles en la pagina.

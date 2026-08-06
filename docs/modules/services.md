# services

## Resumen
Modulo central de **servicios** para creacion, edicion, seguimiento operativo, asignacion de recursos, evidencia, costos asociados y relacion con cierres/facturacion.

Aunque conceptualmente sigue siendo el nucleo del producto, la pagina actual es bastante mas rica que una simple tabla con formulario: incluye pipeline, operaciones batch, navegacion contextual y flujos de apertura desde otros modulos.

## Entrypoints vigentes
- Pagina: [Services](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Services.tsx)
- Componentes: [src/components/services](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/services)
- Hook orquestador de pagina: `useServicesPage`

## Ruta
- `/services`

## Arquitectura actual de la pagina
La pagina real se apoya en:

- `ServicesHeader`
- `ServiceFilters`
- `ServicesTable`
- `ServicesMobileView`
- `ServicesPipelineView`
- `ServicesDialogs`
- `ServiceBatchActionBar`
- `ServiceBatchUpdateModal`
- `ServiceDeleteConfirmDialog`
- `AppPagination`

Notas relevantes:
- `useServicesPage` concentra gran parte del estado, filtros, apertura de dialogos y acciones batch.
- `EnhancedCSVUploadServices` es el flujo de carga masiva actualmente conectado desde la UI principal.
- `CSVUploadServices` puede existir en el repositorio, pero no es la superficie principal de `/services`.

## Hooks y servicios clave
- `useServicesPage`
- `useServicesPendingExport`
- `useServices`
- `useServiceQueries`
- `useServiceManager`
- `useUpdateServicesBatch`

Hooks o tooling secundarios:
- `useServiceLiberation` no es el hook principal de la pagina `/services`; responde a tooling/admin complementario.

## Datos y dependencias principales
Tablas y relaciones frecuentes:

- `services`
- `service_resources`
- relaciones con `clients`, `cranes`, `operators`
- `costs`
- `inspections`
- `calendar_events`
- `service_closures`
- relaciones con facturacion como `invoice_services`

RPC destacadas:

- `emergency_close_service`
- `force_commission_sync_for_service`

## Flujos vigentes

### 1. Alta y edicion de servicio
- Apertura desde dialogos coordinados por `ServicesDialogs`.
- Puede recibir prefill por navegacion o duplicacion.
- Se integra con clientes, gruas, operadores y costos.

### 2. Tabla, mobile y pipeline
- La misma pagina soporta multiples vistas.
- `ServicesPipelineView` es parte central de la experiencia actual.
- Mobile y escritorio no son flujos separados a nivel de modulo; comparten estado central.

### 3. Flujos contextuales
La pagina puede abrir o filtrarse desde:

- query string como `status` o `future`
- calendario
- inventario mediante `?newSale=true`
- navegacion con `location.state.prefilledData`
- duplicacion de un servicio existente

### 4. Operaciones batch
- seleccion multiple
- actualizacion batch
- cierre masivo
- exportacion de pendientes
- borrado masivo con validacion reforzada por contrasena
- restricciones segun estado o relacion con facturacion

### 5. Detalle y auditoria
- `ServiceDetailsModal` hoy integra mas que una vista basica.
- Incluye historial de cambios, vehiculo e informacion relacionada.
- Puede disparar sincronizacion silenciosa de comisiones.

La pestana **Cambios** se alimenta de `service_change_history` mediante triggers
de base de datos:

- `track_service_changes` registra creacion, eliminacion y cambios de los datos
  operativos, comerciales, vehiculares, de ubicacion, custodia y facturacion del
  servicio.
- El evento de creacion conserva un snapshot de los valores iniciales.
- `track_service_item_changes` registra altas, modificaciones y eliminaciones
  del desglose (`service_items`).
- `track_service_resource_changes` registra altas, bajas, rol, condicion de
  principal y comision de operadores desde `service_resources`, su fuente
  vigente.
- Los cambios se agrupan por `event_id`, muestran autor y fecha, y la UI invalida
  la consulta de historial inmediatamente despues de guardar.

## Consideraciones de mantenimiento
- Si un cambio toca la pagina de servicios, revisar siempre `useServicesPage` antes de asumir que el estado vive en componentes sueltos.
- Documentar por separado los flujos realmente montados en `/services` y tooling o componentes legacy.
- Validar impactos cruzados con calendario, costos, cierres, inspecciones e inventario cuando haya cambios funcionales.

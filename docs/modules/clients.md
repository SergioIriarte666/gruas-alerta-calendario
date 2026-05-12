# clients

## Resumen
Modulo de **clientes** para CRUD, ficha detallada, historial operativo y financiero, metricas y acceso al pipeline VIP.

La pagina actual no es solo una tabla con modal simple: combina listado paginado, acciones batch, modal custom de formulario y detalle por tabs con contadores.

## Entrypoints vigentes
- Pagina: [Clients](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Clients.tsx)
- Componentes: [src/components/clients](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/clients)
- Flujo VIP relacionado: [VipClientPipeline](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/VipClientPipeline.tsx)

## Rutas
- `/clients`
- `/clients/:clientId/pipeline`

## Arquitectura actual de la pagina
La pagina principal se apoya en:

- `ClientsHeader`
- `ClientsTable`
- filtros y vistas mobile
- paginacion con `usePagedClients`
- acciones batch de actualizacion y borrado
- `ClientForm` en modal custom
- `ClientDetailsModal` como detalle vigente

El detalle actual no usa como pieza principal `ClientDetailModal`; la experiencia vigente se centra en `ClientDetailsModal` y `ClientTabsWithCounters`.

## Hooks y servicios clave
- `useClients`
- `usePagedClients`
- `useUpdateClientsBatch`
- `useDeleteClientsBatch`
- `useClientMetrics`
- `useClientServices`
- `useClientInvoices`
- `useClientClosures`
- `useClientRequests`
- `useClientsDashboardMetrics`

Hook secundario o de uso puntual:
- `useClientHistory` no es hoy el hook principal del detalle de cliente.

## Datos y dependencias principales
Tablas y relaciones frecuentes:

- `clients`
- `services`
- `invoices`
- `service_closures` y relaciones de cierres
- solicitudes derivadas desde `services` en estados `pending` o relacionados

## Flujos vigentes

### 1. Listado y mantenimiento
- Alta y edicion de clientes desde modal custom.
- Filtros, paginacion y batch actions desde la pagina principal.
- La UX actual no depende de un `Dialog` simple por fila.

### 2. Detalle por tabs
La ficha vigente agrupa informacion en tabs con contadores para:

- overview
- info
- services
- invoices
- closures
- requests

### 3. Historial del cliente
- Servicios, facturas, cierres y solicitudes se consultan con hooks separados.
- Las solicitudes del cliente hoy salen desde `services`, no desde una tabla independiente de requests.

### 4. Pipeline VIP
- El flujo VIP sigue vigente como extension del modulo cliente.
- Conviene documentarlo como flujo relacionado y no como pieza aislada del dominio.

## Consideraciones de mantenimiento
- Usar `ClientDetailsModal` como referencia principal de la ficha actual.
- Si un cambio toca clientes, revisar tambien servicios, facturas, cierres y pipeline VIP.
- Distinguir entre hooks de detalle vigentes y hooks historicos o secundarios.

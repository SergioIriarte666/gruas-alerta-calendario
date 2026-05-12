# portal

## Resumen
Modulo de **portal cliente** para autoservicio de servicios, solicitud de nuevos trabajos y consulta documental limitada.

La implementacion actual gira principalmente en torno a servicios. La ruta de facturas existe, pero su navegacion esta oculta en el menu y la descarga no aparece como flujo plenamente operativo.

## Entrypoints vigentes
- Layout: [PortalLayout](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/portal/layout/PortalLayout.tsx)
- Paginas: [src/pages/portal](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/portal)
- Componentes: [src/components/portal](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/portal)

## Rutas
- `/portal/dashboard`
- `/portal/services`
- `/portal/request-service`
- `/portal/invoices`

Notas relevantes:
- `/portal/invoices` existe como ruta, pero hoy su acceso no esta visible en el sidebar.
- La descarga de facturas en la vista portal no debe documentarse como flujo plenamente resuelto sin aclaracion.

## Arquitectura actual
La experiencia del portal se apoya en:

- `PortalLayout`
- `PortalDashboard`
- `PortalServices`
- `PortalRequestService`
- `PortalInvoices`
- hooks en `src/hooks/portal/*`

El dashboard actual esta centrado en metricas de servicios; no funciona como un centro financiero amplio.

## Hooks y servicios clave
- `useClientServices`
- `useClientInvoices`
- `useServiceRequest`
- `useServiceTypesForPortal`

Dependencia transversal:
- `UserContext` para resolver `client_id` del usuario autenticado

## Datos y dependencias principales
Tablas y relaciones frecuentes:

- `services`
- `invoices`
- `clients`
- tipos de servicio y campos relacionados

Nota importante:
- El frontend actual resuelve el cliente desde `user.client_id` en contexto, no mediante RPC como flujo principal.

## Flujos vigentes

### 1. Dashboard del cliente
- Hoy se centra en metricas y actividad de servicios.
- No debe documentarse como dashboard financiero completo.

### 2. Consulta de servicios
- La vista soporta filtros por rango de fechas.
- Puede alternar entre vista tabla y grid.
- Incluye exportacion PDF y Excel.

### 3. Solicitud de servicio
- El formulario es dinamico segun el tipo de servicio.
- Puede exigir o mostrar campos como patente, marca o modelo segun configuracion.
- El flujo actual inserta directamente en `services` con estado `pending`, sin crear una entidad separada de request.

### 4. Facturas en portal
- La ruta existe y lista documentos.
- La navegacion esta oculta en el menu actual.
- La descarga no debe asumirse como totalmente operativa sin revisar la UI vigente.

## Consideraciones de mantenimiento
- Documentar el cliente actual desde `UserContext` y `profiles.client_id`, no desde RPC aspiracionales.
- Revisar con cuidado la seguridad del flujo de facturas del portal cuando se actualice esta documentacion.
- Aclarar siempre si una capacidad esta presente como ruta existente o como flujo realmente visible en la navegacion.

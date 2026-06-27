# Manual de Usuario Vigente - TMS Gruas

## Objetivo

Este manual resume el uso funcional vigente de TMS Gruas. Esta orientado a la operacion diaria del sistema y refleja el estado actual de rutas, modulos y flujos visibles para usuarios administrativos, operadores y clientes.

## Que es TMS Gruas

TMS Gruas es una plataforma web para administrar la operacion y las finanzas de una empresa de gruas. El sistema centraliza:

- servicios y calendario operacional
- clientes, gruas, operadores y vehiculos
- inspeccion en terreno por operador
- cierres, facturas y seguimiento de cobros
- costos, inventario, proveedores y cuentas por pagar
- reportes, proyecciones y configuracion administrativa
- portal cliente con branding por empresa, solicitudes, O.C. y facturas
- notificaciones operativas segun configuracion del entorno

## Superficies del sistema

| Superficie | Acceso | Objetivo |
|---|---|---|
| Backoffice administrativo | rutas como `/dashboard`, `/services`, `/clients`, `/invoices`, `/settings` | Operacion, finanzas, activos y administracion |
| App de operador | `/operator` | Gestion de servicios asignados e inspecciones en terreno |
| Portal cliente | `/portal` | Consulta de servicios, envio de ordenes de compra, facturas y solicitud de nuevos servicios |

## Acceso al sistema

### Inicio de sesion

1. Abrir la URL del sistema.
2. Ingresar correo y contrasena.
3. Seleccionar `Iniciar sesion`.
4. Si corresponde, usar recuperacion desde `Olvidaste tu contrasena`.

### Recuperacion de contrasena

- Rutas: `/auth` y `/reset-password`
- El sistema envia un correo de recuperacion.
- En algunos entornos puede existir validacion adicional con captcha o rate limiting.

### Consideraciones de acceso por rol

- `admin` y `viewer` ingresan al backoffice administrativo.
- `operator` ingresa a la app de operador.
- `client` ingresa al portal cliente.
- Un usuario `client` debe estar vinculado a una empresa cliente. Si no lo esta, el portal no se habilita y se muestra un mensaje de acceso pendiente de vinculacion.

## Roles vigentes

| Rol | Alcance |
|---|---|
| `admin` | Control total del backoffice, configuracion, modulos criticos y acciones administrativas |
| `viewer` | Acceso administrativo a modulos operativos y financieros segun permisos visibles |
| `operator` | Acceso a la app de operador para servicios asignados e inspeccion |
| `client` | Acceso restringido al portal cliente de su empresa |

Notas:

- Algunas pantallas del backoffice son exclusivas de `admin`.
- Ademas del rol base, la visibilidad puede limitarse por modulo desde configuracion.

## Navegacion principal

### Rutas administrativas principales

| Modulo | Ruta | Uso principal |
|---|---|---|
| Dashboard | `/dashboard` | Resumen operativo y financiero |
| Perfil | `/profile` | Datos del usuario actual |
| Servicios | `/services` | Gestion integral de servicios |
| Calendario | `/calendar` | Vista temporal de servicios y eventos |
| Cierres | `/closures` | Agrupacion y control previo a facturacion |
| Clientes | `/clients` | Ficha de clientes, historial y branding del portal |
| Gruas | `/cranes` | Flota, mantenimiento, piezas e inventario relacionado |
| Facturas | `/invoices` | Facturacion, pagos y seguimiento de cobros |
| Historico financiero | `/historical` | Consulta financiera historica |
| Proyecciones | `/income-projections` | Aging, flujo esperado y proyeccion |
| Costos | `/costs` | Registro y analisis de costos |
| Cuentas por pagar | `/accounts-payable` | Deudas, cuotas, creditos y seguimiento |
| Calculadora de viajes | `/trip-calculator` | Calculo de ruta, peajes y estimacion |
| Reportes | `/reports` | Exportacion y analisis |
| Proveedores | `/suppliers` | Proveedores, pagos y XML |
| Reporte diario | `/daily-report` | Resumen operativo y financiero diario |
| Inventario | `/inventory` | Catalogo, stock y movimientos |

### Rutas administrativas solo para admin

| Modulo | Ruta | Uso principal |
|---|---|---|
| Operadores | `/operators` | Gestion administrativa de operadores |
| Tipos de servicio | `/service-types` | Catalogo de tipos de servicio |
| Tarifas de servicio | `/service-rates` | Tarifas y reglas operativas |
| Vehiculos | `/vehicles` | Catalogos relacionados a vehiculos |
| Comisiones | `/commissions` | Seguimiento y pago de comisiones |
| Centros de costo | `/cost-centers` | Catalogo para costos y reportes |
| Configuracion | `/settings` | Empresa, zona horaria, sistema, alertas, usuarios e integraciones |
| Entradas rapidas | `/quick-entries` | Captura rapida con apoyo movil y OCR |
| Backup | `/backup` | Herramientas de respaldo |

### Otras rutas relevantes

| Superficie | Ruta |
|---|---|
| App operador | `/operator` |
| Inspeccion operador | `/operator/service/:id/inspection` |
| Portal cliente | `/portal/dashboard`, `/portal/services`, `/portal/purchase-orders`, `/portal/request-service`, `/portal/invoices` |
| Pipeline VIP por cliente | `/clients/:clientId/pipeline` |
| Diagnostico interno | `/performance-test`, `/debug-freeze`, `/connection-test` |

## Dashboard

El dashboard es el punto de entrada del backoffice y concentra:

- metricas operativas y financieras
- alertas y pendientes
- accesos rapidos a modulos frecuentes
- visibilidad general del estado del negocio

Uso recomendado:

- revisar pendientes al iniciar sesion
- validar alertas de documentos, pagos o servicios
- usarlo como hub de navegacion, no como fuente unica de detalle

## Servicios

`/services` es el modulo central del sistema.

### Que permite hacer

- crear y editar servicios
- asignar cliente, grua y operador
- registrar origen, destino, fecha y observaciones
- gestionar estados operativos y comerciales
- duplicar servicios
- descargar documentos asociados
- revisar historial y cambios del servicio
- vincular la operacion con cierres, costos e inspecciones

### Flujo recomendado

1. Crear el servicio con datos minimos correctos.
2. Asignar operador y grua si ya estan definidos.
3. Completar antecedentes operativos y comerciales.
4. Hacer seguimiento desde el listado o el calendario.
5. Usar el modal de detalle para revisar costos, historial y documentos.
6. Cuando aplique, llevar el servicio a cierre y luego a facturacion.

### Consideraciones practicas

- Si el operador esta asignado y la integracion esta habilitada, pueden dispararse notificaciones operativas.
- La referencia visible del vehiculo prioriza el vehiculo trasladado. Si no hay datos validos, el sistema puede mostrar el tipo de servicio para evitar informacion ambigua.
- El historial del servicio es util para auditoria y seguimiento de cambios.

## Calendario

`/calendar` muestra servicios y eventos en vista temporal.

Uso tipico:

- revisar carga del dia o la semana
- detectar conflictos de programacion
- abrir servicios desde la vista calendario
- coordinar operacion, mantenciones y agenda general

## Cierres

`/closures` agrupa servicios para control y posterior facturacion.

### Para que sirve

- consolidar servicios terminados
- revisar consistencia antes de facturar
- separar control operativo del proceso de facturacion

### Buenas practicas

- cerrar solo servicios que ya esten correctamente ejecutados
- validar valores y documentos antes de generar facturas

## Clientes

`/clients` concentra la ficha de clientes y su relacion con el negocio.

Permite:

- crear y editar clientes
- revisar historial de servicios, facturas, cierres y solicitudes
- consultar relacion con facturas
- navegar al pipeline VIP en clientes que lo utilizan
- administrar branding del portal cliente desde el modal de detalle

### Modal de detalle del cliente

El modal de detalle del cliente incluye:

- header con nombre del cliente y logo si existe
- avatar con iniciales como fallback si el cliente aun no tiene logo
- pestañas de `Resumen`, `Info`, `Servicios`, `Facturas`, `Cierres` y `Solicitudes`

### Branding del portal cliente

En la pestana `Info` del modal de cliente se puede cargar el `Logo del portal cliente`.

Comportamiento esperado:

- si existe logo, se muestra en el header del modal y en el sidebar del portal cliente
- si no existe logo, el modal muestra iniciales y el portal usa el branding general o su fallback visual
- el nombre visible del portal puede usar nombre comercial si esta definido; si no, usa el nombre base del cliente

Ruta relacionada:

- pipeline por cliente: `/clients/:clientId/pipeline`

## Gruas

`/cranes` administra la flota.

Incluye normalmente:

- ficha de grua
- metricas operativas
- servicios relacionados
- costos asociados
- mantenciones
- piezas y consumos
- integracion con inventario

## Operadores

### Gestion administrativa

`/operators` permite administrar operadores desde el backoffice:

- alta y edicion
- disponibilidad y datos base
- relacion con servicios y comisiones

### App de operador

`/operator` esta pensada para uso en terreno.

Funciones principales:

- ver servicios asignados
- trabajar por estados operativos
- abrir inspecciones
- registrar evidencia, fotos y firma
- avanzar el flujo hasta completar el trabajo

## Inspeccion de operador

Ruta: `/operator/service/:id/inspection`

La inspeccion es parte formal del flujo operativo y puede incluir:

- datos del servicio
- checklist o formulario
- fotografias
- firma
- generacion de PDF
- transicion de estado del servicio

## Facturas

`/invoices` concentra el flujo de facturacion y seguimiento de cobros.

Permite:

- revisar facturas
- controlar estados de emision y pago
- registrar o aplicar pagos segun el flujo vigente
- analizar saldos y vencimientos
- exportar o revisar documentos asociados

Nota:

- En la practica, aqui vive tambien el seguimiento de pagos y cobros.

## Costos

`/costs` registra y analiza costos del negocio.

Casos de uso frecuentes:

- costos operativos por servicio
- costos vinculados a proveedores
- costos relacionados con inventario o gruas
- revision de categorias, subcategorias y centros de costo

## Inventario

`/inventory` administra catalogo, stock y movimientos.

Permite:

- mantener items y SKU
- revisar stock por ubicacion
- registrar entradas y salidas
- conectar compras, costos y consumos
- relacionar piezas con gruas cuando aplica

## Proveedores

`/suppliers` concentra el catalogo y los flujos asociados a compras y documentos.

Incluye:

- catalogo de proveedores
- pagos a proveedores
- calendario de vencimientos
- importacion XML
- relacion con costos e inventario

## Cuentas por pagar

`/accounts-payable` sirve para controlar compromisos financieros distintos del flujo basico de facturas de cliente.

Uso tipico:

- registrar deudas y cuotas
- revisar estados y vencimientos
- consultar creditos y obligaciones pendientes

## Proyecciones e historico financiero

### Proyecciones

`/income-projections` ayuda a revisar:

- aging
- flujo esperado
- proyeccion de cobros
- comportamiento financiero futuro

### Historico

`/historical` sirve para consulta historica y analisis financiero separado del flujo operativo diario.

## Reportes

`/reports` concentra la salida analitica del sistema.

Permite normalmente:

- revisar metricas por modulo
- exportar PDF o Excel segun disponibilidad
- consolidar informacion operativa y financiera

## Reporte diario

`/daily-report` ofrece una vista resumida para seguimiento diario.

Util para:

- control ejecutivo rapido
- revision de servicios y pendientes del dia
- contraste entre operacion y estado financiero inmediato

## Calculadora de viajes

`/trip-calculator` ayuda a estimar recorridos y costos operativos.

Uso tipico:

- calcular distancia
- estimar peajes
- apoyar cotizacion o evaluacion de servicio

## Configuracion

`/settings` concentra la administracion del sistema.

### Secciones visibles

Segun el rol, configuracion incluye:

- `Empresa`
- `Zona horaria`
- `Sistema`
- `Cond. pago`
- `Alertas`
- `Categorias`
- `Usuarios` solo admin
- `Auditoria` solo admin
- `Integridad` solo admin
- `Liberacion` solo admin

### Que se gestiona aqui

- branding general de la empresa
- zona horaria operacional
- parametros del sistema
- condiciones de pago
- alertas y preferencias visibles para modulos administrativos
- usuarios y permisos
- auditoria e integridad operacional
- integracion WhatsApp si esta habilitada en el entorno

### WhatsApp

Si la integracion esta configurada, desde configuracion se puede:

- definir telefonos administrativos
- activar o desactivar tipos de notificacion disponibles
- probar la integracion
- revisar historial o estado segun la implementacion disponible

Referencia operativa:

- [Guia de configuracion WhatsApp](./guia-configuracion-whatsapp.md)

## Entradas rapidas

`/quick-entries` esta orientado a captura rapida administrativa y movil.

Puede servir para:

- registrar evidencia rapida
- preparar informacion para costos
- usar carga asistida por OCR cuando el entorno lo tenga habilitado

## Backup

`/backup` reune herramientas administrativas de respaldo.

Uso recomendado:

- operar solo por usuarios admin
- usarlo como herramienta controlada, no como reemplazo de politicas formales de respaldo de plataforma

## Portal cliente

### Rutas principales

- `/portal/dashboard`
- `/portal/services`
- `/portal/purchase-orders`
- `/portal/request-service`
- `/portal/invoices`

### Que permite hacer

- revisar servicios propios
- revisar estados y fechas del servicio
- identificar el vehiculo trasladado o, si no existe informacion valida, una referencia util del servicio
- enviar ordenes de compra pendientes
- solicitar nuevos servicios
- consultar facturas y descargar sus documentos

### Sidebar y branding

El sidebar del portal muestra:

- logo del cliente si fue cargado en la ficha del cliente
- nombre comercial del cliente si existe
- fallback al branding general o a un icono generico cuando no existe logo

### Dashboard del portal

El dashboard del portal muestra:

- total de servicios
- servicios sin orden de compra
- facturas pendientes
- facturas vencidas
- accesos rapidos a `Mis Servicios`, `Sin orden de compra`, `Solicitar Servicio` y `Mis Facturas`

Si existen servicios sin O.C., el dashboard destaca esa alerta para acelerar el envio.

### Mis Servicios

`/portal/services` concentra la consulta de servicios del cliente.

Funciones vigentes:

- vista por defecto en `Listado`
- cambio de vista entre `Calendario`, `Listado` y `Tarjetas`
- navegacion por mes
- filtros por estado dentro del mes visible
- ordenamiento por columnas en la vista de tabla
- exportacion de servicios segun las opciones disponibles en pantalla

En la experiencia cliente, se prioriza mostrar:

- vehiculo trasladado
- fecha del servicio
- ruta
- valor
- estado del servicio

### Sin orden de compra

`/portal/purchase-orders` lista servicios cotizados que requieren O.C. para continuar el flujo administrativo.

Funciones vigentes:

- tabla con columnas ordenables
- semaforo por antiguedad de dias sin O.C.
- modal para registrar numero de O.C.
- campo opcional de cotizacion
- confirmacion visual de que la O.C. fue enviada

Cuando el cliente envia una O.C. desde el portal:

- el servicio se actualiza en el sistema
- el equipo administrativo puede recibir notificacion por WhatsApp si la integracion esta disponible
- si la notificacion falla, la O.C. igual queda registrada

### Solicitar Servicio

`/portal/request-service` permite ingresar nuevas solicitudes para la empresa cliente.

Campos relevantes:

- tipo de servicio
- origen y destino
- fecha del servicio
- observaciones
- urgencia
- hora preferida
- telefono de contacto
- datos del vehiculo segun lo que requiera el tipo de servicio

El formulario adapta la exigencia de datos de vehiculo segun el tipo de servicio seleccionado.

### Mis Facturas

`/portal/invoices` permite:

- filtrar por estado
- filtrar por rango de fechas
- revisar total por pagar y total vencido
- ver numero fiscal, fechas, saldo pendiente y estado
- descargar PDF de la factura

### Notificaciones y busqueda rapida

El portal incorpora:

- campana de notificaciones para O.C. pendientes y acceso rapido a servicios
- buscador rapido con atajo `Cmd+K` o `Ctrl+K`
- notificaciones en tiempo real cuando cambia el estado de un servicio del cliente

## Funcionalidad movil y PWA

La app esta pensada para funcionar bien en escritorio y movil.

Capacidades relevantes:

- interfaz responsiva
- experiencia de operador en terreno
- portal cliente usable en movil
- soporte PWA segun configuracion del entorno
- indicadores de conectividad y actualizacion segun implementacion activa

Referencia tecnica:

- [PWA](./modules/pwa.md)

## Seguridad y trazabilidad

Aspectos visibles para el usuario:

- autenticacion por cuenta individual
- permisos por rol y, en algunos casos, por modulo
- trazabilidad de cambios en areas sensibles
- uso de formularios y estados controlados para evitar inconsistencias
- registro de actividad de navegacion en areas relevantes del sistema

## Buenas practicas de uso

- ingresar datos completos y consistentes desde el inicio del servicio
- revisar cliente, fecha, operador y grua antes de guardar
- usar cierres antes de facturar cuando el flujo lo requiera
- validar montos y estados antes de aplicar pagos
- registrar costos con la categoria correcta
- usar inventario y proveedores como flujos integrados, no aislados
- mantener configuracion y permisos bajo control administrativo
- en portal cliente, registrar la O.C. apenas el servicio este cotizado para evitar atrasos administrativos

## Solucion de problemas

### No puedo entrar al sistema

- verificar correo y contrasena
- usar recuperacion de contrasena si corresponde
- confirmar que el usuario tenga el rol correcto

### No veo un modulo

- puede deberse al rol del usuario
- tambien puede deberse a permisos modulares definidos en configuracion

### No puedo editar cierta informacion

- algunas pantallas son solo lectura para `viewer`
- ciertos catalogos y configuraciones son exclusivos de `admin`

### Un usuario cliente no puede entrar al portal

- revisar que el usuario tenga rol `client`
- confirmar que el usuario este vinculado a una empresa cliente
- validar que el cliente este activo y que el acceso no este restringido por datos incompletos

### Un operador no ve sus servicios

- revisar que el servicio tenga operador asignado
- verificar el estado del servicio y los filtros aplicados
- confirmar que el usuario tenga rol `operator`

### No puedo subir el logo del cliente

- validar que el archivo sea una imagen valida
- usar un archivo liviano, idealmente PNG, JPG, SVG o WebP
- intentar nuevamente desde la pestana `Info` del cliente
- si persiste, revisar permisos del usuario admin y configuracion de almacenamiento

### Una notificacion no se envia

- revisar configuracion del modulo correspondiente
- en el caso de WhatsApp, validar que la integracion este operativa y el destinatario tenga telefono correcto
- si falla una notificacion no critica, verificar igualmente si la accion principal quedo registrada

Referencia adicional:

- [Configuracion tecnica](./technical/configuration.md)

## Documentos relacionados

- [PRD](../PRD.md)
- [Documentacion por modulos](./modules/README.md)
- [Configuracion tecnica](./technical/configuration.md)
- [Settings admin](./modules/settings-admin.md)
- [Backup](./modules/backup.md)
- [Guia de configuracion WhatsApp](./guia-configuracion-whatsapp.md)

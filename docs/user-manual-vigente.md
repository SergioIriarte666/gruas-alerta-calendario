# Manual de Usuario Vigente - TMS Gruas

## Objetivo

Este manual resume el uso actual de TMS Gruas a nivel funcional. Esta enfocado en la operacion vigente de la app y evita historicos, prompts o detalles tecnicos que no aportan al uso diario.

## Que es TMS Gruas

TMS Gruas es una plataforma web para administrar la operacion y las finanzas de una empresa de gruas. El sistema centraliza:

- servicios y calendario
- clientes, gruas y operadores
- inspeccion en terreno por operador
- cierres, facturas y seguimiento de cobros
- costos, inventario y proveedores
- reportes, proyecciones y configuracion administrativa
- portal cliente y mensajeria operativa segun configuracion

## Superficies del sistema

| Superficie | Acceso | Objetivo |
|---|---|---|
| Backoffice administrativo | rutas como `/dashboard`, `/services`, `/invoices`, `/inventory`, `/settings` | Operacion, finanzas, activos y administracion |
| App de operador | `/operator` | Gestion de servicios asignados e inspecciones en terreno |
| Portal cliente | `/portal` | Consulta de servicios, facturas y solicitud de nuevos servicios |

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

## Roles vigentes

| Rol | Alcance |
|---|---|
| `admin` | Control total del backoffice, configuracion, modulos criticos y acciones administrativas |
| `viewer` | Acceso administrativo de lectura a modulos operativos y financieros |
| `operator` | Acceso a la app de operador para servicios asignados e inspeccion |
| `client` | Acceso restringido al portal cliente |

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
| Clientes | `/clients` | Ficha de clientes e historial |
| Gruas | `/cranes` | Flota, mantenimiento, piezas e inventario |
| Facturas | `/invoices` | Facturacion, pagos y seguimiento de cobros |
| Historico financiero | `/historical` | Consulta financiera historica |
| Proyecciones | `/income-projections` | Cashflow, aging y proyeccion |
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
| Configuracion | `/settings` | Usuarios, permisos, alertas y parametros |
| Entradas rapidas | `/quick-entries` | Captura rapida con apoyo movil y OCR |
| Backup | `/backup` | Herramientas de respaldo |

### Otras rutas relevantes

| Superficie | Ruta |
|---|---|
| App operador | `/operator` |
| Inspeccion operador | `/operator/service/:id/inspection` |
| Portal cliente | `/portal/dashboard`, `/portal/services`, `/portal/request-service`, `/portal/invoices` |
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
- gestionar estados operativos
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
- revisar historial de servicios
- consultar relacion con facturas
- navegar al pipeline VIP en clientes que lo utilizan

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

### Que se gestiona aqui

- usuarios y permisos
- parametros generales
- configuracion de alertas
- preferencias visibles para modulos administrativos
- integracion WhatsApp si esta habilitada en el entorno

### WhatsApp

Si la integracion esta configurada, desde configuracion se puede:

- definir numeros administrativos
- activar o desactivar tipos de notificacion
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

Rutas principales:

- `/portal/dashboard`
- `/portal/services`
- `/portal/request-service`
- `/portal/invoices`

El portal cliente permite:

- revisar servicios propios
- solicitar nuevos servicios
- consultar facturas y documentos asociados

## Funcionalidad movil y PWA

La app esta pensada para funcionar bien en escritorio y movil.

Capacidades relevantes:

- interfaz responsiva
- experiencia de operador en terreno
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

## Buenas practicas de uso

- ingresar datos completos y consistentes desde el inicio del servicio
- revisar cliente, fecha, operador y grua antes de guardar
- usar cierres antes de facturar cuando el flujo lo requiera
- validar montos y estados antes de aplicar pagos
- registrar costos con la categoria correcta
- usar inventario y proveedores como flujos integrados, no aislados
- mantener configuracion y permisos bajo control administrativo

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

### Un operador no ve sus servicios

- revisar que el servicio tenga operador asignado
- verificar el estado del servicio y los filtros aplicados
- confirmar que el usuario tenga rol `operator`

### Una notificacion no se envia

- revisar configuracion del modulo correspondiente
- en el caso de WhatsApp, validar que la integracion este operativa y el destinatario tenga telefono correcto

Referencia adicional:

- [Troubleshooting](./technical/troubleshooting.md)

## Documentos relacionados

- [PRD](../PRD.md)
- [Documentacion por modulos](./modules/README.md)
- [Configuracion tecnica](./technical/configuration.md)
- [Guia de administrador](./technical/system-admin-guide.md)
- [Guia de configuracion WhatsApp](./guia-configuracion-whatsapp.md)

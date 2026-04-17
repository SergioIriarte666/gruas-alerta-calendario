# Manual de Usuario - TMS Grúas v2.3.0

## Tabla de Contenidos

1. [Introducción al Sistema](#introducción-al-sistema)
2. [Acceso y Roles de Usuario](#acceso-y-roles-de-usuario)
3. [Dashboard Principal](#dashboard-principal)
4. [Gestión de Servicios](#gestión-de-servicios)
5. [Sistema de Cierres](#sistema-de-cierres)
6. [Gestión de Grúas](#gestión-de-grúas)
7. [Gestión de Operadores](#gestión-de-operadores)
8. [Portal del Operador](#portal-del-operador)
9. [Calendario de Eventos](#calendario-de-eventos)
10. [Sistema de Inventario](#sistema-de-inventario)
11. [Gestión de Proveedores](#gestión-de-proveedores)
12. [Módulo VIP y Pipeline](#módulo-vip-y-pipeline)
13. [Facturación Diferida](#facturación-diferida)
14. [Sistema de Backup y Restauración](#sistema-de-backup-y-restauración)
15. [Entradas Rápidas](#entradas-rápidas)
16. [Módulo Financiero](#módulo-financiero)
17. [Sistema de Reportes](#sistema-de-reportes)
18. [Herramientas Administrativas](#herramientas-administrativas)
19. [Configuraciones](#configuraciones)
20. [Portal del Cliente](#portal-del-cliente)
21. [Funcionalidades Móviles](#funcionalidades-móviles)
22. [Integración Inventario-Grúas](#integración-inventario-grúas)
23. [Mejores Prácticas y Flujos de Trabajo](#mejores-prácticas-y-flujos-de-trabajo)
24. [Solución de Problemas](#solución-de-problemas)
25. [Calculadora de Viajes](#25-calculadora-de-viajes)
26. [Importador XML Unificado](#26-importador-xml-unificado)
27. [Accesibilidad y Diseño](#27-accesibilidad-y-diseño)
28. [Auditoría y Seguridad](#28-auditoría-y-seguridad)

---

## 1. Introducción al Sistema

### ¿Qué es TMS Grúas?

TMS Grúas v2.3.0 es un sistema integral de gestión de transporte y servicios de grúas que permite:

- **Gestión completa de servicios**: Desde la creación hasta la facturación con flujos optimizados
- **Control de inventario avanzado**: Seguimiento de repuestos con integración automática a grúas
- **Administración de recursos**: Grúas, operadores y equipos con métricas avanzadas
- **Gestión de proveedores**: Sistema completo de proveedores y programación de pagos
- **Sistema de backup**: Respaldos automáticos y restauración completa
- **Entradas rápidas**: Registro móvil de gastos y eventos con GPS
- **Módulo VIP**: Pipeline avanzado para seguimiento de clientes estratégicos
- **Facturación diferida**: Gestión automática de ciclos de facturación por cliente
- **Sistema de cierres**: Control avanzado de cierres de servicios y facturación
- **Portal del operador**: Funcionalidades especializadas para personal de campo
- **Reportes financieros**: Costos, comisiones e ingresos con análisis avanzado
- **Portal del cliente**: Acceso directo para clientes con funcionalidades ampliadas
- **Aplicación móvil PWA**: Funcionalidades offline mejoradas para uso en campo

### Características Principales v2.3.0

- ✅ **Diseño Responsivo**: Funciona perfectamente en desktop, tablet y móvil (mobile-first, tablas → cards)
- ✅ **Tema Violeta de Alto Contraste**: Esquema de accesibilidad sin verde
- ✅ **Gestión de Inventario**: Auto-SKU en importación XML + valoración consistente
- ✅ **TMS Completo**: Servicios, cierres, grúas, operadores y bitácora técnica
- ✅ **Seguridad Empresarial**: RLS endurecido, auditoría `created_by` global y permisos granulares por módulo
- ✅ **Reportes Avanzados**: Reportes integrales automáticos por email + filtro por departamento
- ✅ **Portal del Cliente**: Acceso a servicios, facturas y documentos
- ✅ **Sistema de Backup**: Respaldos automáticos programables
- ✅ **Gestión de Proveedores**: Wizard XML unificado, sincronización triangular y calendario de pagos TZ Chile
- ✅ **Cuentas por Pagar**: Deudas, créditos, intereses y cuotas unificadas
- ✅ **Entradas Rápidas con OCR**: Auto-extracción con OpenAI gpt-4o-mini, GPS y fotos
- ✅ **Pipeline VIP con OCR fuzzy matching**: Importación de OC y cotizaciones tolerante a errores
- ✅ **Facturación Diferida**: Ciclos personalizados + anulación con Nota de Crédito obligatoria
- ✅ **Sistema de Cierres**: Sincronización forzada con facturas y estados protegidos
- ✅ **Portal del Operador**: Herramientas de campo con firma digital
- ✅ **Calculadora de Viajes**: Mapbox + GetAPI (peajes, distancia, costo estimado)
- ✅ **Integración Inventario-Grúas**: Sincronización atómica para evitar duplicados
- ✅ **PWA Offline v5**: CRUD completo offline con IndexedDB
- ✅ **Notificaciones WhatsApp**: Integración directa vía Meta Cloud API
- ✅ **Importación Histórica SII**: Ventas históricas (CSV/XLSX) aisladas del activo
- ✅ **Conciliación Inteligente**: Manual con prioridad por vencimiento (sin auto-asignación)
- ✅ **Verificación RUT Multi-proveedor**: SRE/Ruts.info + formateo global automático
- ✅ **Autocompletado Inteligente**: En todos los campos de texto libre
- ✅ **Calendario Hub**: Sincronización multi-fuente (servicios, mantenciones, eventos)
- ✅ **Operaciones por Lote**: Cierre masivo, cambio de estado y duplicación de servicios

### Novedades v2.3.0

#### 🆕 **Nuevas Funcionalidades**
- **Auto-SKU en importación XML**: Formato `SKU-YYYYMMDD-XXXX`. Se aplica solo cuando el proveedor no entrega código en el XML; el formulario manual sigue exigiendo SKU explícito. Backfill aplicado a productos existentes sin código.
- **Sincronización triangular Costos ↔ Pagos a Proveedores ↔ Facturas**: Triggers de base de datos mantienen consistencia automática entre los tres módulos.
- **Importador XML unificado tipo Wizard**: Modal de gran formato (1600px) con detección de duplicados en 3 niveles (folio, hash, contenido), asociación a costos existentes y fallback por RUT cuando falla la búsqueda por nombre.
- **Resiliencia v4 de importación XML**: Vínculo atómico entre facturas, costos, pagos y bodega.
- **Anulación de facturas con Nota de Crédito obligatoria**: Sistema formal de auditoría para cancelaciones.
- **Protección de eliminación**: Prompt "ELIMINAR" en facturas generadas por la app (no históricas HIST-).
- **Sistema de comisiones rediseñado**: Tabla `costs` como fuente única de verdad, flag `commission_exempt` por operador.
- **Cuentas por Pagar unificadas**: Deudas, créditos, intereses y cuotas (tablas `debts`, `debt_installments`, `creditors`).
- **Ventas Históricas SII**: Importación CSV/XLSX de facturas, NC y ND con prefijo HIST-.
- **Aislamiento Histórico vs Activo**: Las finanzas activas excluyen documentos históricos.
- **Conciliación inteligente sin auto-asignación**: Pagos manuales con visualización de fecha de vencimiento.
- **Cálculo de antigüedad y vencidas por saldo**: Estado real basado en saldo, no solo en flag.
- **Permisos granulares por módulo**: Administradores controlan visibilidad por usuario.
- **Panel de Emergencia**: Herramientas administrativas centralizadas.
- **Calculadora de Viajes**: Mapbox + GetAPI Chile (peajes, ruta, costo estimado).
- **Verificación RUT multi-proveedor**: SRE/Ruts.info con enriquecimiento de datos + formateo automático global.
- **Pipeline VIP con OCR fuzzy matching**: Importación de OC y cotizaciones tolerante a errores de lectura.
- **Bitácora técnica de grúas v3**: Mantenciones + integración financiera + kilometraje.
- **Subcontratación de servicios**: Vinculada a proveedores de inventario (`outsourced_provider_id`).
- **Sistema de auditoría `created_by`**: Trazabilidad de autoría en todos los módulos principales.
- **Resumen de pendientes al iniciar sesión**: Modal proactivo en el Dashboard.
- **Notificaciones WhatsApp**: Integración directa con Meta WhatsApp Cloud API.
- **Reportes integrales automáticos**: Envío vía Resend programado con pg_cron.
- **Autocompletado inteligente**: En observaciones, descripciones y referencias.
- **Quick Records con auto-extracción**: OpenAI gpt-4o-mini analiza foto del recibo.
- **Calendario hub multi-fuente**: Servicios, mantenciones y eventos remotos sincronizados.
- **Operaciones por lote y duplicación de servicios**: Cierre masivo, cambio de estado, reasignación.
- **Log de auditoría de servicios**: Tabla `services_history` con seguimiento de cambios.
- **Sistema de tarifas automáticas**: Jerarquía cliente → tipo de servicio → default.
- **Tema accesibilidad violeta**: Sistema de diseño sin verde, alto contraste.
- **PWA offline v5**: CRUD completo offline con IndexedDB.
- **Diseño responsivo mobile-first**: Tablas se transforman en cards en móvil.

#### 🔧 **Mejoras Existentes**
- **Gestión de Inventario**: Valoración solo desde entradas activas, indicador multi-item.
- **Sistema Financiero**: Restricción de escritura solo administradores en tablas críticas.
- **Reportes**: Filtro por Departamento, métricas con TZ Chile/Santiago.
- **PWA**: Offline robusto v5 con sincronización inteligente al recuperar conexión.
- **Categorías**: Subcategorías cargadas dinámicamente según categoría seleccionada.
- **Descripciones**: Edición dinámica priorizando legibilidad en costos e inventario.

---

## 2. Acceso y Roles de Usuario

### Inicio de Sesión

1. **Acceder al sistema**:
   - Abrir la URL del sistema en el navegador
   - Introducir email y contraseña
   - Hacer clic en "Iniciar Sesión"

2. **Recuperación de contraseña**:
   - Hacer clic en "¿Olvidaste tu contraseña?"
   - Introducir email registrado
   - Revisar email para instrucciones de recuperación

### Roles de Usuario

#### 👑 **Administrador**
- Acceso completo al sistema
- Gestión de usuarios y configuraciones
- Acceso a todos los módulos y reportes
- Configuración de empresa y sistema
- Gestión del pipeline VIP
- Configuración de facturación diferida

#### 👨‍💼 **Supervisor**
- Gestión de servicios y operaciones
- Acceso a reportes operacionales
- Supervisión de operadores
- Gestión de inventario
- Acceso al sistema de cierres
- Seguimiento del pipeline VIP

#### 🚛 **Operador**
- Vista simplificada para operaciones de campo
- Actualización de estados de servicio
- Registro de eventos y novedades
- Acceso móvil optimizado
- Portal del operador especializado
- Entradas rápidas con GPS

#### 🎯 **Operador Avanzado**
- Todas las funciones del operador básico
- Acceso a inspecciones digitales
- Captura de firmas digitales
- Gestión completa de servicios en campo
- Reportes móviles básicos

#### 👤 **Cliente**
- Acceso al portal del cliente
- Visualización de servicios contratados
- Solicitud de nuevos servicios
- Consulta de facturas y pagos
- Seguimiento en tiempo real

---

## 3. Dashboard Principal

### Vista General

El dashboard proporciona una vista consolidada de:

#### 📊 **Métricas Principales**
- **Servicios Activos**: Número de servicios en curso
- **Grúas Disponibles**: Estado actual de la flota
- **Ingresos del Mes**: Facturación mensual
- **Operadores Activos**: Personal en servicio
- **Pipeline VIP**: Oportunidades en seguimiento
- **Servicios Pendientes de Facturar**: Listos para facturación diferida

#### 📈 **Gráficos y Tendencias**
- **Servicios por Estado**: Distribución de servicios
- **Ingresos Mensuales**: Tendencia de facturación
- **Utilización de Grúas**: Eficiencia de la flota
- **Costos vs Ingresos**: Análisis de rentabilidad
- **Pipeline VIP**: Conversión de oportunidades
- **Facturación Diferida**: Programación de facturas

#### 🔔 **Notificaciones y Alertas**
- Servicios próximos a vencer
- Mantenimientos programados
- Inventario bajo stock
- Facturas pendientes
- Oportunidades VIP en seguimiento
- Cierres pendientes de facturar

#### 🎯 **Accesos Rápidos**
- Crear nuevo servicio
- Registrar entrada rápida
- Procesar cierres pendientes
- Actualizar pipeline VIP
- Generar facturación diferida

### Navegación

#### Menú Principal
- **Dashboard**: Vista general del sistema
- **Servicios**: Gestión de servicios de transporte
- **Cierres**: Control de cierres y facturación
- **Grúas**: Administración de la flota
- **Operadores**: Gestión de personal
- **Portal Operador**: Herramientas de campo
- **Calendario**: Programación de eventos
- **Inventario**: Control de stock
- **Proveedores**: Gestión de proveedores
- **VIP Pipeline**: Seguimiento de clientes estratégicos
- **Facturación Diferida**: Ciclos de facturación
- **Entradas Rápidas**: Registro móvil de gastos
- **Finanzas**: Costos, comisiones y facturación
- **Reportes**: Análisis y estadísticas
- **Configuración**: Ajustes del sistema

---

## 4. Gestión de Servicios

### Creación de Servicios

#### Paso 1: Información Básica
1. **Acceder a Servicios** → "Nuevo Servicio"
2. **Completar datos obligatorios**:
   - **Folio**: Número único del servicio
   - **Cliente**: Seleccionar de la lista
   - **Fecha de Servicio**: Programación
   - **Tipo de Servicio**: Categoría del trabajo

#### Paso 2: Detalles del Servicio
3. **Información operacional**:
   - **Origen**: Dirección de recogida
   - **Destino**: Dirección de entrega
   - **Descripción**: Detalles del trabajo
   - **Observaciones**: Notas adicionales

#### Paso 3: Información Comercial
4. **Datos comerciales** (Nuevos en v2.2.0):
   - **Número de Cotización**: Referencia comercial
   - **Orden de Compra**: Número del cliente
   - **Número de OC**: Referencia adicional
   - **Valor Cotizado**: Monto estimado

#### Paso 4: Asignación de Recursos
5. **Seleccionar recursos**:
   - **Grúa**: Equipo asignado
   - **Operador**: Personal responsable
   - **Vehículo de Apoyo**: Si es necesario

#### Paso 5: Costos y Tarifas
6. **Definir precios**:
   - **Tarifa Base**: Costo del servicio
   - **Costos Adicionales**: Extras y recargos
   - **Descuentos**: Si aplican

### Búsqueda Avanzada de Servicios

#### Criterios de Búsqueda Expandidos (Nuevo en v2.2.0)
- **Por Folio**: Búsqueda directa por número
- **Por Cliente**: Filtrar por empresa
- **Por Patente**: Número de placa del vehículo
- **Por Marca**: Marca del vehículo
- **📋 Por Cotización**: Número de cotización (NUEVO)
- **📋 Por Orden de Compra**: Número de OC (NUEVO)
- **Por Estado**: Filtrar por estado actual
- **Por Fecha**: Rango de fechas
- **Por Operador**: Servicios asignados

#### Filtros Avanzados
- **Estado del Servicio**: Pendiente, Confirmado, En Proceso, Completado, Cancelado
- **Tipo de Cliente**: Regular, VIP, Esporádico
- **Centro de Costo**: Categorización interna
- **Con/Sin Facturar**: Estado de facturación

### Actualizaciones Masivas (Nuevo en v2.2.0)

#### Actualización de Cotizaciones
1. **Seleccionar servicios** múltiples
2. **Elegir "Actualizar Cotizaciones"**
3. **Definir patrón**:
   - Numeración secuencial
   - Prefijo personalizado
   - Rango de fechas
4. **Aplicar cambios** masivos

#### Actualización de Órdenes de Compra
1. **Filtrar servicios** por cliente
2. **Seleccionar "Batch Update OC"**
3. **Configurar numeración**:
   - Automática secuencial
   - Manual por lotes
   - Validación de duplicados
4. **Procesar actualización**

### Estados de Servicio

#### 🟡 **Pendiente**
- Servicio creado, esperando confirmación
- **Acciones disponibles**: Editar, confirmar, cancelar
- **Puede pasar a**: Confirmado, Cancelado

#### 🔵 **Confirmado**
- Servicio aprobado y programado
- **Acciones disponibles**: Iniciar, reprogramar, cancelar
- **Puede pasar a**: En Proceso, Cancelado

#### 🟢 **En Proceso**
- Servicio en ejecución
- **Acciones disponibles**: Actualizar estado, agregar notas
- **Puede pasar a**: Completado, Cancelado

#### ✅ **Completado**
- Servicio finalizado exitosamente
- **Acciones disponibles**: Crear cierre, facturar, generar reporte
- **Puede pasar a**: Cerrado (via cierre)

#### 🔴 **Cancelado**
- Servicio cancelado por cualquier motivo
- **Acciones disponibles**: Ver historial, reactivar
- **Estado final**: No cambia

#### 📋 **Cerrado** (Nuevo en v2.2.0)
- Servicio con cierre creado
- **Acciones disponibles**: Ver cierre, facturar desde cierre
- **Siguiente paso**: Facturación

### Integración con Otros Módulos

#### Con Sistema de Cierres
- **Auto-creación**: Servicios completados generan cierres automáticamente
- **Agrupación**: Múltiples servicios en un cierre
- **Validación**: Verificación de datos antes del cierre

#### Con Facturación Diferida
- **Asignación automática**: Servicios se asignan según configuración del cliente
- **Programación**: Facturación según ciclos establecidos
- **Alertas**: Notificaciones de servicios listos para facturar

#### Con Pipeline VIP
- **Seguimiento**: Servicios de clientes VIP se rastrean especialmente
- **Métricas**: Indicadores específicos para clientes estratégicos
- **Reportes**: Análisis dedicado para el pipeline VIP

---

## 5. Sistema de Cierres

### ¿Qué son los Cierres?

Los cierres son agrupaciones de servicios completados que se preparan para facturación. Este sistema permite:

- **Agrupar servicios** por cliente y período
- **Validar información** antes de facturar
- **Auto-completar** órdenes de compra
- **Generar facturas** de manera eficiente
- **Controlar el flujo** de facturación

### Creación de Cierres

#### Creación Automática
1. **Configuración**: Los servicios completados generan cierres automáticamente
2. **Agrupación**: Por cliente y período configurado
3. **Validación**: Verificación automática de datos obligatorios
4. **Notificación**: Alertas de nuevos cierres creados

#### Creación Manual
1. **Acceder a Cierres** → "Nuevo Cierre"
2. **Seleccionar cliente**
3. **Elegir servicios** completados disponibles
4. **Definir período** del cierre
5. **Agregar observaciones** si es necesario

### Estados de Cierre

#### 🟡 **Abierto**
- Cierre creado, puede recibir más servicios
- **Acciones disponibles**:
  - Agregar servicios
  - Editar información
  - Auto-completar OC
  - Cerrar cierre

#### 🔵 **Cerrado**
- Cierre finalizado, no acepta más servicios
- **Acciones disponibles**:
  - Generar factura
  - Ver detalles
  - Reabrir (si no está facturado)

#### ✅ **Facturado**
- Cierre convertido en factura
- **Acciones disponibles**:
  - Ver factura generada
  - Imprimir comprobantes
  - Ver historial

### Auto-Completado de Órdenes de Compra

#### Funcionalidad Inteligente
1. **Detección**: Sistema identifica servicios sin OC en el cierre
2. **Análisis**: Busca patrones en servicios previos del cliente
3. **Sugerencia**: Propone numeración automática
4. **Validación**: Verifica que no existan duplicados

#### Configuración por Cliente
- **Prefijo personalizado**: Según nomenclatura del cliente
- **Numeración secuencial**: Continuidad en la numeración
- **Validación cruzada**: Verificación con cierres anteriores

### Gestión de Cierres

#### Dashboard de Cierres
- **Cierres abiertos**: Listos para agregar servicios
- **Cierres listos**: Preparados para facturar
- **Cierres facturados**: Historial de facturas generadas
- **Métricas**: Tiempo promedio de cierre, servicios por cierre

#### Filtros y Búsqueda
- **Por cliente**: Cierres específicos
- **Por estado**: Abierto, cerrado, facturado
- **Por período**: Rango de fechas
- **Por monto**: Valor del cierre

#### Reportes de Cierres
- **Eficiencia de cierre**: Tiempo promedio por proceso
- **Servicios por cierre**: Productividad del proceso
- **Análisis de OC**: Completitud de órdenes de compra
- **Facturación por cierres**: Flujo de ingresos

---

## 6. Gestión de Grúas

### Registro de Grúas

#### Información Básica
1. **Acceder a Grúas** → "Nueva Grúa"
2. **Datos del equipo**:
   - **Código**: Identificador único
   - **Marca y Modelo**: Especificaciones
   - **Año**: Año de fabricación
   - **Capacidad**: Tonelaje máximo
   - **Placa**: Número de matrícula

#### Especificaciones Técnicas
3. **Características operacionales**:
   - **Altura Máxima**: Alcance vertical
   - **Radio de Trabajo**: Alcance horizontal
   - **Tipo de Combustible**: Diesel, eléctrico, etc.
   - **Consumo**: Litros por hora

#### Documentación
4. **Documentos requeridos**:
   - **SOAT**: Seguro obligatorio
   - **Revisión Técnica**: Certificación vigente
   - **Licencia de Operación**: Permisos municipales
   - **Certificados**: Documentos adicionales

### Mantenimiento de Grúas

#### Programación de Mantenimientos
1. **Mantenimiento Preventivo**:
   - **Por Horas**: Cada X horas de operación
   - **Por Fecha**: Mantenimientos periódicos
   - **Por Kilometraje**: Según uso

2. **Mantenimiento Correctivo**:
   - **Reportes de Fallas**: Registro de problemas
   - **Reparaciones**: Seguimiento de trabajos
   - **Repuestos**: Control de piezas utilizadas

#### Historial de Mantenimiento
- **Registro completo**: Todas las intervenciones
- **Costos asociados**: Gastos por mantenimiento
- **Tiempo fuera de servicio**: Impacto operacional
- **Proveedores**: Talleres y técnicos

### Estados de Grúas

#### 🟢 **Disponible**
- Grúa lista para asignación
- Sin servicios programados
- Mantenimiento al día

#### 🔵 **En Servicio**
- Grúa asignada a un trabajo
- Operador designado
- Ubicación en tiempo real

#### 🟡 **Mantenimiento**
- Grúa en taller o revisión
- No disponible para servicios
- Fecha estimada de retorno

#### 🔴 **Fuera de Servicio**
- Grúa con fallas graves
- Requiere reparación mayor
- Evaluación de viabilidad

### Integración con Inventario

#### Consumo Automático
- **Servicios registran**: Automáticamente el consumo de repuestos
- **Validación**: Verificación de stock antes de asignar
- **Alertas**: Notificaciones de inventario bajo
- **Reportes**: Consumo por grúa y período

#### Mantenimiento Inteligente
- **Predicción**: Basada en historial de consumo
- **Programación**: Automática según uso real
- **Optimización**: Rutas y recursos para mantenimiento

---

## 7. Gestión de Operadores

### Registro de Operadores

#### Información Personal
1. **Datos básicos**:
   - **Nombre Completo**: Identificación
   - **Documento**: Cédula o pasaporte
   - **Teléfono**: Contacto principal
   - **Email**: Correo electrónico
   - **Dirección**: Domicilio

#### Información Laboral
2. **Datos profesionales**:
   - **Código de Empleado**: Identificador interno
   - **Fecha de Ingreso**: Inicio de labores
   - **Cargo**: Posición en la empresa
   - **Salario Base**: Remuneración básica

#### Licencias y Certificaciones
3. **Documentos requeridos**:
   - **Licencia de Conducir**: Categoría requerida
   - **Certificación de Operador**: Grúas específicas
   - **Cursos de Seguridad**: Capacitaciones
   - **Exámenes Médicos**: Aptitud física

### Asignación de Servicios

#### Criterios de Asignación
- **Disponibilidad**: Horarios libres
- **Especialización**: Tipo de grúa certificada
- **Ubicación**: Proximidad al servicio
- **Carga de Trabajo**: Distribución equitativa

#### Proceso de Asignación
1. **Seleccionar Servicio**: Desde la lista de pendientes
2. **Elegir Operador**: Basado en criterios
3. **Confirmar Asignación**: Notificar al operador
4. **Seguimiento**: Monitorear ejecución

### Control de Horarios

#### Registro de Tiempo
- **Hora de Inicio**: Comienzo del servicio
- **Hora de Fin**: Finalización del trabajo
- **Tiempo de Viaje**: Desplazamientos
- **Tiempo de Espera**: Demoras en sitio

#### Cálculo de Comisiones
- **Tarifa por Hora**: Pago base
- **Bonificaciones**: Incentivos adicionales
- **Descuentos**: Penalizaciones si aplican
- **Total Devengado**: Cálculo final

---

## 8. Portal del Operador

### Acceso Especializado

El Portal del Operador es una interfaz optimizada para personal de campo que proporciona:

#### 🎯 **Dashboard del Operador**
- **Servicios asignados**: Lista de trabajos del día
- **Servicios en curso**: Estado actual de ejecución
- **Próximos servicios**: Programación futura
- **Métricas personales**: Rendimiento y comisiones

#### 📱 **Interfaz Móvil Optimizada**
- **Botones grandes**: Fácil interacción en campo
- **Navegación simple**: Flujo intuitivo
- **Modo offline**: Funcionalidad sin conexión
- **Sincronización automática**: Cuando hay conexión

### Funcionalidades Principales

#### 🔍 **Inspección de Servicios**
1. **Formularios digitales**: Listas de verificación personalizables
2. **Captura de fotos**: Evidencias del estado del equipo
3. **Notas de campo**: Observaciones detalladas
4. **Validación obligatoria**: Campos requeridos antes de continuar

#### ✍️ **Firmas Digitales**
1. **Firma del operador**: Confirmación de inspección
2. **Firma del cliente**: Conformidad del servicio
3. **Almacenamiento seguro**: Respaldo automático
4. **Trazabilidad completa**: Auditoría de firmas

#### 📸 **Documentación Visual**
- **Fotos del equipo**: Estado antes y después
- **Fotos del sitio**: Condiciones de trabajo
- **Fotos de daños**: Evidencias si existen
- **Compresión automática**: Optimización para móvil

#### 🗺️ **Geolocalización**
- **Ubicación en tiempo real**: GPS automático
- **Registro de rutas**: Seguimiento de desplazamientos
- **Tiempo en sitio**: Cálculo automático
- **Verificación de ubicación**: Confirmación de llegada al cliente

### Actualización de Estados

#### Estados de Servicio
1. **Iniciado**: Confirmación de inicio con ubicación
2. **En ruta**: Desplazamiento al sitio
3. **En sitio**: Llegada confirmada por GPS
4. **En ejecución**: Trabajo en progreso
5. **Completado**: Finalización con firmas y fotos

#### Información Requerida por Estado
- **Iniciado**: Hora de salida, combustible inicial
- **En ruta**: Ruta planificada, tiempo estimado
- **En sitio**: Confirmación GPS, fotos del sitio
- **En ejecución**: Notas de progreso, fotos del trabajo
- **Completado**: Firmas, fotos finales, combustible final

### Entradas Rápidas desde Portal

#### 🚀 **Registro Instantáneo**
1. **Gastos de campo**: Combustible, peajes, parqueaderos
2. **Eventos especiales**: Demoras, inconvenientes
3. **Mantenimiento urgente**: Reportes de fallas
4. **Novedades**: Información relevante del servicio

#### 📍 **Con GPS Automático**
- **Ubicación exacta**: Coordenadas del gasto/evento
- **Validación de ubicación**: Verificación de coherencia
- **Mapeo automático**: Visualización en reportes

### Reportes del Operador

#### 📊 **Métricas Personales**
- **Servicios completados**: Conteo diario/semanal/mensual
- **Tiempo promedio**: Eficiencia en ejecución
- **Comisiones ganadas**: Cálculo en tiempo real
- **Calificación de cliente**: Feedback recibido

#### 📈 **Historial de Trabajo**
- **Servicios anteriores**: Historial completo
- **Clientes atendidos**: Base de clientes
- **Rutas frecuentes**: Optimización de desplazamientos
- **Tendencias de rendimiento**: Análisis temporal

### Configuración Personal

#### ⚙️ **Preferencias del Operador**
- **Notificaciones**: Tipos y frecuencia
- **Tema de la app**: Claro/oscuro
- **Idioma**: Configuración regional
- **Formato de hora**: 12/24 horas

#### 🔐 **Seguridad**
- **PIN de acceso**: Autenticación rápida
- **Sesión automática**: Login recordado
- **Bloqueo automático**: Inactividad
- **Datos offline**: Encriptación local

---

## 9. Calendario de Eventos

### Vistas del Calendario

#### 📅 **Vista Mensual**
- Panorama general del mes
- Servicios programados por día
- Mantenimientos y eventos
- Disponibilidad de recursos

#### 📊 **Vista Semanal**
- Detalle semanal de actividades
- Horarios específicos
- Asignaciones de operadores
- Conflictos de programación

#### 📋 **Vista Diaria**
- Agenda detallada del día
- Cronograma hora por hora
- Rutas optimizadas
- Notas y observaciones

### Tipos de Eventos

#### 🚛 **Servicios**
- **Color**: Azul
- **Información**: Cliente, grúa, operador
- **Estado**: Pendiente, confirmado, en proceso

#### 🔧 **Mantenimientos**
- **Color**: Naranja
- **Información**: Grúa, tipo de mantenimiento
- **Duración**: Tiempo estimado

#### 📋 **Inspecciones**
- **Color**: Verde
- **Información**: Equipo, inspector
- **Periodicidad**: Frecuencia requerida

#### 🎯 **Eventos Especiales**
- **Color**: Rojo
- **Información**: Descripción del evento
- **Importancia**: Prioridad alta

### Gestión de Eventos

#### Crear Evento
1. **Hacer clic** en fecha deseada
2. **Seleccionar tipo** de evento
3. **Completar información** requerida
4. **Asignar recursos** necesarios
5. **Guardar** y confirmar

#### Editar Evento
1. **Hacer clic** en evento existente
2. **Modificar** información necesaria
3. **Actualizar** asignaciones
4. **Guardar** cambios

#### Eliminar Evento
1. **Seleccionar** evento
2. **Confirmar** eliminación
3. **Notificar** a involucrados

---

## 10. Sistema de Inventario

### Catálogo de Productos

#### Categorías de Productos
- **Repuestos**: Piezas para grúas
- **Consumibles**: Aceites, filtros, combustible
- **Herramientas**: Equipos de trabajo
- **EPP**: Elementos de protección personal
- **Materiales**: Insumos diversos

#### Información de Productos
1. **Datos básicos**:
   - **Código**: SKU único
   - **Nombre**: Descripción del producto
   - **Categoría**: Clasificación
   - **Unidad**: Medida (unidad, litro, kg)

2. **Información comercial**:
   - **Precio de Compra**: Costo de adquisición
   - **Precio de Venta**: Valor de salida
   - **Proveedor Principal**: Suministrador
   - **Tiempo de Entrega**: Días de reposición

3. **Control de stock**:
   - **Stock Actual**: Cantidad disponible
   - **Stock Mínimo**: Punto de reorden
   - **Stock Máximo**: Límite de almacenamiento
   - **Ubicación**: Posición en bodega

#### Nuevas Funcionalidades v2.2.0

##### 📦 **Números de Lote y Serie**
- **Control por lote**: Seguimiento de grupos de productos
- **Fechas de vencimiento**: Para productos perecederos
- **Números de serie**: Para equipos específicos
- **Trazabilidad completa**: Desde compra hasta consumo

##### 🛒 **Agrupación de Compras**
- **Órdenes de compra**: Agrupación de productos
- **Proveedores múltiples**: Diferentes proveedores por OC
- **Seguimiento de entregas**: Estados parciales y completos
- **Validación de recepciones**: Confirmación de cantidades

### Movimientos de Inventario

#### Tipos de Movimientos

##### 📥 **Entradas**
- **Compras**: Adquisiciones a proveedores
- **Devoluciones**: Retornos de clientes
- **Ajustes Positivos**: Correcciones de inventario
- **Transferencias**: Entre bodegas

##### 📤 **Salidas**
- **Ventas**: Despachos a clientes
- **Consumo Interno**: Uso en servicios
- **Ajustes Negativos**: Correcciones de inventario
- **Mermas**: Pérdidas y desperdicios

#### Proceso de Movimientos

##### 📝 **Entrada Simplificada** (Nuevo en v2.2.0)

El sistema ofrece un formulario simplificado para registrar entradas de inventario rápidamente:

1. **Acceder al formulario**:
   - **Desde Inventario** → Botón "Entrada Rápida"
   - **Desde vista de Stock** → "Agregar Stock"
   - **Desde detalle de producto** → Icono "+"

2. **Completar datos básicos**:
   - **Producto**: Seleccionar de lista o crear nuevo
   - **Cantidad**: Unidades que ingresan
   - **Ubicación**: Donde se almacenarán
   - **Proveedor**: Opcional, de donde proviene
   - **Número de lote**: Para trazabilidad
   - **Fecha de vencimiento**: Si aplica
   - **Notas**: Información adicional

3. **Integración automática**:
   - **Actualización de stock**: Inmediata al guardar
   - **Costo promedio**: Recalcula automáticamente
   - **Notificaciones**: Si el producto estaba en stock bajo
   - **Historial**: Registro completo del movimiento

4. **Crear producto al vuelo**:
   - Si el producto no existe, opción "Crear Nuevo"
   - Formulario simplificado emergente
   - Categorización automática sugerida
   - Registro y asignación inmediata

**Ventajas de Entrada Simplificada:**
- ⚡ **Rapidez**: Registro en segundos
- ✅ **Simplicidad**: Solo campos esenciales
- 🔄 **Integración**: Con proveedores y costos
- 📊 **Trazabilidad**: Lotes y vencimientos

##### 📤 **Salida Simplificada** (Nuevo en v2.2.0)

Formulario optimizado para registrar consumos y salidas:

1. **Acceder al formulario**:
   - **Desde Inventario** → Botón "Salida Rápida"
   - **Desde vista de Stock** → "Reducir Stock"
   - **Desde detalle de producto** → Icono "-"

2. **Completar datos básicos**:
   - **Producto**: Seleccionar existente
   - **Cantidad**: Unidades que salen
   - **Ubicación origen**: De donde se retira
   - **Tipo de salida**: Consumo, venta, préstamo, etc.
   - **Asignar a**:
     - **Servicio**: Si es consumo en trabajo
     - **Grúa**: Si es mantenimiento de equipo
     - **Operador**: Si es asignación personal
   - **Notas**: Motivo o destino

3. **Validaciones automáticas**:
   - **Stock disponible**: Verifica existencias
   - **Alertas de stock bajo**: Si queda por debajo del mínimo
   - **Confirmación**: Si es última unidad o crítico
   - **Bloqueo**: No permite salidas mayores al stock

4. **Integración con servicios**:
   - **Vinculación automática**: Con servicio activo
   - **Costo registrado**: En el servicio correspondiente
   - **Trazabilidad completa**: Desde compra hasta uso

**Ventajas de Salida Simplificada:**
- ⚡ **Control inmediato**: Stock actualizado al instante
- ✅ **Prevención**: Validaciones de stock
- 🔗 **Vinculación**: Con servicios y grúas
- 📊 **Reportes**: Consumo por servicio/grúa

##### 📋 **Movimientos Avanzados**

Para operaciones más complejas:

1. **Registrar Movimiento**:
   - **Seleccionar tipo** de movimiento
   - **Elegir producto** del catálogo
   - **Indicar cantidad** y motivo
   - **Asignar responsable**
   - **Adjuntar documentos**: Facturas, remitos
   - **Fotografías**: Evidencia del movimiento

2. **Validar Información**:
   - **Verificar disponibilidad** (para salidas)
   - **Confirmar precios** y costos
   - **Revisar documentos** de soporte

3. **Procesar Movimiento**:
   - **Actualizar stock** automáticamente
   - **Generar comprobante** del movimiento
   - **Notificar** a responsables

#### Movimientos con Fotografías (Nuevo)
- **Evidencia visual**: Fotos de productos recibidos/despachados
- **Control de calidad**: Documentación de estado
- **Resolución de discrepancias**: Evidencias para reclamaciones

### Reportes de Inventario

#### 📊 **Reporte de Stock**
- **Stock actual** por producto
- **Valorización** del inventario
- **Productos bajo mínimo**
- **Productos sin movimiento**
- **Análisis por lotes** (Nuevo)

#### 📈 **Reporte de Movimientos**
- **Entradas y salidas** por período
- **Consumo por servicio**
- **Rotación de productos**
- **Análisis ABC**
- **Seguimiento de órdenes de compra** (Nuevo)

#### 💰 **Reporte Financiero**
- **Costo de inventario**
- **Margen por producto**
- **Impacto en costos de servicio**
- **Rentabilidad por categoría**
- **Análisis de proveedores** (Nuevo)

### Alertas Inteligentes

#### 🚨 **Alertas Automáticas**
- **Stock mínimo**: Productos bajo el punto de reorden
- **Vencimientos próximos**: Productos con fecha de caducidad cercana
- **Productos sin movimiento**: Items con baja rotación
- **Discrepancias de inventario**: Diferencias en conteos

---

## 11. Gestión de Proveedores

### Registro de Proveedores

#### Información Básica
1. **Acceder a Proveedores** → "Nuevo Proveedor"
2. **Datos del proveedor**:
   - **Razón Social**: Nombre legal de la empresa
   - **NIT**: Número de identificación tributaria
   - **Teléfono**: Contacto principal
   - **Email**: Correo electrónico
   - **Dirección**: Ubicación física

#### Información Comercial
3. **Datos comerciales**:
   - **Tipo de Proveedor**: Repuestos, servicios, combustible, etc.
   - **Categoría**: Clasificación interna
   - **Condiciones de Pago**: Días de crédito
   - **Descuentos**: Porcentajes aplicables
   - **Tiempo de Entrega**: Días promedio

#### Información Financiera
4. **Datos bancarios**:
   - **Banco**: Entidad financiera
   - **Número de Cuenta**: Datos bancarios
   - **Tipo de Cuenta**: Ahorros, corriente
   - **Contacto Comercial**: Persona responsable

### Gestión de Compras y Documentos

#### 📤 **Importación de Documentos XML** (Nuevo en v2.2.0)

El sistema permite importar documentos de proveedores (facturas, notas de crédito) desde archivos XML, facilitando:
- **Facturas electrónicas**: Importación automática desde SII o emisores
- **Notas de crédito/débito**: Documentos tributarios electrónicos
- **Conciliación automática**: Relación con proveedores existentes
- **Registro de pagos**: Programación automática de vencimientos

**Proceso de Importación XML:**

1. **Acceder al Módulo**:
   - **Proveedores** → Pestaña "Importar"
   - O usar botón "Importar XML" en cualquier sección

2. **Subir Documento**:
   - **Seleccionar archivo**: XML tributario (DTE)
   - **Vista previa automática**: Sistema extrae información
   - **Datos detectados**:
     - RUT y razón social del emisor
     - Número y tipo de documento
     - Fecha de emisión
     - Monto total y detalles
     - Fecha de vencimiento

3. **Relación con Proveedor**:
   - **Detección automática**: Por RUT del emisor
   - **Crear nuevo**: Si el proveedor no existe
   - **Selección manual**: Si hay múltiples coincidencias

4. **Configuración del Pago**:
   - **Días hasta vencimiento**: Configurar días para el pago
     - **Campo numérico**: Ingresar días (ej: 30, 60, 90)
     - **Botón "Contado"**: Establecer vencimiento inmediato (0 días)
     - **Cálculo automático**: Fecha de vencimiento = Fecha emisión + Días
   - **Categoría**: Seleccionar tipo de gasto
   - **Prioridad de pago**: Alta, media, baja

5. **Integración con Piezas** (Opcional):
   - Para categoría "Mantenimiento", campos adicionales:
     - **Nombre de la pieza**: Descripción del repuesto
     - **Cantidad**: Unidades compradas
     - **Precio unitario**: Costo por unidad
     - **Grúa**: Asignar a equipo específico
   - **Registro automático**: Sistema crea entrada en `crane_parts`
   - **Actualización de inventario**: Si está configurado

6. **Confirmación**:
   - **Revisión final**: Validar todos los datos
   - **Importar**: Crear pago pendiente automáticamente
   - **Resultado**: Confirmación y detalles del registro

**Ventajas de la Importación XML:**
- ⚡ **Rapidez**: Importación en segundos
- ✅ **Precisión**: Datos directos del documento tributario
- 🔄 **Integración**: Conexión con proveedores e inventario
- 📊 **Trazabilidad**: Documento original vinculado
- 💰 **Control financiero**: Vencimientos automáticos

#### Órdenes de Compra

1. **Crear OC**:
   - **Seleccionar proveedor**
   - **Agregar productos**: Del catálogo o nuevos
   - **Definir cantidades** y precios
   - **Establecer fecha** de entrega esperada

2. **Estados de OC**:
   - **🟡 Borrador**: En construcción
   - **🔵 Enviada**: Entregada al proveedor
   - **🟠 Parcial**: Entrega parcial recibida
   - **🟢 Completa**: Totalmente recibida
   - **🔴 Cancelada**: Anulada

#### Recepción de Mercancía

1. **Validar entrega**:
   - **Verificar cantidades**: Contra orden de compra
   - **Revisar calidad**: Estado de los productos
   - **Documentar diferencias**: Faltantes o sobrantes
   - **Capturar evidencias**: Fotografías si es necesario

2. **Registrar recepción**:
   - **Actualizar inventario**: Automáticamente
   - **Generar entrada**: Movimiento de inventario
   - **Notificar diferencias**: Al proveedor si existen
   - **Autorizar pago**: Si todo está conforme

### Evaluación de Proveedores

#### Criterios de Evaluación
1. **Cumplimiento de Entregas**:
   - **Puntualidad**: % de entregas a tiempo
   - **Completitud**: % de órdenes completas
   - **Calidad**: Productos conformes

2. **Desempeño Comercial**:
   - **Precios competitivos**: Comparación de mercado
   - **Términos de pago**: Flexibilidad financiera
   - **Servicio al cliente**: Atención y soporte

3. **Evaluación Continua**:
   - **Calificación automática**: Basada en métricas
   - **Revisión periódica**: Evaluación manual
   - **Histórico de desempeño**: Tendencias temporales

#### Rating de Proveedores
- **⭐⭐⭐⭐⭐ Excelente**: 90-100% cumplimiento
- **⭐⭐⭐⭐ Bueno**: 80-89% cumplimiento
- **⭐⭐⭐ Regular**: 70-79% cumplimiento
- **⭐⭐ Deficiente**: 60-69% cumplimiento
- **⭐ Malo**: Menos de 60% cumplimiento

### Programación de Pagos

#### Configuración de Pagos
1. **Términos por Proveedor**:
   - **Días de crédito**: 30, 60, 90 días
   - **Descuento por pronto pago**: % aplicable
   - **Forma de pago**: Transferencia, cheque, etc.
   - **Día de pago**: Día específico del mes

2. **Calendario de Pagos**:
   - **Vista mensual**: Pagos programados
   - **Alertas de vencimiento**: Notificaciones
   - **Lotes de pago**: Agrupación por fecha
   - **Aprobación múltiple**: Workflow de autorización

#### Proceso de Pago
1. **Generar lote**:
   - **Filtrar por fecha**: Vencimientos específicos
   - **Seleccionar proveedores**: Individuales o todos
   - **Revisar montos**: Validación de valores
   - **Aplicar descuentos**: Si corresponde

2. **Aprobar pagos**:
   - **Revisión financiera**: Validación de fondos
   - **Autorización**: Firma digital o física
   - **Procesamiento**: Transferencias o cheques
   - **Registro contable**: Asientos automáticos

### Reportes de Proveedores

#### 📊 **Dashboard de Proveedores**
- **Número total**: Proveedores activos
- **Compras del mes**: Monto total
- **Pagos pendientes**: Valores por vencer
- **Top proveedores**: Mayor volumen de compras

#### 📈 **Análisis de Compras**
- **Compras por proveedor**: Histórico y tendencias
- **Cumplimiento de entregas**: Métricas de puntualidad
- **Análisis de precios**: Evolución temporal
- **Evaluación de desempeño**: Calificaciones y tendencias

#### 💰 **Control Financiero**
- **Cuentas por pagar**: Estado actual
- **Flujo de pagos**: Proyección de salidas
- **Descuentos aplicados**: Ahorros obtenidos
- **Análisis de términos**: Optimización de condiciones

---

## 12. Módulo VIP y Pipeline

### ¿Qué es el Pipeline VIP?

El Pipeline VIP es un sistema especializado para el seguimiento y gestión de clientes estratégicos y oportunidades de negocio de alto valor. Permite:

- **Identificar clientes VIP**: Clasificación automática por volumen/valor
- **Seguimiento de oportunidades**: Desde prospecto hasta cliente activo
- **Análisis de conversión**: Métricas de efectividad comercial
- **Gestión de relaciones**: Historial completo de interacciones

### Configuración del Pipeline

#### Criterios VIP
1. **Por Volumen de Servicios**:
   - Número mínimo de servicios por mes
   - Frecuencia de contratación
   - Servicios de alto valor

2. **Por Monto Facturado**:
   - Facturación mínima mensual
   - Valor promedio por servicio
   - Crecimiento en facturación

3. **Por Tipo de Cliente**:
   - Empresas de ciertos sectores
   - Clientes con contratos exclusivos
   - Referencias estratégicas

#### Estados del Pipeline
1. **🎯 Prospecto**: Cliente potencial identificado
2. **📞 Contactado**: Primera comunicación establecida
3. **💬 En Negociación**: Discusión de términos
4. **📝 Propuesta Enviada**: Cotización formal enviada
5. **⏳ Esperando Respuesta**: Aguardando decisión del cliente
6. **✅ Cliente Activo**: Convertido exitosamente
7. **❌ Descartado**: Oportunidad no viable

### Gestión de Oportunidades

#### Crear Oportunidad
1. **Acceder a VIP Pipeline** → "Nueva Oportunidad"
2. **Información del prospecto**:
   - **Empresa**: Razón social
   - **Contacto**: Persona responsable
   - **Teléfono y email**: Datos de contacto
   - **Sector**: Industria o actividad

3. **Detalles de la oportunidad**:
   - **Tipo de servicio**: Servicios de interés
   - **Valor estimado**: Potencial de ingresos
   - **Probabilidad**: % de éxito estimado
   - **Fecha esperada**: Cuándo se espera la conversión

#### Seguimiento de Oportunidades
1. **Actividades registradas**:
   - **Llamadas**: Fecha, duración, resultado
   - **Emails**: Enviados y recibidos
   - **Reuniones**: Presenciales o virtuales
   - **Propuestas**: Cotizaciones enviadas

2. **Notas y observaciones**:
   - **Necesidades del cliente**: Requerimientos específicos
   - **Objeciones**: Dudas o resistencias
   - **Próximos pasos**: Acciones planificadas
   - **Decisores**: Personas clave en la decisión

### Análisis y Métricas VIP

#### 📊 **Dashboard VIP**
- **Oportunidades activas**: En cada estado del pipeline
- **Valor total del pipeline**: Suma de oportunidades
- **Tasa de conversión**: % de éxito histórico
- **Tiempo promedio**: Días desde prospecto a cliente

#### 📈 **Métricas de Conversión**
- **Por estado**: Conversión entre fases
- **Por origen**: Fuente de las oportunidades
- **Por vendedor**: Desempeño individual
- **Por período**: Tendencias temporales

#### 💰 **Análisis Financiero**
- **Valor promedio**: Por oportunidad convertida
- **ROI del pipeline**: Retorno de la inversión comercial
- **Proyección de ingresos**: Basada en probabilidades
- **Clientes VIP activos**: Facturación y tendencias

### Automatizaciones VIP

#### 🤖 **Clasificación Automática**
- **Evaluación continua**: Revisión mensual de clientes
- **Promoción a VIP**: Automática por criterios
- **Alertas de riesgo**: Clientes VIP con baja actividad
- **Oportunidades de up-selling**: Basadas en patrones

#### 📧 **Comunicaciones Automáticas**
- **Follow-up programado**: Recordatorios de contacto
- **Escalamiento**: Notificaciones a supervisores
- **Reportes automáticos**: Resúmenes semanales
- **Alertas de actividad**: Cambios en el pipeline

### Reportes VIP

#### 📋 **Reporte de Pipeline**
- **Estado actual**: Oportunidades por fase
- **Análisis de embudo**: Cuellos de botella
- **Proyección de ventas**: Estimaciones futuras
- **Histórico de conversiones**: Tendencias

#### 👥 **Reporte de Clientes VIP**
- **Listado actualizado**: Clientes VIP activos
- **Análisis de comportamiento**: Patrones de consumo
- **Satisfacción**: Métricas de servicio
- **Oportunidades**: Potencial de crecimiento

---

## 13. Facturación Diferida

### ¿Qué es la Facturación Diferida?

La Facturación Diferida permite configurar ciclos de facturación personalizados por cliente, agrupando servicios según períodos específicos antes de generar las facturas. Esto es útil para:

- **Clientes corporativos**: Que prefieren facturación mensual o quincenal
- **Contratos especiales**: Con términos de facturación específicos
- **Optimización de flujo**: Reducir número de facturas por cliente
- **Control financiero**: Mejor manejo de cuentas por cobrar

### Configuración por Cliente

#### Ciclos de Facturación
1. **Acceder a Cliente** → "Configurar Facturación Diferida"
2. **Seleccionar tipo de ciclo**:
   - **Semanal**: Facturación cada 7 días
   - **Quincenal**: Cada 15 días
   - **Mensual**: Una vez al mes
   - **Personalizado**: Días específicos configurables

#### Parámetros de Configuración
1. **Día de corte**:
   - **Fijo**: Siempre el mismo día del mes (ej: día 15)
   - **Variable**: Último día hábil del período
   - **Personalizado**: Días específicos del cliente

2. **Condiciones especiales**:
   - **Monto mínimo**: Valor mínimo para generar factura
   - **Agrupación**: Por tipo de servicio o centro de costo
   - **Retención**: Porcentaje de retención automática
   - **Descuentos**: Por volumen o pronto pago

#### Calendario de Facturación
- **Vista mensual**: Fechas de generación de facturas
- **Alertas previas**: Notificaciones antes del corte
- **Servicios acumulados**: Conteo de servicios por facturar
- **Valor acumulado**: Monto total pendiente

### Dashboard de Facturación Diferida

#### 📊 **Métricas Principales**
- **Clientes con diferimiento**: Número total configurado
- **Servicios pendientes**: Listos para próxima facturación
- **Valor pendiente**: Monto total por facturar
- **Próximos cortes**: Fechas de generación próximas

#### 📅 **Calendario de Cortes**
- **Vista cronológica**: Fechas de todos los clientes
- **Conflictos**: Múltiples cortes en misma fecha
- **Carga de trabajo**: Volumen por día de facturación
- **Planificación**: Ajustes necesarios en fechas

#### 🎯 **Servicios Listos para Facturar**
- **Agrupados por cliente**: Servicios acumulados
- **Filtros por período**: Últimos 30, 60, 90 días
- **Estado de servicios**: Completados y listos
- **Validación**: Verificación de datos obligatorios

### Proceso de Facturación Diferida

#### Generación Automática
1. **Evaluación diaria**: Sistema revisa fechas de corte
2. **Identificación**: Clientes con facturación programada
3. **Agrupación**: Servicios según configuración
4. **Validación**: Verificación de datos completos
5. **Generación**: Creación automática de facturas

#### Generación Manual
1. **Seleccionar cliente**: Con diferimiento configurado
2. **Revisar servicios**: Pendientes de facturar
3. **Configurar período**: Fechas específicas si necesario
4. **Validar información**: Completitud de datos
5. **Generar factura**: Proceso manual dirigido

#### Excepciones y Ajustes
- **Servicios excluidos**: Filtrar por criterios específicos
- **Ajustes de precio**: Descuentos o recargos especiales
- **Facturas parciales**: Anticipos o pagos a cuenta
- **Correcciones**: Modificaciones antes de envío

### Control y Seguimiento

#### 📈 **Análisis de Facturación**
- **Eficiencia del proceso**: Tiempo de generación
- **Volumen por cliente**: Servicios facturados
- **Tendencias de consumo**: Patrones por cliente
- **Cumplimiento de ciclos**: Adherencia a configuración

#### 🔍 **Auditoría**
- **Histórico de facturas**: Trazabilidad completa
- **Cambios de configuración**: Log de modificaciones
- **Excepciones aplicadas**: Registro de casos especiales
- **Validaciones**: Verificaciones automáticas

#### 📊 **Reportes Especializados**
- **Facturación diferida vs normal**: Comparación de métodos
- **Impacto en flujo de caja**: Análisis financiero
- **Satisfacción del cliente**: Feedback sobre el proceso
- **Optimización**: Recomendaciones de mejora

### Notificaciones y Alertas

#### 🔔 **Alertas Automáticas**
- **Próximos cortes**: 3 días antes de la fecha
- **Servicios sin facturar**: Acumulación excesiva
- **Datos incompletos**: Servicios con información faltante
- **Cambios de configuración**: Modificaciones aplicadas

#### 📧 **Comunicaciones al Cliente**
- **Pre-facturación**: Resumen de servicios a facturar
- **Factura generada**: Notificación de nueva factura
- **Recordatorios de pago**: Según términos acordados
- **Cambios en configuración**: Notificación de modificaciones

---

## 14. Sistema de Backup y Restauración

### Importancia del Backup

El sistema de backup automatizado protege toda la información crítica del negocio, incluyendo:

- **Datos de servicios**: Histórico completo de operaciones
- **Información financiera**: Facturas, pagos, comisiones
- **Inventarios**: Stocks, movimientos, valorizaciones
- **Configuraciones**: Parámetros del sistema y usuarios
- **Documentos**: Adjuntos, fotos, firmas digitales

### Configuración de Backups

#### Tipos de Backup
1. **Backup Completo**:
   - **Incluye**: Toda la base de datos
   - **Frecuencia**: Semanal recomendado
   - **Tiempo**: Mayor duración
   - **Espacio**: Mayor requerimiento

2. **Backup Incremental**:
   - **Incluye**: Solo cambios desde último backup
   - **Frecuencia**: Diario recomendado
   - **Tiempo**: Menor duración
   - **Espacio**: Menor requerimiento

3. **Backup Diferencial**:
   - **Incluye**: Cambios desde último backup completo
   - **Frecuencia**: Personalizable
   - **Tiempo**: Duración media
   - **Espacio**: Requerimiento medio

#### Programación de Backups
1. **Acceder a Configuración** → "Sistema de Backup"
2. **Configurar horarios**:
   - **Backup completo**: Domingos 2:00 AM
   - **Backup incremental**: Diario 3:00 AM
   - **Backup diferencial**: Miércoles 2:30 AM

3. **Parámetros avanzados**:
   - **Retención**: Cuántos backups mantener
   - **Compresión**: Nivel de compresión aplicado
   - **Encriptación**: Seguridad de los backups
   - **Notificaciones**: Alertas de éxito/error

### Ejecución de Backups

#### 🤖 **Backups Automáticos**
- **Programación**: Según configuración establecida
- **Validación**: Verificación automática de integridad
- **Notificaciones**: Reportes de estado por email
- **Monitoreo**: Alertas en caso de fallas

#### 📱 **Backups Manuales**
1. **Situaciones recomendadas**:
   - Antes de actualizaciones importantes
   - Cambios masivos de configuración
   - Migraciones de datos
   - Mantenimientos programados

2. **Proceso manual**:
   - **Acceder al módulo** de backup
   - **Seleccionar tipo** de backup
   - **Confirmar ejecución**
   - **Monitorear progreso**

#### Validación de Backups
- **Verificación automática**: Integridad de archivos
- **Pruebas periódicas**: Restauración de prueba
- **Reportes de estado**: Salud de los backups
- **Alertas de problemas**: Notificaciones inmediatas

### Restauración de Datos

#### Tipos de Restauración
1. **Restauración Completa**:
   - **Escenario**: Pérdida total de datos
   - **Proceso**: Restaurar backup completo más reciente
   - **Tiempo**: Varias horas según volumen
   - **Resultado**: Sistema completamente funcional

2. **Restauración Parcial**:
   - **Escenario**: Pérdida de datos específicos
   - **Proceso**: Restaurar módulos o tablas específicas
   - **Tiempo**: Menor duración
   - **Resultado**: Recuperación selectiva

3. **Restauración Point-in-Time**:
   - **Escenario**: Recuperar datos hasta momento específico
   - **Proceso**: Combinar backups completo + incrementales
   - **Tiempo**: Variable según punto de recuperación
   - **Resultado**: Datos hasta momento exacto

#### Proceso de Restauración
1. **Evaluación de la situación**:
   - **Identificar** qué datos se perdieron
   - **Determinar** punto de recuperación deseado
   - **Seleccionar** backup apropiado
   - **Planificar** ventana de mantenimiento

2. **Ejecución de la restauración**:
   - **Detener** servicios del sistema
   - **Ejecutar** proceso de restauración
   - **Validar** integridad de datos
   - **Reiniciar** servicios

3. **Verificación post-restauración**:
   - **Probar** funcionalidades críticas
   - **Verificar** integridad de datos
   - **Validar** configuraciones
   - **Comunicar** estado a usuarios

### Monitoreo y Alertas

#### 📊 **Dashboard de Backups**
- **Estado actual**: Último backup exitoso
- **Próximo programado**: Fecha y hora del siguiente
- **Espacio utilizado**: Almacenamiento consumido
- **Historial**: Registro de backups anteriores

#### 🚨 **Alertas Críticas**
- **Backup fallido**: Falla en ejecución automática
- **Espacio insuficiente**: Almacenamiento limitado
- **Corrupción detectada**: Problemas de integridad
- **Backups obsoletos**: Muy antiguos o insuficientes

#### 📈 **Reportes de Backup**
- **Reporte semanal**: Estado general del sistema
- **Análisis de tendencias**: Crecimiento de datos
- **Tiempo de ejecución**: Optimización de horarios
- **Recomendaciones**: Mejoras sugeridas

### Mejores Prácticas

#### 🔐 **Seguridad**
- **Encriptación**: Todos los backups deben estar encriptados
- **Acceso restringido**: Solo personal autorizado
- **Almacenamiento offsite**: Copias en ubicación diferente
- **Pruebas regulares**: Validación periódica

#### ⚡ **Rendimiento**
- **Horarios optimizados**: Fuera de horas pico
- **Compresión**: Reducir espacio de almacenamiento
- **Paralelización**: Múltiples procesos simultáneos
- **Monitoreo continuo**: Seguimiento de rendimiento

#### 📋 **Documentación**
- **Procedimientos**: Documentación de procesos
- **Contactos**: Responsables y escalamiento
- **Inventario**: Catálogo de backups disponibles
- **Planes de contingencia**: Escenarios de recuperación

---

## 15. Entradas Rápidas

### ¿Qué son las Entradas Rápidas?

Las Entradas Rápidas son un sistema de registro instantáneo de gastos y eventos desde dispositivos móviles, especialmente diseñado para operadores en campo. Permite:

- **Registro inmediato**: Gastos y eventos en tiempo real
- **Geolocalización automática**: GPS integrado para ubicación exacta
- **Captura multimedia**: Fotos y documentos de soporte
- **Sincronización**: Datos se sincronizan automáticamente
- **Categorización**: Clasificación automática de gastos

### Funcionalidades Principales

#### 📱 **Registro Móvil**
1. **Acceso rápido**: 
   - **Botón flotante "+"**: Visible en todas las páginas del sistema
   - **Ubicación**: Esquina inferior derecha de la pantalla
   - **Disponible para**: Administradores y operadores autorizados
   - **Acceso instantáneo**: Sin necesidad de navegar a menú específico
2. **Formulario simplificado**: Mínimos campos requeridos
3. **Opciones predefinidas**: Categorías comunes
4. **Guardado offline**: Funciona sin conexión

#### 🗺️ **GPS Automático**
- **Ubicación exacta**: Coordenadas precisas del evento
- **Validación geográfica**: Verificación de coherencia
- **Mapeo visual**: Visualización en mapa
- **Histórico de ubicaciones**: Seguimiento de rutas

#### 📸 **Captura Multimedia**
- **Fotos de comprobantes**: Facturas, recibos, tickets
- **Fotos de evidencia**: Daños, situaciones especiales
- **Documentos**: PDFs y otros archivos
- **Compresión automática**: Optimización para móvil

### Tipos de Entradas Rápidas

#### ⛽ **Gastos de Combustible**
- **Datos requeridos**:
  - Monto del gasto
  - Litros cargados
  - Estación de servicio
  - Kilometraje actual
- **Automático**: GPS detecta ubicación de estación
- **Validación**: Coherencia con consumo esperado

#### 🅿️ **Parqueaderos y Peajes**
- **Información básica**:
  - Tipo de gasto (parqueadero/peaje)
  - Monto pagado
  - Ubicación automática
  - Hora del evento
- **Categorización**: Automática por ubicación conocida

#### 🔧 **Mantenimiento Urgente**
- **Registro de falla**:
  - Tipo de problema
  - Grúa afectada
  - Descripción del daño
  - Fotos de evidencia
- **Alertas**: Notificación inmediata a supervisores
- **Seguimiento**: Estado de la reparación

#### 📋 **Eventos Especiales**
- **Situaciones particulares**:
  - Demoras en ruta
  - Problemas con cliente
  - Condiciones climáticas adversas
  - Otros eventos relevantes
- **Documentación**: Descripción detallada y fotos

### Proceso de Registro

#### 📝 **Paso a Paso**
1. **Abrir app móvil**: TMS Grúas PWA
2. **Tocar botón "+"**: Acceso rápido flotante
3. **Seleccionar tipo**: Categoría del gasto/evento
4. **Completar formulario**: Datos mínimos requeridos
5. **Capturar evidencia**: Fotos o documentos
6. **Confirmar ubicación**: GPS automático
7. **Guardar entrada**: Local si no hay conexión

#### ⚡ **Funciones Inteligentes**
- **Auto-completado**: Datos frecuentes se sugieren
- **Reconocimiento**: OCR básico en comprobantes
- **Validación**: Verificación de datos ingresados
- **Sugerencias**: Categorías basadas en ubicación

### Gestión de Entradas Pendientes

#### 📋 **Vista de Entradas Pendientes**
1. **Acceder a "Entradas Rápidas"**
2. **Ver listado**: Todas las entradas sin procesar
3. **Filtros disponibles**:
   - Por operador
   - Por fecha
   - Por tipo de gasto
   - Por estado (pendiente/procesado)

#### ✅ **Procesamiento de Entradas**
1. **Revisar información**: Validar datos ingresados
2. **Verificar evidencias**: Fotos y documentos adjuntos
3. **Categorizar correctamente**: Ajustar si es necesario
4. **Asignar a centro de costo**: Según configuración
5. **Aprobar y procesar**: Convertir a gasto formal

#### 🔍 **Validación y Control**
- **Geolocalización**: Verificar coherencia de ubicaciones
- **Duplicados**: Detección automática de entradas similares
- **Límites**: Validación contra políticas de gastos
- **Autorización**: Workflow según montos

### Reportes y Análisis

#### 📊 **Dashboard de Entradas Rápidas**
- **Entradas pendientes**: Número por procesar
- **Gastos del día**: Monto acumulado
- **Por operador**: Ranking de uso
- **Por categoría**: Distribución de gastos

#### 📈 **Análisis de Patrones**
- **Gastos por ruta**: Análisis geográfico
- **Frecuencia por operador**: Uso del sistema
- **Tipos de gasto más comunes**: Optimización de categorías
- **Ubicaciones frecuentes**: Mapeo de gastos

#### 🗺️ **Mapas de Calor**
- **Gastos por zona**: Visualización geográfica
- **Rutas costosas**: Identificación de patrones
- **Estaciones frecuentes**: Combustible por ubicación
- **Zonas problemáticas**: Concentración de eventos

### Configuración y Personalización

#### ⚙️ **Configuración del Sistema**
1. **Categorías de gasto**: Personalizar tipos disponibles
2. **Límites por categoría**: Montos máximos sin autorización
3. **Campos obligatorios**: Configurar información requerida
4. **Workflow de aprobación**: Definir proceso de validación

#### 👤 **Configuración por Operador**
- **Límites individuales**: Montos por operador
- **Categorías permitidas**: Restricciones por rol
- **Notificaciones**: Configurar alertas personales
- **Favoritos**: Categorías más usadas por operador

#### 📱 **Optimización Móvil**
- **Calidad de fotos**: Balance entre calidad y tamaño
- **Sincronización**: Frecuencia de envío de datos
- **Modo offline**: Capacidad de almacenamiento local
- **Batería**: Optimización de consumo energético

---

## 16. Módulo Financiero

### Gestión de Costos

#### Tipos de Costos

##### 🚛 **Costos Operacionales**
- **Combustible**: Consumo por servicio
- **Mantenimiento**: Reparaciones y revisiones
- **Peajes**: Costos de tránsito
- **Parqueaderos**: Estacionamientos
- **Repuestos**: Piezas y componentes
- **Neumáticos**: Llantas y mantenimiento

##### 👨‍💼 **Costos de Personal**
- **Salarios**: Remuneración base
- **Comisiones**: Pagos por servicio
- **Prestaciones**: Beneficios sociales
- **Capacitación**: Formación del personal
- **Horas extras**: Tiempo adicional
- **Bonificaciones**: Incentivos especiales

##### 🏢 **Costos Administrativos**
- **Seguros**: Pólizas de la flota
- **Licencias**: Permisos y certificaciones
- **Servicios**: Comunicaciones, software
- **Arriendo**: Instalaciones y equipos
- **Servicios públicos**: Luz, agua, internet
- **Otros**: Gastos diversos

#### Centros de Costo (Nuevo en v2.2.0)

##### Configuración de Centros
1. **Acceder a Configuración** → "Centros de Costo"
2. **Crear centros**:
   - **Por región**: Norte, Sur, Centro
   - **Por tipo de servicio**: Grúas, transporte, logística
   - **Por cliente**: Contratos exclusivos
   - **Por proyecto**: Trabajos específicos

##### Asignación Automática
- **Por servicio**: Según cliente o tipo
- **Por grúa**: Según asignación de equipo
- **Por operador**: Según centro base
- **Por ubicación**: Según GPS del gasto

#### Registro de Costos

##### 📝 **Registro Manual**

1. **Crear Costo**:
   - **Seleccionar categoría** del costo
   - **Asignar a servicio** o grúa
   - **Definir centro de costo**
   - **Indicar monto** y fecha
   - **Adjuntar soporte** (factura, recibo)

2. **Validar Costo**:
   - **Revisar información** ingresada
   - **Verificar documentos** de soporte
   - **Validar centro de costo**
   - **Aprobar** o rechazar

3. **Procesar Costo**:
   - **Afectar contabilidad**
   - **Actualizar reportes**
   - **Distribuir por centro**
   - **Notificar** a responsables

##### 📤 **Carga Masiva XML** (Nuevo en v2.2.0)

El sistema permite importar costos masivamente desde archivos XML, ideal para:
- **Facturas electrónicas**: Importación directa de documentos fiscales
- **Reportes de gastos**: Integración con sistemas externos
- **Migración de datos**: Importación desde otros sistemas
- **Conciliación bancaria**: Carga de extractos en formato XML

**Proceso de Carga XML:**

1. **Preparar Archivo**:
   - **Formato**: Archivo XML válido
   - **Estructura**: Debe contener datos de costos (fecha, monto, descripción, categoría)
   - **Validación**: Sistema detecta automáticamente la estructura

2. **Subir Archivo**:
   - **Acceder a Costos** → Botón "Cargar XML"
   - **Seleccionar archivo**: Arrastrar y soltar o explorar
   - **Analizar**: Sistema procesa y valida el XML

3. **Revisión y Mapeo**:
   - **Vista previa**: Sistema muestra costos detectados
   - **Mapeo de categorías**: Asignar categorías del XML a categorías del sistema
   - **Validación de datos**: 
     - ✅ Datos válidos (verde)
     - ⚠️ Advertencias (amarillo)
     - ❌ Errores (rojo)
   - **Revisión manual**: Corregir datos si es necesario

4. **Configuración de Importación**:
   - **Categoría por defecto**: Para costos sin categoría
   - **Asignación automática**: Grúa, operador o servicio
   - **Duplicados**: Opción de omitir o importar

5. **Importar**:
   - **Confirmar importación**: Botón "Importar Costos"
   - **Progreso en tiempo real**: Barra de progreso
   - **Resultado**: Resumen de costos importados
   - **Errores**: Log detallado de problemas

6. **Validación Post-Importación**:
   - **Revisar costos**: En la lista principal
   - **Verificar categorías**: Correcta asignación
   - **Ajustar si necesario**: Editar costos importados

**Ventajas de la Carga XML:**
- ⚡ **Rapidez**: Importar cientos de costos en segundos
- ✅ **Precisión**: Reducción de errores de digitación
- 🔄 **Integración**: Conexión con sistemas externos
- 📊 **Trazabilidad**: Registro del archivo de origen

### Gestión de Ingresos (Nuevo en v2.2.0)

El módulo de Ingresos permite registrar y controlar todos los ingresos de la empresa, complementando el sistema de facturación y proporcionando un control financiero completo.

#### Tipos de Ingresos

##### 💰 **Ingresos Operacionales**
- **Servicios facturados**: Ingresos por servicios de grúas
- **Pagos de clientes**: Cobros de facturas
- **Anticipos**: Pagos adelantados de clientes
- **Servicios adicionales**: Cargos extra no facturados inicialmente

##### 💵 **Otros Ingresos**
- **Venta de activos**: Equipos o vehículos vendidos
- **Arriendos**: Alquiler de equipos o instalaciones
- **Intereses**: Rendimientos financieros
- **Recuperaciones**: Reembolsos o devoluciones
- **Diversos**: Otros ingresos eventuales

#### Registro de Ingresos

1. **Crear Ingreso**:
   - **Acceder a Finanzas** → "Ingresos"
   - **Botón "+ Nuevo Ingreso"**
   - **Completar formulario**:
     - **Fecha**: Fecha del ingreso
     - **Concepto**: Descripción clara
     - **Categoría**: Tipo de ingreso
     - **Monto**: Valor del ingreso
     - **Cliente** (opcional): Si está relacionado
     - **Método de pago**: Efectivo, transferencia, cheque
     - **Comprobante**: Adjuntar documento

2. **Validar Ingreso**:
   - **Revisión de datos**: Verificar información completa
   - **Verificar comprobantes**: Documentos de respaldo
   - **Conciliación**: Comparar con extractos bancarios
   - **Aprobar**: Confirmar el registro

#### Dashboard de Ingresos

##### 📊 **Métricas Principales**
- **Total del mes**: Ingresos acumulados del mes actual
- **Ingresos del día**: Entradas de hoy
- **Promedio diario**: Ingreso promedio por día
- **Comparación**: Mes actual vs. mes anterior

##### 📈 **Análisis de Ingresos**
- **Por categoría**: Distribución de tipos de ingreso
- **Por cliente**: Principales fuentes de ingresos
- **Por método de pago**: Forma de cobro preferida
- **Tendencias**: Evolución temporal de ingresos

##### 🔍 **Filtros Avanzados**
- **Por fecha**: Rango de fechas específico
- **Por categoría**: Tipo de ingreso
- **Por cliente**: Ingresos de cliente específico
- **Por método**: Forma de pago
- **Por monto**: Rangos de valores

#### Conciliación Bancaria

1. **Comparar con extractos**:
   - **Ingresos registrados**: En el sistema
   - **Movimientos bancarios**: Del banco
   - **Identificar diferencias**: Partidas pendientes

2. **Conciliar automáticamente**:
   - **Matching por monto y fecha**: Sistema sugiere coincidencias
   - **Confirmar conciliación**: Marcar como conciliado
   - **Pendientes**: Identificar ingresos no reflejados

#### Reportes de Ingresos

##### 📊 **Reporte Mensual**
- **Total por mes**: Ingresos del período
- **Desglose por categoría**: Distribución detallada
- **Clientes top**: Mayores contribuyentes
- **Comparativo**: Mes actual vs. anterior

##### 📈 **Análisis Anual**
- **Ingresos por mes**: Tendencia anual
- **Estacionalidad**: Patrones temporales
- **Proyecciones**: Estimaciones futuras
- **Crecimiento**: Variación año a año

### Sistema de Comisiones Avanzado

#### Esquemas de Comisión (Mejorado v2.2.0)

##### Por Operador
- **Porcentaje fijo**: % sobre valor del servicio
- **Monto fijo**: Valor constante por servicio
- **Escala variable**: Según tipo de servicio
- **Bonificaciones**: Incentivos adicionales
- **Metas**: Objetivos con comisiones especiales

##### Por Tipo de Servicio
- **Servicios estándar**: Comisión base
- **Servicios especiales**: Comisión premium
- **Servicios nocturnos**: Recargo adicional
- **Servicios de emergencia**: Bonificación extra
- **Servicios VIP**: Comisión diferenciada

##### Por Rendimiento
- **Eficiencia**: Tiempo de ejecución vs. estimado
- **Calidad**: Calificación del cliente
- **Puntualidad**: Cumplimiento de horarios
- **Seguridad**: Servicios sin incidentes

#### Cálculo Automático de Comisiones

1. **Configuración de reglas**:
   - **Definir esquemas** por operador/servicio
   - **Establecer condiciones** de aplicación
   - **Configurar excepciones** especiales
   - **Programar cálculos** automáticos

2. **Procesamiento automático**:
   - **Al completar servicio**: Cálculo inmediato
   - **Según configuración**: Reglas predefinidas
   - **Validación automática**: Verificación de reglas
   - **Notificaciones**: Alertas de comisiones calculadas

#### Pago Masivo de Comisiones

1. **Generar Lote de Pago**:
   - **Seleccionar período**: Rango de fechas
   - **Filtrar operadores**: Específicos o todos
   - **Revisar cálculos**: Validar montos
   - **Aplicar descuentos**: Deducciones si existen

2. **Procesar Pago Masivo**:
   - **Generar comprobantes**: Documentos individuales
   - **Autorizar pagos**: Workflow de aprobación
   - **Procesar transferencias**: Pagos bancarios
   - **Actualizar estados**: Marcar como pagado
   - **Registrar en contabilidad**: Asientos automáticos

### Facturación Avanzada

#### Creación de Facturas

1. **Desde Servicios**:
   - **Seleccionar servicios** completados
   - **Agrupar por cliente** si es necesario
   - **Aplicar descuentos** configurados
   - **Generar factura** automáticamente

2. **Desde Cierres**:
   - **Seleccionar cierre** cerrado
   - **Validar información** completa
   - **Generar factura** del cierre
   - **Actualizar estado** del cierre

3. **Manual**:
   - **Crear factura** desde cero
   - **Agregar conceptos** manualmente
   - **Calcular impuestos** y totales
   - **Aplicar configuración** del cliente

#### Estados de Factura

##### 🟡 **Borrador**
- Factura en creación
- **Acciones**: Editar, eliminar, duplicar

##### 🔵 **Enviada**
- Factura entregada al cliente
- **Acciones**: Ver, anular, reenviar

##### 🟢 **Pagada**
- Factura cancelada por el cliente
- **Acciones**: Ver, generar recibo

##### 🔴 **Vencida**
- Factura no pagada en término
- **Acciones**: Gestión de cartera, recordatorios

##### ⚫ **Anulada**
- Factura cancelada
- **Acciones**: Ver historial, generar nota crédito

#### Conciliación de Pagos

1. **Registrar Pago**:
   - **Seleccionar factura**
   - **Indicar monto** recibido
   - **Método de pago**: Efectivo, transferencia, etc.
   - **Fecha de pago**
   - **Comprobante**: Adjuntar soporte

2. **Conciliar Automáticamente**:
   - **Verificar montos**
   - **Aplicar descuentos** configurados
   - **Generar recibo** automático
   - **Actualizar cartera**
   - **Notificar** al cliente

### Análisis Financiero

#### 📊 **Dashboard Financiero**
- **Ingresos del mes**: Facturación actual
- **Costos del mes**: Gastos acumulados
- **Margen de utilidad**: Rentabilidad
- **Cartera por cobrar**: Facturas pendientes
- **Flujo de caja**: Proyección de ingresos/egresos

#### 📈 **Reportes de Rentabilidad**
- **Por servicio**: Margen individual
- **Por cliente**: Rentabilidad por cliente
- **Por grúa**: Eficiencia financiera de equipos
- **Por operador**: Productividad financiera
- **Por centro de costo**: Análisis departamental

#### 💰 **Control de Flujo de Caja**
- **Ingresos proyectados**: Basado en servicios programados
- **Egresos programados**: Pagos y costos planificados
- **Balance diario**: Seguimiento día a día
- **Alertas de liquidez**: Notificaciones de bajo flujo

---

## 17. Sistema de Reportes

### Dashboard de Reportes

#### Pestañas Principales

##### 📊 **Dashboard**
- **Métricas generales**: KPIs principales
- **Gráficos de tendencias**: Evolución temporal
- **Alertas**: Indicadores críticos
- **Resumen ejecutivo**: Vista consolidada
- **Comparativos**: Período actual vs. anterior

##### 🚛 **Operacional**
- **Servicios por estado**: Distribución actual
- **Utilización de grúas**: Eficiencia de flota
- **Productividad de operadores**: Rendimiento individual
- **Tiempos de servicio**: Análisis de duración
- **Cumplimiento de horarios**: Puntualidad
- **Servicios por zona**: Análisis geográfico

##### 💰 **Financiero**
- **Ingresos por período**: Evolución de facturación
- **Costos por categoría**: Distribución de gastos
- **Rentabilidad por servicio**: Margen individual
- **Comisiones pagadas**: Costos de personal
- **Cartera por edades**: Análisis de cobranza
- **Flujo de caja**: Proyecciones financieras

##### 📦 **Inventario**
- **Stock actual**: Disponibilidad por producto
- **Movimientos**: Entradas y salidas
- **Valorización**: Valor del inventario
- **Rotación**: Análisis de movimiento
- **Productos críticos**: Bajo stock o sin movimiento

##### 🔧 **Mantenimiento**
- **Programación**: Mantenimientos pendientes
- **Historial**: Trabajos realizados
- **Costos de mantenimiento**: Gastos por equipo
- **Disponibilidad**: Tiempo operativo vs. mantenimiento
- **Eficiencia**: Índices de rendimiento

##### 🎯 **VIP y Pipeline** (Nuevo)
- **Estado del pipeline**: Oportunidades por fase
- **Conversiones**: Tasas de éxito
- **Valor del pipeline**: Potencial de ingresos
- **Clientes VIP**: Análisis de comportamiento
- **Proyecciones**: Estimaciones futuras

### Filtros y Personalización

#### Filtros Globales
- **Rango de fechas**: Período específico
- **Cliente**: Servicios por empresa
- **Grúa**: Análisis por equipo
- **Operador**: Rendimiento individual
- **Tipo de servicio**: Categorización
- **Estado**: Filtro por estado actual
- **Centro de costo**: Análisis departamental (Nuevo)

#### Opciones de Vista
- **Gráficos**: Visualización gráfica avanzada
- **Tablas**: Datos tabulares detallados
- **Resumen**: Vista consolidada ejecutiva
- **Detalle**: Información completa
- **Comparativo**: Análisis de períodos

#### Personalización Avanzada
- **Dashboards personalizados**: Configuración por usuario
- **Métricas favoritas**: Accesos rápidos
- **Alertas personalizadas**: Notificaciones configurables
- **Temas visuales**: Personalización de apariencia

### Nuevos Reportes v2.2.0

#### 📋 **Reporte de Cierres**
- **Eficiencia del proceso**: Tiempo promedio de cierre
- **Servicios por cierre**: Productividad
- **Auto-completado de OC**: Efectividad del sistema
- **Ciclo de facturación**: Desde servicio hasta factura

#### 🎯 **Reporte VIP Pipeline**
- **Análisis de embudo**: Conversión por fase
- **Valor por oportunidad**: Métricas financieras
- **Tiempo de conversión**: Eficiencia comercial
- **ROI del pipeline**: Retorno de inversión

#### 📅 **Reporte de Facturación Diferida**
- **Servicios acumulados**: Por cliente y período
- **Eficiencia de cortes**: Cumplimiento de fechas
- **Impacto en flujo**: Análisis financiero
- **Satisfacción del cliente**: Feedback del proceso

#### 🏃 **Reporte de Entradas Rápidas**
- **Uso por operador**: Adopción del sistema
- **Gastos por categoría**: Distribución
- **Análisis geográfico**: Patrones de ubicación
- **Tiempo de procesamiento**: Eficiencia operativa

#### 🏢 **Reporte de Centros de Costo**
- **Rentabilidad por centro**: Análisis de márgenes
- **Distribución de costos**: Asignación automática vs manual
- **Comparativo entre centros**: Benchmarking interno
- **Tendencias por centro**: Evolución temporal

### Exportación de Reportes

#### Formatos Disponibles
- **Excel**: Hojas de cálculo editables con múltiples pestañas
- **PDF**: Documentos para impresión con gráficos
- **CSV**: Datos para análisis en herramientas externas
- **Imagen**: Gráficos para presentaciones
- **PowerBI**: Conectores para análisis avanzado (Nuevo)

#### Opciones de Exportación
1. **Configurar reporte**: Aplicar filtros y personalización
2. **Seleccionar formato**: Según uso previsto
3. **Programar envío**: Reportes automáticos por email
4. **Descargar**: Archivo generado inmediatamente

#### Reportes Programados
- **Frecuencia**: Diario, semanal, mensual
- **Destinatarios**: Lista de correos configurables
- **Filtros automáticos**: Aplicación de criterios predefinidos
- **Formato estándar**: Configuración por tipo de reporte

### Análisis Avanzado

#### 📈 **Tendencias y Proyecciones**
- **Análisis de series temporales**: Patrones históricos
- **Proyecciones**: Estimaciones futuras basadas en tendencias
- **Análisis estacional**: Comportamientos cíclicos
- **Detección de anomalías**: Identificación de valores atípicos

#### 🔍 **Análisis Comparativo**
- **Año vs. año**: Comparación interanual
- **Mes vs. mes**: Evolución mensual
- **Benchmarking**: Comparación con estándares de la industria
- **Análisis de varianza**: Desviaciones significativas

#### 🎯 **KPIs Especializados**
- **Eficiencia operativa**: Métricas de rendimiento
- **Satisfacción del cliente**: Indicadores de calidad
- **Rentabilidad**: Márgenes y retornos
- **Crecimiento**: Tasas de expansión del negocio

---

## 18. Herramientas Administrativas

### Gestión de Tipos de Servicio

#### Configuración de Tipos
1. **Acceder a Configuración** → "Tipos de Servicio"
2. **Crear nuevo tipo**:
   - **Nombre**: Identificación del tipo
   - **Descripción**: Detalles del servicio
   - **Categoría**: Clasificación general
   - **Duración estimada**: Tiempo promedio
   - **Recursos requeridos**: Grúa, operadores, equipos

#### Tarifas por Tipo de Servicio
1. **Configuración de precios**:
   - **Tarifa base**: Precio estándar
   - **Tarifas especiales**: Por cliente o volumen
   - **Recargos**: Horarios especiales, distancia
   - **Descuentos**: Por volumen o tipo de cliente

2. **Variables de precio**:
   - **Por distancia**: Tarifa por kilómetro
   - **Por tiempo**: Tarifa por hora
   - **Por peso**: Tarifa por tonelada
   - **Por complejidad**: Servicios especializados

#### Categorización Avanzada
- **Servicios estándar**: Transporte regular
- **Servicios especiales**: Equipos pesados, frágiles
- **Servicios de emergencia**: 24/7, respuesta inmediata
- **Servicios VIP**: Clientes preferenciales
- **Servicios de mantenimiento**: Interno de la empresa

### Gestión de Vehículos

#### Catálogo de Vehículos
1. **Registro de vehículos**:
   - **Marca y modelo**: Identificación
   - **Año**: Fecha de fabricación
   - **Placa**: Número de matrícula
   - **Tipo**: Categoría del vehículo
   - **Características**: Dimensiones, peso

2. **Información técnica**:
   - **Motor**: Especificaciones del motor
   - **Transmisión**: Tipo de caja
   - **Combustible**: Tipo y consumo
   - **Capacidad**: Carga útil

#### Mantenimiento de Vehículos
1. **Programación preventiva**:
   - **Por kilometraje**: Cada X kilómetros
   - **Por tiempo**: Cada X meses
   - **Por uso**: Según horas de operación
   - **Por tipo**: Según recomendaciones del fabricante

2. **Mantenimiento correctivo**:
   - **Reporte de fallas**: Descripción del problema
   - **Diagnóstico**: Análisis técnico
   - **Reparación**: Trabajos realizados
   - **Costo**: Gastos asociados

#### Historial de Servicios por Vehículo
- **Servicios realizados**: Lista completa
- **Rendimiento**: Km/litro, horas de uso
- **Costos operativos**: Combustible, mantenimiento
- **Disponibilidad**: Tiempo en servicio vs. mantenimiento

### Gestión de Usuarios Avanzada

#### Roles y Permisos Granulares
1. **Configuración de roles**:
   - **Administrador total**: Acceso completo
   - **Administrador financiero**: Solo módulos financieros
   - **Supervisor operativo**: Operaciones y reportes
   - **Operador**: Funciones básicas de campo
   - **Cliente**: Portal limitado

2. **Permisos específicos**:
   - **Por módulo**: Acceso a secciones específicas
   - **Por acción**: Crear, leer, actualizar, eliminar
   - **Por datos**: Filtros de información visible
   - **Por ubicación**: Restricciones geográficas

#### Gestión de Sesiones
- **Sesiones activas**: Monitoreo de usuarios conectados
- **Tiempo de sesión**: Configuración de expiración automática
- **Sesiones concurrentes**: Límites por usuario
- **Actividad**: Log de acciones por usuario

#### Auditoría de Usuario
- **Log de accesos**: Historial de inicio/cierre de sesión
- **Registro de actividades**: Acciones realizadas
- **Cambios críticos**: Modificaciones importantes
- **Intentos fallidos**: Seguridad y control

### Configuración Regional

#### Configuración de Zona Horaria
1. **Zona horaria del sistema**: Configuración global
2. **Zona horaria por usuario**: Personalización individual
3. **Horario de verano**: Ajuste automático
4. **Formato de hora**: 12 o 24 horas

#### Configuración de Moneda
- **Moneda principal**: Divisa del sistema
- **Símbolo**: Representación de la moneda
- **Posición**: Antes o después del valor
- **Decimales**: Número de posiciones decimales

#### Formatos Regionales
- **Formato de fecha**: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
- **Separador decimal**: Punto o coma
- **Separador de miles**: Punto, coma o espacio
- **Formato de números**: Según región

### Notificaciones del Sistema

#### Tipos de Notificaciones
1. **Email**: Correos electrónicos automáticos
2. **SMS**: Mensajes de texto (si configurado)
3. **Push**: Notificaciones del navegador
4. **En sistema**: Alertas internas

#### Eventos de Notificación
- **Servicios**: Creación, cambios de estado, vencimientos
- **Mantenimientos**: Recordatorios, programación
- **Inventario**: Stock bajo, movimientos importantes
- **Facturación**: Vencimientos, pagos recibidos
- **Sistema**: Actualizaciones, mantenimiento programado

#### Configuración de Alertas
1. **Por usuario**: Preferencias individuales
2. **Por rol**: Configuración por tipo de usuario
3. **Por evento**: Criticidad y frecuencia
4. **Por horario**: Franjas de envío

### Integraciones y APIs

#### APIs Disponibles
- **API REST**: Integración con sistemas externos
- **Webhooks**: Notificaciones automáticas
- **Conectores**: Integraciones predefinidas
- **Importación/Exportación**: Transferencia de datos

#### Configuración de Integraciones
1. **Autenticación**: Tokens y credenciales
2. **Endpoints**: URLs de conexión
3. **Mapping**: Mapeo de campos
4. **Sincronización**: Frecuencia y dirección

#### Monitoreo de Integraciones
- **Estado de conexiones**: Salud de las integraciones
- **Log de transacciones**: Historial de intercambios
- **Errores**: Seguimiento de problemas
- **Rendimiento**: Métricas de velocidad y volumen

---

## 19. Configuraciones

### Configuración de Empresa

#### Información Básica
- **Razón Social**: Nombre legal de la empresa
- **NIT**: Número de identificación tributaria
- **Dirección**: Domicilio principal
- **Teléfono**: Contacto principal
- **Email**: Correo corporativo
- **Sitio Web**: URL de la empresa

#### Configuración Visual
- **Logo**: Imagen corporativa
- **Colores**: Paleta de la empresa
- **Tema**: Claro u oscuro
- **Idioma**: Configuración regional

### Configuración del Sistema

#### Parámetros Generales
- **Zona Horaria**: Configuración temporal
- **Moneda**: Divisa principal
- **Formato de Fecha**: DD/MM/YYYY o MM/DD/YYYY
- **Separador Decimal**: Punto o coma

#### Configuración de Módulos
- **Inventario**: Activar/desactivar módulo
- **Comisiones**: Configurar cálculos
- **Facturación**: Parámetros fiscales
- **Reportes**: Métricas disponibles

### Gestión de Usuarios

#### Crear Usuario
1. **Información básica**:
   - **Nombre completo**
   - **Email** (será el usuario)
   - **Teléfono**
   - **Rol** asignado

2. **Configuración de acceso**:
   - **Contraseña temporal**
   - **Forzar cambio** en primer acceso
   - **Fecha de expiración**
   - **Estado** (activo/inactivo)

3. **Permisos específicos**:
   - **Módulos** accesibles
   - **Acciones** permitidas
   - **Restricciones** especiales

#### Gestionar Usuarios Existentes
- **Editar información**: Actualizar datos
- **Cambiar rol**: Modificar permisos
- **Resetear contraseña**: Nueva clave temporal
- **Desactivar usuario**: Suspender acceso

### Configuración de Notificaciones

#### Tipos de Notificaciones
- **Email**: Correos electrónicos
- **SMS**: Mensajes de texto
- **Push**: Notificaciones del navegador
- **En sistema**: Alertas internas

#### Eventos de Notificación
- **Servicios**: Creación, cambios de estado
- **Mantenimientos**: Recordatorios, vencimientos
- **Inventario**: Stock bajo, movimientos
- **Facturación**: Vencimientos, pagos

---

## 20. Portal del Cliente

### Acceso al Portal

#### Credenciales de Cliente
- **URL específica**: Portal dedicado
- **Usuario**: Email registrado
- **Contraseña**: Asignada por administrador
- **Recuperación**: Proceso automático

### Funcionalidades del Cliente

#### 📊 **Dashboard del Cliente**
- **Servicios activos**: En curso
- **Próximos servicios**: Programados
- **Historial reciente**: Últimos trabajos
- **Estado de cuenta**: Facturas y pagos

#### 🚛 **Mis Servicios**
- **Lista completa**: Todos los servicios
- **Filtros**: Por fecha, estado, tipo
- **Detalles**: Información completa
- **Seguimiento**: Estado en tiempo real

#### 📝 **Solicitar Servicio**
- **Formulario simplificado**: Datos básicos
- **Selección de fecha**: Calendario disponible
- **Tipo de servicio**: Opciones predefinidas
- **Observaciones**: Notas especiales

#### 📄 **Facturas y Pagos**
- **Facturas pendientes**: Por pagar
- **Historial de pagos**: Comprobantes
- **Descargar PDF**: Documentos fiscales
- **Estado de cuenta**: Resumen financiero

### Características del Portal

#### 📱 **Diseño Responsivo**
- **Móvil**: Optimizado para smartphones
- **Tablet**: Adaptado para tablets
- **Desktop**: Experiencia completa

#### 🌙 **Tema Oscuro**
- **Cambio automático**: Según preferencias del sistema
- **Cambio manual**: Botón de alternancia
- **Persistencia**: Recordar preferencia

#### 🔒 **Seguridad**
- **RLS (Row Level Security)**: Datos propios únicamente
- **Sesiones seguras**: Tokens JWT
- **Protección de rutas**: Acceso autorizado
- **Auditoría**: Registro de accesos

---

## 21. Funcionalidades Móviles

### PWA (Progressive Web App)

#### Instalación
1. **Abrir el sistema** en navegador móvil
2. **Buscar opción** "Agregar a pantalla de inicio"
3. **Confirmar instalación**
4. **Acceder desde** icono en pantalla

#### Características PWA
- **Funcionamiento offline**: Datos en caché
- **Notificaciones push**: Alertas en tiempo real
- **Instalación nativa**: Como app móvil
- **Actualizaciones automáticas**: Siempre actualizada

### Funcionalidades Móviles

#### Para Operadores
- **Vista simplificada**: Interfaz optimizada
- **Actualización de estados**: Servicios en curso
- **Captura de fotos**: Evidencias del trabajo
- **Geolocalización**: Ubicación en tiempo real
- **Modo offline**: Trabajo sin conexión

#### Para Supervisores
- **Monitoreo en tiempo real**: Estado de servicios
- **Asignación rápida**: Recursos disponibles
- **Comunicación directa**: Chat con operadores
- **Reportes móviles**: Consultas rápidas

#### Para Clientes
- **Portal móvil**: Acceso completo
- **Seguimiento de servicios**: Estado actual
- **Solicitudes rápidas**: Formulario simplificado
- **Notificaciones**: Actualizaciones automáticas

### Optimizaciones Móviles

#### Rendimiento
- **Carga rápida**: Optimización de recursos
- **Navegación fluida**: Transiciones suaves
- **Uso eficiente de datos**: Compresión de imágenes
- **Batería optimizada**: Consumo reducido

#### Usabilidad
- **Botones grandes**: Fácil interacción táctil
- **Menús accesibles**: Navegación intuitiva
- **Formularios optimizados**: Entrada de datos eficiente
- **Feedback visual**: Confirmaciones claras

---

## 22. Integración Inventario-Grúas

### Objetivo de la Integración

La integración entre inventario y grúas permite:

- **Prevenir duplicados**: Evitar registro doble de repuestos
- **Consumo automático**: Registrar uso de repuestos en servicios
- **Control de stock**: Alertas de inventario bajo
- **Trazabilidad completa**: Seguimiento de repuestos por grúa
- **Optimización de compras**: Basada en consumo real

### Flujo de Integración

#### Registro de Servicios
1. **Al crear servicio**: Sistema verifica repuestos necesarios
2. **Validación de stock**: Confirma disponibilidad
3. **Reserva automática**: Separa repuestos para el servicio
4. **Consumo al completar**: Descuenta automáticamente del inventario

#### Mantenimiento Preventivo
1. **Programación**: Sistema identifica repuestos necesarios
2. **Lista de materiales**: Automática según tipo de mantenimiento
3. **Verificación previa**: Confirma stock antes de programar
4. **Consumo registrado**: Automático al completar mantenimiento

#### Mantenimiento Correctivo
1. **Reporte de falla**: Indica repuestos necesarios
2. **Verificación inmediata**: Stock disponible para reparación
3. **Aprobación condicionada**: Basada en disponibilidad
4. **Consumo en tiempo real**: Al usar los repuestos

### Prevención de Duplicados

#### Reglas de Validación
- **Verificación automática**: Antes de registrar consumos
- **Base de datos central**: Inventario único
- **Validación cruzada**: Entre módulos
- **Alertas de inconsistencia**: Notificaciones automáticas

#### Resolución de Conflictos
1. **Detección**: Sistema identifica posibles duplicados
2. **Alerta**: Notifica al usuario del conflicto
3. **Validación manual**: Usuario confirma o corrige
4. **Resolución**: Ajuste automático o manual

### Configuración de la Integración

#### Mapeo de Repuestos
1. **Por tipo de grúa**: Repuestos específicos
2. **Por marca**: Compatibilidad de piezas
3. **Por antigüedad**: Repuestos según año
4. **Por uso**: Frecuencia de reemplazo

#### Reglas de Consumo
- **Automático**: Repuestos de uso común
- **Manual**: Repuestos especializados
- **Condicional**: Según tipo de trabajo
- **Opcional**: Usuario decide si consumir

---

## 23. Mejores Prácticas y Flujos de Trabajo

### Flujo Diario de Operaciones

#### 🌅 **Inicio del Día**
1. **Revisar dashboard**: Métricas y alertas
2. **Verificar servicios programados**: Agenda del día
3. **Confirmar disponibilidad**: Grúas y operadores
4. **Revisar entradas rápidas**: Gastos pendientes de procesamiento
5. **Validar inventario crítico**: Stock de repuestos esenciales

#### 🚛 **Durante las Operaciones**
1. **Monitorear servicios activos**: Estado en tiempo real
2. **Procesar entradas rápidas**: Validar gastos de campo
3. **Atender alertas**: Problemas o cambios de estado
4. **Actualizar pipeline VIP**: Seguimiento de oportunidades
5. **Revisar cierres pendientes**: Servicios listos para facturar

#### 🌅 **Final del Día**
1. **Cerrar servicios completados**: Crear cierres correspondientes
2. **Validar gastos del día**: Aprobar entradas rápidas
3. **Revisar comisiones calculadas**: Verificar cálculos automáticos
4. **Programar mantenimientos**: Si es necesario
5. **Generar reporte diario**: Resumen de actividades

### Flujo Semanal de Gestión

#### 📊 **Lunes - Planificación**
- **Revisar reportes semanales**: Métricas de la semana anterior
- **Planificar servicios**: Programación de la semana
- **Evaluar pipeline VIP**: Oportunidades y seguimientos
- **Programar mantenimientos**: Trabajos de la semana

#### 💰 **Miércoles - Financiero**
- **Procesar comisiones**: Pago semanal si aplica
- **Revisar facturación diferida**: Cortes programados
- **Analizar costos**: Gastos de la semana
- **Gestionar cartera**: Seguimiento de cobranza

#### 📋 **Viernes - Cierre**
- **Procesar cierres semanales**: Según configuración de clientes
- **Generar facturas**: De cierres listos
- **Actualizar inventario**: Movimientos de la semana
- **Reportes ejecutivos**: Para management

### Flujo Mensual de Administración

#### 📈 **Primera Semana**
- **Cierre del mes anterior**: Procesar todos los cierres pendientes
- **Facturación masiva**: Clientes con ciclo mensual
- **Análisis de rentabilidad**: Por cliente, grúa, operador
- **Revisión de pipeline VIP**: Conversiones y proyecciones

#### 🔧 **Segunda Semana**
- **Evaluación de proveedores**: Desempeño del mes anterior
- **Planificación de compras**: Basada en consumos
- **Mantenimientos programados**: Trabajos del mes
- **Capacitación de personal**: Si es necesario

#### 📊 **Tercera Semana**
- **Reportes gerenciales**: Métricas ejecutivas
- **Análisis de tendencias**: Comparación con meses anteriores
- **Optimización de procesos**: Mejoras identificadas
- **Planificación estratégica**: Próximos meses

#### 🎯 **Cuarta Semana**
- **Presupuestos**: Proyecciones para próximo mes
- **Objetivos**: Metas para el equipo
- **Configuraciones**: Ajustes necesarios
- **Backup completo**: Respaldo integral del sistema

### Mejores Prácticas por Módulo

#### 🚛 **Servicios**
- **Registro inmediato**: Crear servicios tan pronto se confirmen
- **Información completa**: Todos los campos obligatorios
- **Seguimiento activo**: Monitorear estado constantemente
- **Documentación**: Fotos y evidencias en cada etapa

#### 💰 **Finanzas**
- **Registro diario**: Ingresar costos el mismo día
- **Validación cruzada**: Verificar contra documentos físicos
- **Reconciliación semanal**: Comparar con extractos bancarios
- **Reportes frecuentes**: Análisis semanal de rentabilidad

#### 📦 **Inventario**
- **Conteos físicos**: Mensual para productos críticos
- **Movimientos inmediatos**: Registrar cambios en tiempo real
- **Alertas activas**: Configurar puntos de reorden adecuados
- **Trazabilidad**: Documentar origen y destino de movimientos

#### 🎯 **Pipeline VIP**
- **Seguimiento constante**: Actualizar oportunidades semanalmente
- **Comunicación regular**: Contactar prospectos frecuentemente
- **Documentación detallada**: Registrar todas las interacciones
- **Análisis de conversión**: Revisar métricas mensualmente

### Tips de Eficiencia

#### ⚡ **Productividad**
- **Usar búsqueda avanzada**: Incluir cotización y OC en búsquedas
- **Entradas rápidas**: Capacitar operadores en uso del sistema
- **Batch updates**: Usar actualizaciones masivas cuando sea posible
- **Reportes programados**: Automatizar reportes frecuentes

#### 🔄 **Automatización**
- **Cierres automáticos**: Configurar para clientes recurrentes
- **Facturación diferida**: Según patrones de cada cliente
- **Comisiones automáticas**: Configurar reglas claras
- **Alertas inteligentes**: Solo las realmente necesarias

#### 📱 **Movilidad**
- **PWA instalada**: En todos los dispositivos móviles
- **Sincronización frecuente**: Asegurar conectividad
- **Fotos optimizadas**: Comprimir para ahorrar datos
- **Modo offline**: Entrenar para uso sin conexión

---

## 24. Solución de Problemas

### Problemas Comunes

#### 🔐 **Problemas de Acceso**

**Síntoma**: No puedo iniciar sesión
**Soluciones**:
1. **Verificar credenciales**: Email y contraseña correctos
2. **Limpiar caché**: Borrar datos del navegador
3. **Probar navegador diferente**: Chrome, Firefox, Safari
4. **Contactar administrador**: Reseteo de contraseña

**Síntoma**: Sesión se cierra automáticamente
**Soluciones**:
1. **Verificar conexión**: Internet estable
2. **Actualizar navegador**: Versión más reciente
3. **Revisar configuración**: Cookies habilitadas

#### 📊 **Problemas de Datos**

**Síntoma**: Los datos no se cargan
**Soluciones**:
1. **Refrescar página**: F5 o Ctrl+R
2. **Verificar conexión**: Internet funcionando
3. **Revisar filtros**: Configuración de búsqueda
4. **Contactar soporte**: Si persiste el problema

**Síntoma**: Información desactualizada
**Soluciones**:
1. **Actualizar manualmente**: Botón de refresh
2. **Limpiar caché**: Datos temporales
3. **Verificar sincronización**: Estado del sistema

#### 📱 **Problemas Móviles**

**Síntoma**: La app móvil no funciona
**Soluciones**:
1. **Verificar conexión**: WiFi o datos móviles
2. **Actualizar app**: Versión más reciente
3. **Reiniciar dispositivo**: Cerrar y abrir
4. **Reinstalar PWA**: Eliminar y volver a instalar

#### 💰 **Problemas Financieros**

**Síntoma**: Comisiones no se calculan automáticamente
**Soluciones**:
1. **Verificar configuración**: Reglas de comisión por operador
2. **Revisar estado del servicio**: Debe estar completado
3. **Validar datos**: Monto del servicio y operador asignado
4. **Ejecutar cálculo manual**: Si la automática falla

**Síntoma**: Facturación diferida no se genera
**Soluciones**:
1. **Revisar configuración del cliente**: Ciclo y fecha de corte
2. **Verificar servicios completados**: En el período configurado
3. **Validar datos obligatorios**: Información completa de servicios
4. **Ejecutar generación manual**: Forzar el proceso

#### 🎯 **Problemas del Pipeline VIP**

**Síntoma**: Oportunidades no cambian de estado
**Soluciones**:
1. **Verificar permisos**: Usuario autorizado para cambios
2. **Validar datos obligatorios**: Información requerida completa
3. **Revisar workflow**: Flujo configurado correctamente
4. **Actualización manual**: Cambiar estado directamente

#### 📦 **Problemas de Inventario**

**Síntoma**: Stock no se actualiza automáticamente
**Soluciones**:
1. **Verificar integración**: Conexión inventario-servicios activa
2. **Revisar configuración**: Productos configurados para auto-consumo
3. **Validar movimientos**: Registros de entrada y salida
4. **Sincronización manual**: Actualizar stock manualmente

#### 🚛 **Problemas de Servicios**

**Síntoma**: No puedo crear servicios
**Soluciones**:
1. **Verificar permisos**: Rol autorizado para crear servicios
2. **Revisar datos obligatorios**: Campos requeridos completos
3. **Validar recursos**: Grúas y operadores disponibles
4. **Contactar administrador**: Si persisten los problemas

**Síntoma**: Búsqueda por cotización/OC no funciona
**Soluciones**:
1. **Verificar actualización**: Sistema actualizado a v2.2.0
2. **Limpiar caché**: Datos temporales del navegador
3. **Probar términos exactos**: Búsqueda precisa
4. **Revisar datos**: Cotización/OC correctamente ingresados

### Problemas de Rendimiento

#### 🐌 **Sistema Lento**
**Posibles causas y soluciones**:
1. **Conexión a internet**: Verificar velocidad de conexión
2. **Navegador sobrecargado**: Cerrar pestañas innecesarias
3. **Caché lleno**: Limpiar datos temporales
4. **Filtros complejos**: Simplificar criterios de búsqueda

#### 📊 **Reportes que no cargan**
**Soluciones**:
1. **Reducir rango de fechas**: Períodos más pequeños
2. **Simplificar filtros**: Menos criterios de búsqueda
3. **Exportar en lugar de visualizar**: Para grandes volúmenes
4. **Programar reportes**: Para generación automática

### Contacto de Soporte

#### Información para Reportar
- **Descripción del problema**: Detallada y específica
- **Pasos para reproducir**: Secuencia exacta de acciones
- **Navegador y versión**: Chrome 120, Firefox 119, etc.
- **Sistema operativo**: Windows, macOS, Android, iOS
- **Capturas de pantalla**: Si es posible
- **Mensajes de error**: Texto completo del error

#### Canales de Soporte
- **Email**: soporte@tmsgruas.com
- **Teléfono**: +57 (1) 234-5678
- **Chat en línea**: Disponible en horario laboral
- **Tickets**: Sistema interno de soporte
- **WhatsApp**: +57 300 123 4567 (Emergencias)

#### Niveles de Soporte
1. **Nivel 1 - Usuario Final**:
   - Problemas básicos de navegación
   - Dudas sobre funcionalidades
   - Recuperación de contraseñas
   - Capacitación básica

2. **Nivel 2 - Técnico**:
   - Problemas de configuración
   - Integraciones y APIs
   - Reportes personalizados
   - Optimización de rendimiento

3. **Nivel 3 - Desarrollo**:
   - Errores de sistema
   - Nuevas funcionalidades
   - Problemas de base de datos
   - Actualizaciones críticas

### Mantenimiento del Sistema

#### Horarios de Mantenimiento
- **Mantenimiento programado**: Domingos 2:00 AM - 4:00 AM
- **Actualizaciones menores**: Sin interrupción del servicio
- **Actualizaciones mayores**: Notificación previa 48 horas
- **Mantenimiento de emergencia**: Notificación inmediata

#### Durante el Mantenimiento
- **Acceso limitado**: Funcionalidades básicas disponibles
- **Datos seguros**: Respaldos automáticos antes del mantenimiento
- **Notificaciones**: Avisos en el sistema y por email
- **Tiempo estimado**: Información actualizada cada 30 minutos

#### Notificaciones de Mantenimiento
- **Programado**: Email 48 horas antes
- **Inicio**: Notificación en sistema
- **Progreso**: Actualizaciones cada 30 minutos
- **Finalización**: Confirmación de sistemas operativos

---

## Conclusión

Este manual proporciona una guía completa y actualizada para el uso del sistema TMS Grúas v2.2.0, incluyendo todas las funcionalidades, desde las básicas hasta las más avanzadas.

### Características Destacadas v2.2.0

#### 🆕 **Nuevas Funcionalidades Documentadas**
- ✅ **Carga XML de Costos**: Importación masiva de gastos desde archivos XML
- ✅ **Carga XML de Proveedores**: Documentos tributarios electrónicos (DTE)
- ✅ **Entradas/Salidas Simplificadas**: Formularios rápidos de inventario
- ✅ **Módulo de Ingresos**: Control completo de ingresos operacionales
- ✅ **Botón FAB Flotante**: Entradas rápidas accesibles desde cualquier página
- ✅ **Integración Proveedores-Piezas**: Registro automático de repuestos desde pagos
- ✅ **Pipeline VIP**: Seguimiento de clientes estratégicos
- ✅ **Sistema de Cierres**: Control avanzado de facturación
- ✅ **Facturación Diferida**: Ciclos personalizados por cliente
- ✅ **Portal del Operador**: Herramientas especializadas para campo
- ✅ **Búsqueda expandida**: Cotización y orden de compra

#### 📊 **Estadísticas del Sistema**
- ✅ **30+ páginas principales** de la aplicación documentadas
- ✅ **17+ funcionalidades** completamente explicadas
- ✅ **60+ componentes** y procesos detallados
- ✅ **Sistema de auditoría completo** con trazabilidad
- ✅ **Integración en tiempo real** entre todos los módulos
- ✅ **Respuesta móvil optimizada** para todos los dispositivos
- ✅ **Automatizaciones avanzadas** para eficiencia operativa

#### 💪 **Mejoras de Productividad**
- **Carga masiva XML**: Importar cientos de registros en segundos
- **Formularios simplificados**: Menos clics, más velocidad
- **Integraciones automáticas**: Menos duplicados, más precisión
- **Accesos rápidos**: Botón FAB flotante siempre disponible
- **Validaciones inteligentes**: Prevención de errores en tiempo real

### Próximos Pasos
1. **Familiarización**: Explore cada módulo según su rol
2. **Capacitación**: Entrene a su equipo en las nuevas funcionalidades
3. **Configuración**: Ajuste el sistema a sus necesidades específicas
4. **Implementación gradual**: Adopte las nuevas funciones progresivamente
5. **Optimización**: Use las cargas XML y formularios simplificados
6. **Feedback**: Comparta su experiencia para futuras mejoras

### Recursos Adicionales
- **Manual Técnico**: [Guía de Administrador](technical/system-admin-guide.md)
- **Documentación PWA**: [Configuración PWA](technical/pwa-configuration.md)
- **Sistema de Pagos**: [Guía de Pagos](technical/payment-system.md)
- **Troubleshooting**: [Resolución de Problemas](technical/troubleshooting.md)

Para obtener ayuda adicional, acceder a capacitaciones específicas o reportar problemas, no dude en contactar al equipo de soporte técnico usando los canales proporcionados en la sección de Solución de Problemas.

**¡Gracias por usar TMS Grúas v2.3.0!**

---

## 25. Calculadora de Viajes

### Descripción General
Módulo de estimación automática de costos operativos para viajes, integrado en `/trip-calculator`. Combina ruteo geográfico, peajes reales y consumo de combustible por tipo de grúa.

### Integraciones
- **Mapbox**: Cálculo de ruta, distancia y previsualización en mapa interactivo.
- **GetAPI Chile (Peajes)**: Tarifas reales de peajes por categoría de vehículo.
- **GetAPI Chile (Vehículo)**: Validación de patentes (separado por API key independiente).
- **Tabla `crane_consumption_rates`**: Consumo base por tipo de grúa y factor de carga (vacío vs cargado).
- **Tabla `fuel_prices`**: Precio actual de combustible por tipo (diésel/bencina) y región.

### Funcionalidades
- ✅ Búsqueda de origen y destino con autocompletado de Mapbox.
- ✅ Selección de grúa: aplica consumo y categoría de peaje automáticamente.
- ✅ Modo "cargado" vs "vacío" con factor de consumo diferenciado.
- ✅ Cálculo de costo total: combustible + peajes + opcional viáticos.
- ✅ Visualización de ruta en mapa con trazado real.
- ✅ Detalle desglosado por tramo y tipo de costo.

### Casos de Uso
- Cotización rápida previa a un servicio.
- Estimación de costo operativo para presupuestos.
- Planificación de rutas óptimas considerando peajes.

### Limitaciones
- Requiere conexión a internet (no offline).
- Las tarifas dependen de la última actualización de GetAPI.
- Los precios de combustible se actualizan manualmente o vía cron.

---

## 26. Importador XML Unificado

### Descripción General
Wizard de importación de documentos XML (DTE) consolidado para los módulos de **Costos**, **Proveedores** y **Bodega**. Modal de gran formato (1600px) con flujo guiado paso a paso.

### Flujo del Wizard
1. **Carga del archivo XML**: Drag & drop o selección manual.
2. **Parseo y validación**: Limpieza de namespaces (`xmlns`), extracción de RUT emisor, folio, monto, ítems y forma de pago.
3. **Detección de duplicados (3 niveles)**:
   - Por folio + RUT emisor.
   - Por hash del contenido.
   - Por similitud de monto + fecha + proveedor.
4. **Identificación del proveedor**:
   - Búsqueda primaria por nombre normalizado.
   - **Fallback automático por RUT** si la búsqueda por nombre falla.
   - Creación automática del proveedor si no existe (con verificación SRE/Ruts.info).
5. **Asociación opcional a costo existente**: Para evitar duplicación cuando el costo ya fue registrado manualmente.
6. **Lógica financiera SII**:
   - Documentos a **Crédito** (`FmaPago = 2`) → no generan pago automático, quedan como cuenta por pagar.
   - Documentos al **Contado** (`FmaPago = 1`) → generan pago automático en la fecha del documento.
7. **Vínculo atómico**: Crea factura, costo, pago y movimiento de bodega en una sola transacción.

### Características Clave
- ✅ Detección de duplicados configurable (omitir / forzar).
- ✅ Auto-SKU para productos sin código en el XML.
- ✅ Soporte multi-ítem con desglose visual (badge ámbar).
- ✅ Sincronización triangular automática post-importación.
- ✅ Fallback por RUT garantiza tasa de éxito alta incluso con nombres inconsistentes.

### Buenas Prácticas
- Verificar previamente si el costo ya existe antes de importar.
- Mantener actualizada la tabla `inventory_suppliers` con RUT correctos.
- Revisar el log del importador (estado de cada documento).

---

## 27. Accesibilidad y Diseño

### Sistema de Diseño "Violet"
La aplicación utiliza un esquema de **alto contraste centrado en violeta** (`violet-600`) por requerimiento de accesibilidad visual del usuario principal (dificultad para leer el verde).

#### Reglas
- ❌ Prohibido el color verde en cualquier elemento de UI.
- ✅ Usar tokens semánticos definidos en `index.css` y `tailwind.config.ts`.
- ✅ Todos los colores expresados en formato HSL.
- ✅ Estados de éxito → violeta o ámbar (nunca verde).
- ✅ Modales con fondos sólidos (no transparentes) sobre Radix UI.

### Diseño Responsivo
- **Desktop (≥1024px)**: Tablas completas con todas las columnas.
- **Tablet (768-1023px)**: Tablas con scroll horizontal y columnas priorizadas.
- **Móvil (<768px)**: Las tablas se transforman automáticamente en **cards apiladas** con información jerarquizada.
- **FAB flotante**: Acceso rápido a acciones principales en móvil.

### PWA Offline v5
- IndexedDB con CRUD completo en: Servicios, Costos, Clientes, Operadores, Grúas, Inventario.
- Sincronización inteligente al recuperar conexión.
- Resolución manual de conflictos.
- Cache estratificado: App Shell + datos críticos + recursos estáticos.

### Estado Visual de Pago
Estándar para tablas de costos (3 estados):
- 🟢 **Pagado** → indicador violeta (no verde).
- 🟡 **Pendiente** → ámbar.
- 🔴 **Vencido** → rojo (basado en saldo + fecha).

---

## 28. Auditoría y Seguridad

### Sistema de Auditoría `created_by`
Todos los módulos principales registran el usuario que creó cada registro mediante el campo `created_by` (FK a `profiles`). Incluye:
- Servicios, costos, facturas, pagos.
- Inventario (items, movimientos, consumos).
- Grúas, operadores, clientes.
- Mantenciones, documentos.

### Log de Auditoría de Servicios
Tabla `services_history` que registra cada cambio en un servicio:
- Estado anterior y nuevo.
- Usuario responsable.
- Timestamp.
- Campos modificados.

### Row Level Security (RLS)
- **Política por defecto**: Cada usuario solo accede a sus datos según rol.
- **Servicios endurecidos**: Previenen exposición indebida de datos cliente/operador.
- **Notificaciones**: Inserción restringida al propio `user_id`.
- **Storage**: Buckets con políticas granulares por carpeta.

### Restricción de Escritura en Finanzas
Las tablas `creditors`, `debts`, `debt_installments`, `debt_payments` solo permiten INSERT/UPDATE/DELETE a usuarios con rol **admin**. Visualización abierta a roles autorizados.

### Permisos Granulares por Módulo
Los administradores pueden activar/desactivar visibilidad de módulos completos por usuario desde **Administración → Usuarios → Permisos**.

### Anulación con Nota de Crédito
Las facturas generadas por la app no pueden eliminarse: solo anularse mediante una **Nota de Crédito formal** que mantiene el rastro de auditoría. Las facturas históricas (HIST-) sí permiten eliminación directa con prompt "ELIMINAR".

### Eliminación Segura de Costos
Flujo de confirmación múltiple para evitar inconsistencias bidireccionales con facturas, pagos y movimientos de bodega.

### Panel de Emergencia
Centraliza herramientas administrativas de recuperación:
- Limpieza global de inventario.
- Reconstrucción de stock desde movimientos.
- Sincronización forzada cliente ↔ servicios ↔ facturas.
- Backfill de campos críticos.

---

*Documento actualizado: Abril 2026*  
*Versión del manual: 2.3.0*  
*Versión del sistema: 2.3.0*  
*Última actualización: Manual completamente revisado con todas las funcionalidades acumuladas hasta v2.3.0*  
*Páginas: 1,500+ | Módulos documentados: 35+ | Funcionalidades nuevas v2.3.0: 30+*
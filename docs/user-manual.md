# Manual de Usuario - TMS Grúas v2.2.0

## Tabla de Contenidos

1. [Introducción al Sistema](#introducción-al-sistema)
2. [Acceso y Roles de Usuario](#acceso-y-roles-de-usuario)
3. [Dashboard Principal](#dashboard-principal)
4. [Gestión de Servicios](#gestión-de-servicios)
5. [Gestión de Grúas](#gestión-de-grúas)
6. [Gestión de Operadores](#gestión-de-operadores)
7. [Calendario de Eventos](#calendario-de-eventos)
8. [Sistema de Inventario](#sistema-de-inventario)
9. [Gestión de Proveedores](#gestión-de-proveedores)
10. [Sistema de Backup y Restauración](#sistema-de-backup-y-restauración)
11. [Entradas Rápidas](#entradas-rápidas)
12. [Módulo Financiero](#módulo-financiero)
13. [Sistema de Reportes](#sistema-de-reportes)
14. [Configuraciones](#configuraciones)
15. [Portal del Cliente](#portal-del-cliente)
16. [Funcionalidades Móviles](#funcionalidades-móviles)
17. [Integración Inventario-Grúas](#integración-inventario-grúas)
18. [Mejores Prácticas y Flujos de Trabajo](#mejores-prácticas-y-flujos-de-trabajo)
19. [Solución de Problemas](#solución-de-problemas)

---

## 1. Introducción al Sistema

### ¿Qué es TMS Grúas?

TMS Grúas v2.2.0 es un sistema integral de gestión de transporte y servicios de grúas que permite:

- **Gestión completa de servicios**: Desde la creación hasta la facturación con flujos optimizados
- **Control de inventario avanzado**: Seguimiento de repuestos con integración automática a grúas
- **Administración de recursos**: Grúas, operadores y equipos con métricas avanzadas
- **Gestión de proveedores**: Sistema completo de proveedores y programación de pagos
- **Sistema de backup**: Respaldos automáticos y restauración completa
- **Entradas rápidas**: Registro móvil de gastos y eventos con GPS
- **Reportes financieros**: Costos, comisiones e ingresos con análisis avanzado
- **Portal del cliente**: Acceso directo para clientes con funcionalidades ampliadas
- **Aplicación móvil PWA**: Funcionalidades offline mejoradas para uso en campo

### Características Principales v2.2.0

- ✅ **Diseño Responsivo**: Funciona perfectamente en desktop, tablet y móvil
- ✅ **Gestión de Inventario**: Control completo con integración automática
- ✅ **TMS Completo**: Todas las funcionalidades de un TMS profesional
- ✅ **Seguridad Empresarial**: Autenticación robusta con auditoría completa
- ✅ **Reportes Avanzados**: Dashboard con métricas en tiempo real y alertas
- ✅ **Portal del Cliente**: Interfaz dedicada con acceso a servicios y facturas
- ✅ **Sistema de Backup**: Respaldos automáticos programables
- ✅ **Gestión de Proveedores**: Módulo completo para proveedores y pagos
- ✅ **Entradas Rápidas**: Registro móvil con GPS y fotografías
- ✅ **Integración Automática**: Inventario-Grúas sincronizado para evitar duplicados
- ✅ **PWA Avanzada**: Funcionalidad offline con sincronización inteligente
- ✅ **Auditoría Completa**: Trazabilidad de todas las operaciones del sistema

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

#### 👨‍💼 **Supervisor**
- Gestión de servicios y operaciones
- Acceso a reportes operacionales
- Supervisión de operadores
- Gestión de inventario

#### 🚛 **Operador**
- Vista simplificada para operaciones de campo
- Actualización de estados de servicio
- Registro de eventos y novedades
- Acceso móvil optimizado

#### 👤 **Cliente**
- Acceso al portal del cliente
- Visualización de servicios contratados
- Solicitud de nuevos servicios
- Consulta de facturas y pagos

---

## 3. Dashboard Principal

### Vista General

El dashboard proporciona una vista consolidada de:

#### 📊 **Métricas Principales**
- **Servicios Activos**: Número de servicios en curso
- **Grúas Disponibles**: Estado actual de la flota
- **Ingresos del Mes**: Facturación mensual
- **Operadores Activos**: Personal en servicio

#### 📈 **Gráficos y Tendencias**
- **Servicios por Estado**: Distribución de servicios
- **Ingresos Mensuales**: Tendencia de facturación
- **Utilización de Grúas**: Eficiencia de la flota
- **Costos vs Ingresos**: Análisis de rentabilidad

#### 🔔 **Notificaciones y Alertas**
- Servicios próximos a vencer
- Mantenimientos programados
- Inventario bajo stock
- Facturas pendientes

### Navegación

#### Menú Principal
- **Dashboard**: Vista general del sistema
- **Servicios**: Gestión de servicios de transporte
- **Grúas**: Administración de la flota
- **Operadores**: Gestión de personal
- **Calendario**: Programación de eventos
- **Inventario**: Control de stock
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

#### Paso 3: Asignación de Recursos
4. **Seleccionar recursos**:
   - **Grúa**: Equipo asignado
   - **Operador**: Personal responsable
   - **Vehículo de Apoyo**: Si es necesario

#### Paso 4: Costos y Tarifas
5. **Definir precios**:
   - **Tarifa Base**: Costo del servicio
   - **Costos Adicionales**: Extras y recargos
   - **Descuentos**: Si aplican

### Estados de Servicio

#### 🟡 **Pendiente**
- Servicio creado, esperando confirmación
- **Acciones disponibles**: Editar, confirmar, cancelar

#### 🔵 **Confirmado**
- Servicio aprobado y programado
- **Acciones disponibles**: Iniciar, reprogramar, cancelar

#### 🟢 **En Proceso**
- Servicio en ejecución
- **Acciones disponibles**: Actualizar estado, agregar notas

#### ✅ **Completado**
- Servicio finalizado exitosamente
- **Acciones disponibles**: Facturar, generar reporte

#### 🔴 **Cancelado**
- Servicio cancelado por cualquier motivo
- **Acciones disponibles**: Ver historial, reactivar

### Gestión de Servicios Existentes

#### Búsqueda y Filtros
- **Por Folio**: Búsqueda directa por número
- **Por Cliente**: Filtrar por empresa
- **Por Estado**: Filtrar por estado actual
- **Por Fecha**: Rango de fechas
- **Por Operador**: Servicios asignados

#### Acciones Masivas
- **Exportar**: Generar reportes en Excel/PDF
- **Actualizar Estados**: Cambios masivos
- **Asignar Recursos**: Reasignación múltiple

---

## 5. Gestión de Grúas

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

---

## 6. Gestión de Operadores

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

## 7. Calendario de Eventos

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

## 8. Sistema de Inventario

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

1. **Registrar Movimiento**:
   - **Seleccionar tipo** de movimiento
   - **Elegir producto** del catálogo
   - **Indicar cantidad** y motivo
   - **Asignar responsable**

2. **Validar Información**:
   - **Verificar disponibilidad** (para salidas)
   - **Confirmar precios** y costos
   - **Revisar documentos** de soporte

3. **Procesar Movimiento**:
   - **Actualizar stock** automáticamente
   - **Generar comprobante** del movimiento
   - **Notificar** a responsables

### Reportes de Inventario

#### 📊 **Reporte de Stock**
- **Stock actual** por producto
- **Valorización** del inventario
- **Productos bajo mínimo**
- **Productos sin movimiento**

#### 📈 **Reporte de Movimientos**
- **Entradas y salidas** por período
- **Consumo por servicio**
- **Rotación de productos**
- **Análisis ABC**

#### 💰 **Reporte Financiero**
- **Costo de inventario**
- **Margen por producto**
- **Impacto en costos de servicio**
- **Rentabilidad por categoría**

---

## 9. Módulo Financiero

### Gestión de Costos

#### Tipos de Costos

##### 🚛 **Costos Operacionales**
- **Combustible**: Consumo por servicio
- **Mantenimiento**: Reparaciones y revisiones
- **Peajes**: Costos de tránsito
- **Parqueaderos**: Estacionamientos

##### 👨‍💼 **Costos de Personal**
- **Salarios**: Remuneración base
- **Comisiones**: Pagos por servicio
- **Prestaciones**: Beneficios sociales
- **Capacitación**: Formación del personal

##### 🏢 **Costos Administrativos**
- **Seguros**: Pólizas de la flota
- **Licencias**: Permisos y certificaciones
- **Servicios**: Comunicaciones, software
- **Otros**: Gastos diversos

#### Registro de Costos

1. **Crear Costo**:
   - **Seleccionar categoría** del costo
   - **Asignar a servicio** o grúa
   - **Indicar monto** y fecha
   - **Adjuntar soporte** (factura, recibo)

2. **Validar Costo**:
   - **Revisar información** ingresada
   - **Verificar documentos** de soporte
   - **Aprobar** o rechazar

3. **Procesar Costo**:
   - **Afectar contabilidad**
   - **Actualizar reportes**
   - **Notificar** a responsables

### Sistema de Comisiones

#### Configuración de Comisiones

##### Por Operador
- **Porcentaje fijo**: % sobre valor del servicio
- **Monto fijo**: Valor constante por servicio
- **Escala variable**: Según tipo de servicio
- **Bonificaciones**: Incentivos adicionales

##### Por Tipo de Servicio
- **Servicios estándar**: Comisión base
- **Servicios especiales**: Comisión premium
- **Servicios nocturnos**: Recargo adicional
- **Servicios de emergencia**: Bonificación extra

#### Cálculo de Comisiones

1. **Automático**:
   - **Al completar servicio**: Cálculo inmediato
   - **Según configuración**: Reglas predefinidas
   - **Validación**: Revisión automática

2. **Manual**:
   - **Casos especiales**: Situaciones particulares
   - **Ajustes**: Correcciones necesarias
   - **Aprobación**: Validación manual

#### Pago de Comisiones

1. **Generar Lote**:
   - **Seleccionar período**: Rango de fechas
   - **Filtrar operadores**: Específicos o todos
   - **Revisar cálculos**: Validar montos

2. **Procesar Pago**:
   - **Generar comprobantes**: Documentos de pago
   - **Actualizar estados**: Marcar como pagado
   - **Registrar en contabilidad**: Asientos contables

### Facturación

#### Creación de Facturas

1. **Desde Servicios**:
   - **Seleccionar servicios** completados
   - **Agrupar por cliente** si es necesario
   - **Generar factura** automáticamente

2. **Manual**:
   - **Crear factura** desde cero
   - **Agregar conceptos** manualmente
   - **Calcular impuestos** y totales

#### Estados de Factura

##### 🟡 **Borrador**
- Factura en creación
- **Acciones**: Editar, eliminar

##### 🔵 **Enviada**
- Factura entregada al cliente
- **Acciones**: Ver, anular

##### 🟢 **Pagada**
- Factura cancelada por el cliente
- **Acciones**: Ver, generar recibo

##### 🔴 **Vencida**
- Factura no pagada en término
- **Acciones**: Gestión de cartera

#### Conciliación de Pagos

1. **Registrar Pago**:
   - **Seleccionar factura**
   - **Indicar monto** recibido
   - **Método de pago**: Efectivo, transferencia, etc.
   - **Fecha de pago**

2. **Conciliar**:
   - **Verificar montos**
   - **Aplicar descuentos** si existen
   - **Generar recibo** de pago
   - **Actualizar cartera**

---

## 10. Sistema de Reportes

### Dashboard de Reportes

#### Pestañas Principales

##### 📊 **Dashboard**
- **Métricas generales**: KPIs principales
- **Gráficos de tendencias**: Evolución temporal
- **Alertas**: Indicadores críticos
- **Resumen ejecutivo**: Vista consolidada

##### 🚛 **Operacional**
- **Servicios por estado**: Distribución actual
- **Utilización de grúas**: Eficiencia de flota
- **Productividad de operadores**: Rendimiento
- **Tiempos de servicio**: Análisis de duración

##### 💰 **Costos**
- **Costos por categoría**: Distribución de gastos
- **Costos por grúa**: Análisis individual
- **Costos por servicio**: Rentabilidad
- **Tendencias de costos**: Evolución temporal

##### 🔧 **Mantenimiento**
- **Programación**: Mantenimientos pendientes
- **Historial**: Trabajos realizados
- **Costos de mantenimiento**: Gastos por equipo
- **Disponibilidad**: Tiempo operativo vs. mantenimiento

### Filtros y Personalización

#### Filtros Disponibles
- **Rango de fechas**: Período específico
- **Cliente**: Servicios por empresa
- **Grúa**: Análisis por equipo
- **Operador**: Rendimiento individual
- **Tipo de servicio**: Categorización
- **Estado**: Filtro por estado actual

#### Opciones de Vista
- **Gráficos**: Visualización gráfica
- **Tablas**: Datos tabulares
- **Resumen**: Vista consolidada
- **Detalle**: Información completa

### Exportación de Reportes

#### Formatos Disponibles
- **Excel**: Hojas de cálculo editables
- **PDF**: Documentos para impresión
- **CSV**: Datos para análisis
- **Imagen**: Gráficos para presentaciones

#### Opciones de Exportación
1. **Seleccionar reporte** deseado
2. **Aplicar filtros** necesarios
3. **Elegir formato** de exportación
4. **Descargar archivo** generado

---

## 11. Configuraciones

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

## 12. Portal del Cliente

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

## 13. Funcionalidades Móviles

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

## 14. Solución de Problemas

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

### Contacto de Soporte

#### Información para Reportar
- **Descripción del problema**: Detallada
- **Pasos para reproducir**: Secuencia exacta
- **Navegador y versión**: Chrome 120, Firefox 119, etc.
- **Sistema operativo**: Windows, macOS, Android, iOS
- **Capturas de pantalla**: Si es posible

#### Canales de Soporte
- **Email**: soporte@tmsgruas.com
- **Teléfono**: +57 (1) 234-5678
- **Chat en línea**: Disponible en horario laboral
- **Tickets**: Sistema interno de soporte

### Mantenimiento del Sistema

#### Horarios de Mantenimiento
- **Mantenimiento programado**: Domingos 2:00 AM - 4:00 AM
- **Actualizaciones menores**: Sin interrupción del servicio
- **Actualizaciones mayores**: Notificación previa

#### Durante el Mantenimiento
- **Acceso limitado**: Funcionalidades básicas
- **Datos seguros**: Respaldos automáticos
- **Notificaciones**: Avisos en el sistema
- **Tiempo estimado**: Información actualizada

---

## Conclusión

Este manual proporciona una guía completa para el uso del sistema TMS Grúas v2.1.0. Para obtener ayuda adicional o reportar problemas, no dude en contactar al equipo de soporte técnico.

**¡Gracias por usar TMS Grúas!**

---

*Documento actualizado: Enero 2025*  
*Versión del manual: 1.0*  
*Versión del sistema: 2.1.0*
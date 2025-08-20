# Manual de Usuario - TMS Grúas v2.1.0
## Sistema Integral de Gestión de Transporte y Servicios

### 📋 Introducción al Sistema

TMS Grúas es un sistema integral diseñado para la gestión completa de servicios de transporte y grúas, que permite a las empresas administrar de manera eficiente todos los aspectos de su operación.

#### Características Principales:
- **Gestión de Servicios TMS**: Control completo del ciclo de vida de servicios
- **Control de Inventario**: Gestión de stock, alertas y movimientos
- **Administración de Recursos**: Grúas, operadores y equipamiento
- **Reportes Financieros**: Análisis detallado de costos y rentabilidad
- **Portal del Cliente**: Acceso directo para clientes con funcionalidades específicas
- **Diseño Responsivo**: Optimizado para desktop, tablet y móvil
- **Funcionalidades TMS Completas**: Desde solicitud hasta facturación
- **Seguridad Robusta**: Control de acceso basado en roles

### 🔐 Acceso al Sistema

#### Inicio de Sesión
1. Acceder a la URL del sistema proporcionada
2. Ingresar email y contraseña
3. El sistema redirigirá según el rol del usuario

#### Recuperación de Contraseña
1. Hacer clic en "¿Olvidaste tu contraseña?"
2. Ingresar email registrado
3. Seguir instrucciones del correo recibido

#### Roles de Usuario

**Administrador**
- Acceso completo a todas las funcionalidades
- Gestión de usuarios y permisos
- Configuración del sistema
- Reportes ejecutivos

**Supervisor**
- Gestión de servicios y operaciones
- Reportes operacionales
- Administración de recursos
- Control de inventario

**Operador**
- Registro de servicios asignados
- Actualización de estados
- Acceso a información operacional
- Funcionalidades móviles

**Cliente**
- Portal dedicado
- Solicitud de servicios
- Seguimiento de órdenes
- Historial de facturación

### 🏠 Dashboard Principal

#### Vista General
El dashboard proporciona una vista panorámica de las métricas clave:
- **Servicios Activos**: Cantidad de servicios en proceso
- **Ingresos del Mes**: Total facturado en el período actual
- **Grúas Disponibles**: Estado de la flota
- **Alertas**: Notificaciones importantes

#### Gráficos y Métricas
- **Gráfico de Servicios**: Evolución mensual
- **Estado de Grúas**: Distribución por estado
- **Top Clientes**: Clientes más activos
- **Indicadores Financieros**: KPIs principales

#### Navegación Principal
El menú lateral permite acceso a todos los módulos:
- **Dashboard**: Vista principal
- **Servicios**: Gestión de servicios TMS
- **Grúas**: Administración de flota
- **Operadores**: Gestión de personal
- **Calendario**: Programación de eventos
- **Inventario**: Control de stock
- **Finanzas**: Módulo financiero
- **Reportes**: Análisis y estadísticas
- **Configuración**: Parámetros del sistema

### 🚛 Gestión de Servicios

#### Crear Nuevo Servicio
1. **Información Básica**:
   - Folio (generado automáticamente)
   - Cliente
   - Fecha de solicitud
   - Fecha de servicio
   - Descripción del trabajo

2. **Asignación de Recursos**:
   - Seleccionar grúa disponible
   - Asignar operador
   - Definir ubicación de origen y destino
   - Especificar tipo de servicio

3. **Definición de Costos**:
   - Tarifa base
   - Costos adicionales
   - Impuestos aplicables
   - Total del servicio

#### Estados de Servicio

**Pendiente** (Amarillo)
- Servicio creado pero no confirmado
- Acciones: Confirmar, Editar, Cancelar

**Confirmado** (Azul)
- Servicio confirmado y programado
- Acciones: Iniciar, Reagendar, Cancelar

**En Proceso** (Verde)
- Servicio en ejecución
- Acciones: Completar, Pausar, Reportar incidencia

**Completado** (Verde Oscuro)
- Servicio finalizado exitosamente
- Acciones: Generar factura, Ver detalles

**Cancelado** (Rojo)
- Servicio cancelado
- Acciones: Ver razón, Reactivar (si aplica)

#### Búsqueda y Filtros
- **Filtro por Cliente**: Buscar servicios específicos
- **Filtro por Estado**: Ver servicios por estado
- **Filtro por Fecha**: Rango de fechas
- **Filtro por Operador**: Servicios por operador
- **Búsqueda por Folio**: Búsqueda directa

#### Acciones Masivas
- **Exportar a Excel**: Descargar lista filtrada
- **Generar Reportes**: Crear análisis personalizado
- **Actualización Masiva**: Cambiar estados múltiples

### 🏗️ Gestión de Grúas

#### Registro de Nueva Grúa
1. **Información Básica**:
   - Patente única
   - Marca y modelo
   - Año de fabricación
   - Número de serie

2. **Especificaciones Técnicas**:
   - Capacidad de carga
   - Altura máxima
   - Radio de trabajo
   - Tipo de combustible

3. **Documentación**:
   - Certificaciones vigentes
   - Seguros
   - Revisiones técnicas
   - Permisos de circulación

#### Mantenimiento de Grúas
1. **Mantenimiento Preventivo**:
   - Programar según horas de uso
   - Calendario automático
   - Alertas de vencimiento
   - Historial de mantenciones

2. **Mantenimiento Correctivo**:
   - Registro de fallas
   - Reparaciones realizadas
   - Costos asociados
   - Tiempo fuera de servicio

#### Estados de Grúa

**Disponible**: Lista para asignar a servicios
**En Servicio**: Actualmente en operación
**Mantenimiento**: En proceso de mantención
**Fuera de Servicio**: No disponible por falla o reparación

### 👷 Gestión de Operadores

#### Registro de Operador
1. **Información Personal**:
   - Nombre completo
   - RUT
   - Fecha de nacimiento
   - Datos de contacto

2. **Información Profesional**:
   - Licencia de conducir
   - Certificaciones
   - Experiencia
   - Especialidades

3. **Licencias y Certificaciones**:
   - Tipo de licencia
   - Fecha de vencimiento
   - Certificaciones adicionales
   - Cursos de capacitación

#### Asignación de Servicios
- **Criterios de Asignación**:
  - Disponibilidad del operador
  - Proximidad geográfica
  - Especialización requerida
  - Carga de trabajo actual

#### Control de Horarios
- **Horario Regular**: Definir horario estándar
- **Horas Extra**: Registro de tiempo adicional
- **Días Libres**: Programación de descansos
- **Turnos Especiales**: Asignaciones fuera de horario

#### Cálculo de Comisiones
- **Por Servicio**: Porcentaje fijo por servicio
- **Por Monto**: Porcentaje sobre valor del servicio
- **Bonificaciones**: Incentivos adicionales
- **Descuentos**: Penalizaciones si aplican

### 📅 Calendario de Eventos

#### Vistas del Calendario
- **Vista Mensual**: Panorama general del mes
- **Vista Semanal**: Detalle por semana
- **Vista Diaria**: Agenda del día

#### Tipos de Eventos
- **Servicios** (Verde): Servicios programados
- **Mantenimiento** (Naranja): Mantenciones de grúas
- **Inspecciones** (Azul): Revisiones programadas
- **Eventos Especiales** (Morado): Reuniones, capacitaciones

#### Gestión de Eventos
1. **Crear Evento**:
   - Título descriptivo
   - Fecha y hora
   - Duración
   - Recursos involucrados
   - Descripción detallada

2. **Editar Evento**:
   - Modificar fecha/hora
   - Cambiar recursos asignados
   - Actualizar descripción
   - Notificar cambios

3. **Eliminar Evento**:
   - Confirmar eliminación
   - Notificar a involucrados
   - Liberar recursos

### 📦 Sistema de Inventario

#### Catálogo de Productos
1. **Categorías**:
   - Repuestos de grúas
   - Herramientas
   - Equipos de seguridad
   - Consumibles
   - Otros materiales

2. **Información del Producto**:
   - **Básica**: Código, nombre, descripción
   - **Comercial**: Precio, proveedor, marca
   - **Control de Stock**: Mínimo, máximo, punto de reorden

#### Movimientos de Inventario
1. **Entradas de Stock**:
   - Compras a proveedores
   - Devoluciones de clientes
   - Ajustes positivos
   - Transferencias entre ubicaciones

2. **Salidas de Stock**:
   - Ventas a clientes
   - Uso en servicios
   - Ajustes negativos
   - Pérdidas o mermas

#### Proceso de Movimientos
1. **Registrar Movimiento**:
   - Seleccionar producto
   - Especificar cantidad
   - Definir ubicación
   - Agregar observaciones

2. **Validar Movimiento**:
   - Verificar disponibilidad
   - Confirmar ubicación
   - Autorizar transacción
   - Actualizar stock

#### Reportes de Inventario
- **Reporte de Stock**: Stock actual por producto
- **Movimientos**: Histórico de entradas y salidas
- **Valorización**: Valor del inventario
- **Productos Críticos**: Alertas de stock mínimo

### 💰 Módulo Financiero

#### Gestión de Costos
1. **Categorías de Costos**:
   - **Operacionales**: Combustible, mantención, peajes
   - **Personal**: Sueldos, comisiones, bonificaciones
   - **Administrativos**: Oficina, seguros, licencias

2. **Registro de Costos**:
   - Fecha del gasto
   - Categoría
   - Monto
   - Descripción
   - Centro de costo
   - Documentos respaldo

#### Sistema de Comisiones
1. **Configuración**:
   - **Por Operador**: Porcentaje individual
   - **Por Tipo de Servicio**: Porcentaje por categoría
   - **Escala de Comisiones**: Rangos de porcentajes

2. **Cálculo de Comisiones**:
   - Base de cálculo (servicio/monto)
   - Aplicar porcentaje configurado
   - Considerar bonificaciones
   - Aplicar descuentos si corresponde

3. **Pago de Comisiones**:
   - Generar liquidación
   - Aprobar pago
   - Registrar transferencia
   - Notificar operador

#### Facturación
1. **Creación de Facturas**:
   - Seleccionar servicios completados
   - Verificar datos del cliente
   - Aplicar impuestos
   - Generar documento

2. **Estados de Factura**:
   - **Borrador**: En construcción
   - **Enviada**: Emitida al cliente
   - **Pagada**: Cobrada completamente
   - **Vencida**: Plazo de pago superado

3. **Conciliación de Pagos**:
   - Registrar pagos recibidos
   - Asociar a facturas
   - Calcular saldos pendientes
   - Generar estados de cuenta

### 📊 Sistema de Reportes

#### Dashboard de Reportes
El sistema ofrece múltiples pestañas de análisis:

1. **Dashboard**: Métricas generales y KPIs
2. **Operacional**: Análisis de servicios y recursos
3. **Costos**: Análisis financiero detallado
4. **Mantenimiento**: Estado y costos de mantención

#### Filtros Disponibles
- **Rango de Fechas**: Período específico de análisis
- **Cliente**: Filtrar por cliente específico
- **Operador**: Análisis por operador
- **Grúa**: Rendimiento por equipo
- **Ubicación**: Análisis geográfico

#### Opciones de Exportación
- **Excel**: Para análisis adicional
- **PDF**: Para presentaciones
- **CSV**: Para integración con otros sistemas
- **Imagen**: Para documentos y presentaciones

### ⚙️ Configuraciones

#### Configuración de Empresa
1. **Información Básica**:
   - Nombre de la empresa
   - RUT
   - Dirección
   - Teléfonos y email

2. **Configuración Visual**:
   - Logo de la empresa
   - Colores corporativos
   - Plantillas de documentos

#### Configuración del Sistema
1. **Parámetros Generales**:
   - Zona horaria
   - Moneda
   - Formato de fecha
   - Idioma

2. **Configuración por Módulo**:
   - Tipos de servicio
   - Categorías de costos
   - Niveles de stock
   - Porcentajes de comisión

#### Gestión de Usuarios
1. **Crear Usuario**:
   - Información personal
   - Credenciales de acceso
   - Asignar rol
   - Permisos específicos

2. **Gestión de Permisos**:
   - Definir accesos por módulo
   - Configurar nivel de autorización
   - Restricciones específicas

#### Configuración de Notificaciones
- **Tipos de Notificación**: Email, SMS, push
- **Eventos**: Qué acciones disparan notificaciones
- **Destinatarios**: Quién recibe cada tipo de notificación
- **Plantillas**: Personalizar mensajes

### 👥 Portal del Cliente

#### Acceso al Portal
Los clientes reciben credenciales específicas para acceder a su portal dedicado.

#### Funcionalidades del Cliente
1. **Dashboard Personal**:
   - Servicios activos
   - Próximas citas
   - Estado de facturas
   - Historial reciente

2. **Seguimiento de Servicios**:
   - Estado en tiempo real
   - Ubicación de la grúa
   - Estimación de llegada
   - Contacto directo con operador

3. **Solicitud de Servicios**:
   - Formulario simplificado
   - Programación de fecha/hora
   - Especificaciones del trabajo
   - Confirmación automática

4. **Gestión de Facturas**:
   - Ver facturas pendientes
   - Descargar documentos
   - Historial de pagos
   - Estado de cuenta

#### Características del Portal
- **Diseño Responsivo**: Optimizado para móvil
- **Tema Oscuro**: Opción de visualización
- **Notificaciones**: Alertas automáticas
- **Seguridad**: Acceso protegido por rol

### 📱 Funcionalidades Móviles

#### PWA (Progressive Web App)
El sistema funciona como aplicación móvil nativa:
- **Instalación**: Se puede instalar en el dispositivo
- **Offline**: Funcionalidades básicas sin internet
- **Push Notifications**: Notificaciones automáticas
- **Cámara**: Captura de fotos para documentación

#### Funcionalidades por Rol

**Operadores Móviles**:
- Actualizar estado de servicios
- Subir fotos del trabajo
- Registrar incidencias
- Recibir nuevas asignaciones
- Navegación GPS integrada

**Supervisores Móviles**:
- Monitoreo en tiempo real
- Aprobación de servicios
- Comunicación con operadores
- Reportes rápidos

**Clientes Móviles**:
- Solicitar servicios de emergencia
- Seguimiento en vivo
- Comunicación directa
- Confirmación de trabajos

#### Optimizaciones Móviles
- **Interfaz Táctil**: Botones y controles adaptados
- **Carga Rápida**: Optimización de recursos
- **Batería**: Uso eficiente de energía
- **Conectividad**: Funcionamiento con conexión limitada

### 🆘 Solución de Problemas

#### Problemas de Acceso
1. **No puedo iniciar sesión**:
   - Verificar email y contraseña
   - Usar recuperación de contraseña
   - Contactar al administrador

2. **La página no carga**:
   - Verificar conexión a internet
   - Limpiar cache del navegador
   - Probar en navegador diferente

#### Problemas de Datos
1. **Los datos no aparecen**:
   - Verificar filtros aplicados
   - Revisar permisos de usuario
   - Contactar soporte técnico

2. **Error al guardar información**:
   - Verificar campos obligatorios
   - Revisar formato de datos
   - Intentar nuevamente

#### Problemas con la App Móvil
1. **La app no se instala**:
   - Verificar compatibilidad del navegador
   - Seguir pasos de instalación
   - Probar desde navegador diferente

2. **Funcionalidades offline no funcionan**:
   - Verificar que la app esté instalada
   - Asegurar sincronización previa
   - Reiniciar la aplicación

### 📞 Contacto y Soporte

#### Canales de Soporte
- **Email**: soporte@tmsgruas.cl
- **Teléfono**: +56 9 XXXX XXXX
- **Portal Web**: www.tmsgruas.cl
- **Chat en línea**: Disponible en horario de oficina

#### Horarios de Atención
- **Soporte General**: Lunes a Viernes 8:00-18:00
- **Emergencias**: 24/7 para clientes premium
- **Mantenimiento**: Domingos 2:00-6:00 AM

#### Procedimientos de Soporte
1. **Incidencia Menor**: Email con descripción
2. **Incidencia Mayor**: Llamada telefónica directa
3. **Emergencia**: Línea dedicada 24/7

---
**Manual actualizado - TMS Grúas v2.1.0**
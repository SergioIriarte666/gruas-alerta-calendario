
# Manual de Usuario - TMS Grúas

## Introducción

TMS Grúas es un sistema integral de gestión para empresas de servicios de grúas que permite administrar servicios, clientes, operadores, equipos y facturación de manera eficiente con funcionalidades avanzadas como inspecciones digitales, generación automática de PDFs y portal de clientes.

## Roles de Usuario

### Administrador
- Acceso completo al sistema
- Gestión de usuarios y configuración
- Acceso a todos los módulos
- Gestión de invitaciones de usuarios
- Configuración de empresa y sistema

### Operador
- Acceso al portal del operador
- Gestión de inspecciones con set fotográfico unificado
- Visualización de servicios asignados
- Generación de PDFs de inspección
- Firmas digitales

### Cliente
- Acceso al portal de clientes
- Visualización de servicios contratados
- Solicitud de nuevos servicios
- Descarga de facturas e inspecciones

### Visualizador
- Solo lectura en módulos permitidos
- Acceso a reportes básicos
- Dashboard de métricas

## Módulos del Sistema

### 1. Dashboard
**Ubicación**: Página principal
**Función**: Vista general del estado del negocio

#### Métricas Principales
- Total de servicios del mes
- Ingresos mensuales
- Servicios pendientes
- Facturas vencidas
- Alertas de vencimientos de documentos

#### Funcionalidades
- Gráficos interactivos de performance
- Lista de servicios recientes
- Panel de alertas críticas
- Métricas en tiempo real

### 2. Servicios
**Ubicación**: Menú principal > Servicios
**Función**: Gestión completa de servicios de grúa

#### Crear Nuevo Servicio
1. Click en "Nuevo Servicio"
2. Completar información del cliente
3. Seleccionar tipo de servicio
4. Asignar grúa y operador
5. Definir origen y destino
6. Establecer valor del servicio
7. Configurar información del vehículo
8. Guardar

#### Estados de Servicio
- **Pendiente**: Servicio creado, esperando ejecución
- **En Progreso**: Servicio siendo ejecutado
- **Completado**: Servicio finalizado exitosamente
- **Cancelado**: Servicio cancelado
- **Facturado**: Servicio incluido en factura

#### Filtros Avanzados
- Por estado de servicio
- Por rango de fechas
- Por cliente específico
- Por operador asignado
- Por tipo de servicio
- Por grúa utilizada

### 3. Portal del Operador
**Ubicación**: Acceso directo para operadores (/operator)
**Función**: Herramientas específicas para operadores en terreno

#### Funcionalidades del Operador
- Ver servicios asignados en tiempo real
- Realizar inspecciones completas
- **Set Fotográfico Unificado** con 6 categorías:
  - Vista Izquierda
  - Vista Derecha
  - Vista Frontal
  - Vista Trasera
  - Vista Interior
  - Vista Motor
- Checklist de equipamiento
- Firmas digitales (operador y cliente)
- Generación automática de PDFs
- Envío por email automático

#### Proceso de Inspección Rediseñado
1. Seleccionar servicio asignado
2. Completar checklist de equipos
3. **Tomar fotos por categorías** (mínimo 1 foto requerida)
4. Agregar observaciones del vehículo
5. Capturar firmas digitales
6. Generar PDF automáticamente
7. Envío por email al cliente
8. Actualización automática del estado del servicio

#### Set Fotográfico Unificado
- **Interfaz por pestañas**: Una pestaña por cada categoría
- **Indicadores visuales**: Pestañas verdes cuando tienen foto
- **Captura optimizada**: Uso de cámara del dispositivo
- **Almacenamiento local**: Fotos guardadas en localStorage
- **Validación**: Mínimo 1 foto requerida para completar
- **Contador de progreso**: X fotos • Y/6 categorías

### 4. Clientes
**Ubicación**: Menú principal > Clientes
**Función**: Gestión completa de base de datos de clientes

#### Información del Cliente
- Datos básicos (nombre, RUT, contacto)
- Dirección completa
- Historial de servicios
- Estado de facturación
- Usuario asociado para portal

#### Funcionalidades Avanzadas
- Crear nuevo cliente
- Editar información existente
- Ver historial completo de servicios
- Generar reportes por cliente
- Asociar usuarios para acceso al portal
- Vista móvil optimizada

### 5. Operadores
**Ubicación**: Menú principal > Operadores
**Función**: Gestión de operadores de grúas

#### Información del Operador
- Datos personales completos
- Número de licencia
- Fecha de vencimiento de exámenes
- Servicios asignados
- Comisiones y pagos

#### Alertas y Control
- Vencimiento de licencias
- Vencimiento de exámenes médicos
- Servicios asignados pendientes
- Performance y estadísticas

### 6. Grúas
**Ubicación**: Menú principal > Grúas
**Función**: Gestión completa de flota de grúas

#### Información de la Grúa
- Patente y identificación
- Marca y modelo
- Tipo de grúa
- Documentación vigente
- Estado operativo actual

#### Control de Documentos
- Permiso de circulación
- Seguro obligatorio
- Revisión técnica
- Mantenimientos programados

### 7. Tipos de Servicios
**Ubicación**: Menú principal > Tipos de Servicios
**Función**: Configuración de tipos de servicios ofrecidos

#### Configuración Avanzada por Tipo
- Precio base configurable
- Campos requeridos específicos
- Información de vehículo obligatoria
- Requiere orden de compra
- Requiere asignación de grúa/operador
- Configuración para portal de clientes

### 8. Cierres de Servicios
**Ubicación**: Menú principal > Cierres
**Función**: Agrupación de servicios para facturación

#### Proceso de Cierre Mejorado
1. Seleccionar rango de fechas
2. Filtrar por cliente (opcional)
3. Revisar servicios incluidos
4. Generar cierre automático
5. Proceder directamente a facturación

### 9. Facturación
**Ubicación**: Menú principal > Facturas
**Función**: Generación y gestión completa de facturas

#### Estados de Factura
- **Borrador**: En proceso de creación
- **Enviada**: Factura enviada al cliente
- **Pagada**: Pago recibido y confirmado
- **Vencida**: Factura con pago pendiente

#### Funcionalidades Avanzadas
- Generación automática desde cierres
- Envío por email con PDF adjunto
- Recordatorios automáticos de pago
- Control de vencimientos
- Integración con datos de empresa

### 10. Costos
**Ubicación**: Menú principal > Costos
**Función**: Registro y control de gastos operativos

#### Categorías de Costos
- Combustible
- Mantenimiento
- Salarios y comisiones
- Gastos generales
- Costos por servicio

#### Asociación Inteligente
- Por servicio específico
- Por grúa individual
- Por operador
- Costos generales de operación

### 11. Reportes
**Ubicación**: Menú principal > Reportes
**Función**: Generación de informes y análisis avanzados

#### Tipos de Reportes
- Servicios por período
- Ingresos y gastos detallados
- Análisis de rentabilidad
- Reporte de operadores
- Estado de documentos
- Reportes operacionales

#### Formatos y Exportación
- PDF para impresión profesional
- Excel para análisis detallado
- Visualización interactiva en pantalla
- Filtros avanzados por múltiples criterios

### 12. Portal de Clientes
**Ubicación**: Portal web independiente para clientes
**Función**: Autoservicio completo para clientes

#### Funcionalidades del Cliente
- Dashboard personalizado con métricas
- Ver historial completo de servicios
- Descargar facturas y documentos
- **Solicitar nuevos servicios** con formulario avanzado
- Seguimiento de servicios activos
- Acceso a inspecciones con fotos

#### Solicitud de Servicios
- Formulario intuitivo paso a paso
- Validación en tiempo real
- Selección de tipos de servicio disponibles
- Información detallada del vehículo
- Confirmación automática por email

### 13. Configuración
**Ubicación**: Menú principal > Configuración
**Función**: Configuración completa del sistema

#### Configuración de Empresa
- Datos básicos de la empresa
- Logo corporativo con upload
- Formato de folios personalizables
- Textos legales para documentos
- Información de contacto

#### Gestión Avanzada de Usuarios
- **Sistema de invitaciones por email**
- Creación de usuarios con pre-registro
- Asignación de roles dinámicos
- Activar/desactivar usuarios
- Asociar clientes a usuarios
- Control de estados de invitación

#### Configuración del Sistema
- Respaldos automáticos programables
- Configuración de notificaciones
- Alertas de vencimientos personalizables
- Configuración de emails corporativos
- Parámetros de seguridad

### 14. Calendario (Nuevo)
**Ubicación**: Menú principal > Calendario
**Función**: Vista de calendario integrada con servicios

#### Funcionalidades del Calendario
- Vista por mes, semana y día
- Eventos integrados con servicios
- Filtros por tipo de evento
- Navegación intuitiva
- Integración con alertas de vencimientos

## Flujos de Trabajo Principales

### Flujo Completo de Servicio Mejorado
1. **Creación**: Cliente solicita servicio (portal o admin)
2. **Planificación**: Asignación automática de recursos
3. **Ejecución**: Operador realiza servicio e inspección completa
4. **Inspección Digital**: Set fotográfico + firmas + observaciones
5. **Documentación**: Generación automática de PDF
6. **Comunicación**: Envío automático por email
7. **Cierre**: Servicio marcado como completado automáticamente
8. **Facturación**: Inclusión en cierre y factura
9. **Cobro**: Gestión de pagos y recordatorios

### Flujo de Inspección Digital
1. **Acceso**: Operador accede desde dashboard
2. **Equipamiento**: Checklist de elementos requeridos
3. **Set Fotográfico**: Captura por categorías (6 tipos)
4. **Observaciones**: Notas sobre estado del vehículo
5. **Firmas**: Digital del operador y cliente
6. **Generación**: PDF automático con toda la información
7. **Envío**: Email automático al cliente
8. **Actualización**: Estado del servicio actualizado

### Gestión de Usuarios con Invitaciones
1. **Creación**: Admin crea usuario con email
2. **Invitación**: Email automático con enlace de registro
3. **Seguimiento**: Control de estado de invitación
4. **Registro**: Usuario completa su información
5. **Activación**: Acceso automático según rol asignado

## Características Técnicas Avanzadas

### Sistema de Fotos Mejorado
- **Compresión automática** para PDFs
- **Almacenamiento local** con gestión de memoria
- **Validación de formatos** de imagen
- **Metadata** con timestamp y categorización
- **Limpieza automática** después de envío

### Generación de PDFs
- **Diseño profesional** con logo corporativo
- **Compresión inteligente** de imágenes
- **Firmas digitales** integradas
- **Información completa** del servicio
- **Optimización** para email y descarga

### Portal de Clientes
- **Autenticación independiente** del sistema principal
- **Interface responsive** para móviles
- **Formularios inteligentes** con validación
- **Dashboard personalizado** por cliente
- **Integración completa** con servicios

## Mejores Prácticas de Uso

### Para Administradores
- Revisar alertas de vencimientos semanalmente
- Configurar respaldos automáticos
- Gestionar usuarios con sistema de invitaciones
- Monitorear métricas del dashboard
- Mantener información de empresa actualizada

### Para Operadores
- Completar inspecciones inmediatamente
- Tomar todas las fotos requeridas por categoría
- Verificar envío de emails automáticos
- Actualizar estados de servicios en tiempo real
- Mantener dispositivo con conectividad

### Para Clientes
- Utilizar portal para solicitudes de servicio
- Verificar emails de confirmación
- Descargar documentos importantes
- Mantener información de contacto actualizada

## Funcionalidades PWA

### Capacidades Offline
- Cache inteligente de recursos
- Funcionamiento básico sin conexión
- Sincronización al recuperar conexión
- Instalación como aplicación nativa

### Notificaciones
- Alertas de nuevos servicios
- Recordatorios de vencimientos
- Confirmaciones de operaciones
- Estados de sincronización

## Soporte y Contacto

### Canales de Soporte
- Email: soporte@tmsgruas.com
- Teléfono: +56 2 1234 5678
- Chat en línea: Disponible en horario laboral
- Portal de documentación: docs.tmsgruas.com

### Horarios de Atención
- Lunes a Viernes: 8:00 - 18:00
- Sábados: 9:00 - 13:00
- Domingos: Emergencias únicamente

### Documentación Adicional
- Guías en video: [youtube.com/tmsgruas]
- Base de conocimientos: [kb.tmsgruas.com]
- Foro de usuarios: [forum.tmsgruas.com]
- API documentation: [api.tmsgruas.com]

## Actualizaciones Recientes

### Set Fotográfico Unificado
- Nueva interfaz por pestañas
- 6 categorías específicas de fotos
- Validación mejorada (mínimo 1 foto)
- Indicadores visuales de progreso
- Integración completa con PDFs

### Sistema de Invitaciones
- Pre-registro de usuarios
- Emails automáticos de invitación
- Control de estados de invitación
- Reenvío de invitaciones
- Integración con roles

### Portal de Clientes Mejorado
- Solicitud de servicios integrada
- Dashboard personalizado
- Acceso a inspecciones completas
- Interface móvil optimizada

Este manual se actualiza constantemente con nuevas funcionalidades del sistema.

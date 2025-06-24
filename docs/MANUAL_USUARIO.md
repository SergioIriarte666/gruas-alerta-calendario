
# Manual de Usuario - TMS Grúas

## Introducción

TMS Grúas es un sistema integral de gestión para empresas de servicios de grúas que permite administrar servicios, clientes, operadores, equipos y facturación de manera eficiente.

## Roles de Usuario

### Administrador
- Acceso completo al sistema
- Gestión de usuarios y configuración
- Acceso a todos los módulos

### Operador
- Acceso al portal del operador
- Gestión de inspecciones
- Visualización de servicios asignados

### Cliente
- Acceso al portal de clientes
- Visualización de servicios contratados
- Solicitud de nuevos servicios

### Visualizador
- Solo lectura en módulos permitidos
- Acceso a reportes básicos

## Módulos del Sistema

### 1. Dashboard
**Ubicación**: Página principal
**Función**: Vista general del estado del negocio

#### Métricas Principales
- Total de servicios del mes
- Ingresos mensuales
- Servicios pendientes
- Facturas vencidas

#### Alertas
- Vencimientos de documentos
- Servicios urgentes
- Facturas por cobrar

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
7. Guardar

#### Estados de Servicio
- **Pendiente**: Servicio creado, esperando ejecución
- **En Progreso**: Servicio siendo ejecutado
- **Completado**: Servicio finalizado exitosamente
- **Cancelado**: Servicio cancelado
- **Facturado**: Servicio incluido en factura

#### Filtros Disponibles
- Por estado
- Por fecha
- Por cliente
- Por operador
- Por tipo de servicio

### 3. Clientes
**Ubicación**: Menú principal > Clientes
**Función**: Gestión de base de datos de clientes

#### Información del Cliente
- Datos básicos (nombre, RUT, contacto)
- Dirección
- Historial de servicios
- Estado de facturación

#### Funciones
- Crear nuevo cliente
- Editar información existente
- Ver historial de servicios
- Generar reportes por cliente

### 4. Operadores
**Ubicación**: Menú principal > Operadores
**Función**: Gestión de operadores de grúas

#### Información del Operador
- Datos personales
- Número de licencia
- Fecha de vencimiento de exámenes
- Servicios asignados
- Comisiones

#### Alertas
- Vencimiento de licencias
- Vencimiento de exámenes médicos
- Servicios asignados pendientes

### 5. Grúas
**Ubicación**: Menú principal > Grúas
**Función**: Gestión de flota de grúas

#### Información de la Grúa
- Patente
- Marca y modelo
- Tipo de grúa
- Documentación vigente
- Estado operativo

#### Documentos a Controlar
- Permiso de circulación
- Seguro
- Revisión técnica

### 6. Tipos de Servicios
**Ubicación**: Menú principal > Tipos de Servicios
**Función**: Configuración de tipos de servicios ofrecidos

#### Configuración por Tipo
- Precio base
- Campos requeridos
- Información de vehículo obligatoria
- Requiere orden de compra
- Requiere grúa/operador

### 7. Cierres de Servicios
**Ubicación**: Menú principal > Cierres
**Función**: Agrupación de servicios para facturación

#### Proceso de Cierre
1. Seleccionar rango de fechas
2. Filtrar por cliente (opcional)
3. Revisar servicios incluidos
4. Generar cierre
5. Proceder a facturación

### 8. Facturación
**Ubicación**: Menú principal > Facturas
**Función**: Generación y gestión de facturas

#### Estados de Factura
- **Borrador**: En proceso de creación
- **Enviada**: Factura enviada al cliente
- **Pagada**: Pago recibido y confirmado
- **Vencida**: Factura con pago pendiente

#### Funciones
- Generar factura desde cierre
- Enviar por email
- Marcar como pagada
- Generar recordatorios de pago

### 9. Costos
**Ubicación**: Menú principal > Costos
**Función**: Registro y control de gastos operativos

#### Categorías de Costos
- Combustible
- Mantenimiento
- Salarios
- Gastos generales

#### Asociación de Costos
- Por servicio específico
- Por grúa
- Por operador
- Costos generales

### 10. Reportes
**Ubicación**: Menú principal > Reportes
**Función**: Generación de informes y análisis

#### Tipos de Reportes
- Servicios por período
- Ingresos y gastos
- Análisis de rentabilidad
- Reporte de operadores
- Estado de documentos

#### Formatos Disponibles
- PDF para impresión
- Excel para análisis
- Visualización en pantalla

### 11. Portal del Operador
**Ubicación**: Acceso directo para operadores
**Función**: Herramientas específicas para operadores

#### Funcionalidades
- Ver servicios asignados
- Realizar inspecciones
- Generar PDFs de inspección
- Actualizar estado de servicios

#### Proceso de Inspección
1. Seleccionar servicio asignado
2. Completar checklist de equipos
3. Tomar fotos requeridas
4. Firmar digitalmente
5. Generar y enviar PDF

### 12. Portal de Clientes
**Ubicación**: Portal web específico para clientes
**Función**: Autoservicio para clientes

#### Funcionalidades del Cliente
- Ver historial de servicios
- Descargar facturas
- Solicitar nuevos servicios
- Seguimiento de servicios activos

### 13. Configuración
**Ubicación**: Menú principal > Configuración
**Función**: Configuración general del sistema

#### Configuración de Empresa
- Datos de la empresa
- Logo corporativo
- Formato de folios
- Textos legales

#### Configuración del Sistema
- Respaldos automáticos
- Notificaciones
- Alertas de vencimientos
- Configuración de emails

#### Gestión de Usuarios
- Crear nuevos usuarios
- Asignar roles
- Activar/desactivar usuarios
- Asociar clientes a usuarios

## Flujos de Trabajo Principales

### Flujo Completo de Servicio
1. **Creación**: Cliente solicita servicio
2. **Planificación**: Asignación de grúa y operador
3. **Ejecución**: Operador realiza servicio e inspección
4. **Cierre**: Servicio marcado como completado
5. **Facturación**: Inclusión en cierre y factura
6. **Cobro**: Gestión de pagos

### Gestión de Vencimientos
1. **Monitoreo**: Sistema revisa fechas de vencimiento
2. **Alertas**: Notificaciones automáticas
3. **Acción**: Renovación de documentos
4. **Seguimiento**: Confirmación de renovación

### Proceso de Facturación
1. **Cierre de Período**: Agrupar servicios completados
2. **Revisión**: Verificar servicios incluidos
3. **Generación**: Crear factura formal
4. **Envío**: Distribución al cliente
5. **Seguimiento**: Control de pagos

## Consejos de Uso

### Mejores Prácticas
- Actualizar estados de servicios en tiempo real
- Revisar alertas de vencimientos regularmente
- Mantener información de contacto actualizada
- Generar respaldos periódicamente

### Atajos de Teclado
- `Ctrl + N`: Nuevo registro (en módulos aplicables)
- `Ctrl + S`: Guardar
- `Ctrl + F`: Buscar
- `Esc`: Cerrar modales

### Solución de Problemas
- **Error de permisos**: Verificar rol de usuario
- **Datos no actualizados**: Refrescar página
- **Problemas de conexión**: Verificar internet
- **Error en formularios**: Revisar campos requeridos

## Soporte y Contacto

### Canales de Soporte
- Email: soporte@tmsgruas.com
- Teléfono: +56 2 1234 5678
- Chat en línea: Disponible en horario laboral

### Horarios de Atención
- Lunes a Viernes: 8:00 - 18:00
- Sábados: 9:00 - 13:00
- Domingos: Emergencias únicamente

### Documentación Adicional
- Guías en video: [youtube.com/tmsgruas]
- Base de conocimientos: [kb.tmsgruas.com]
- Foro de usuarios: [forum.tmsgruas.com]

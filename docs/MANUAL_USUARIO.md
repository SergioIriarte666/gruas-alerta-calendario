
# Manual de Usuario - Sistema de Gestión de Transportes (TMS)

## 1. Introducción

Bienvenido al Sistema de Gestión de Transportes (TMS). Esta aplicación está diseñada para centralizar y optimizar la gestión de servicios de grúas, clientes, operadores, costos y facturación de su empresa. El sistema funciona como una Progressive Web App (PWA) que puede instalarse en dispositivos móviles y computadores.

## 2. Primeros Pasos

### Instalación como App
1. Abra el sitio web en su navegador
2. Si aparece una notificación de instalación, haga clic en "Instalar"
3. La app se instalará como una aplicación nativa en su dispositivo

### Inicio de Sesión
Para comenzar a usar el sistema, un administrador debe proporcionarle sus credenciales de acceso. Una vez que inicie sesión, verá diferentes interfaces según su rol:

- **Administrador/Visualizador**: Dashboard principal completo
- **Operador**: Portal especializado con servicios asignados

## 3. Roles del Sistema

### 3.1. Administrador (`admin`)
- Acceso completo a todas las funcionalidades
- Gestión de usuarios y configuración del sistema
- Creación y edición de todos los registros

### 3.2. Visualizador (`viewer`)
- Acceso de solo lectura
- Visualización de dashboards y reportes
- Sin capacidad de edición

### 3.3. Operador (`operator`)
- Portal especializado para trabajo en terreno
- Solo ve servicios asignados a él
- Puede realizar inspecciones y actualizar estado de servicios

## 4. Módulos Principales (Admin/Viewer)

### 4.1. Dashboard
El dashboard ofrece una vista rápida de las métricas más importantes:
- **Servicios Recientes**: Tabla con los últimos servicios registrados
- **Alertas y Notificaciones**: Avisos sobre vencimientos y tareas pendientes
- **Métricas Clave**: Tarjetas con totales de servicios, ingresos, costos
- **Estado de Sincronización**: Indicador PWA de conexión y datos offline

### 4.2. Calendario
Vista visual de todos los eventos programados:
- **Vistas**: Mensual, semanal y diaria
- **Creación de Eventos**: Botón "Crear Evento" para añadir servicios, mantenimientos o reuniones
- **Detalles del Día**: Sidebar derecho con eventos del día seleccionado
- **Navegación**: Controles para cambiar entre fechas y vistas

### 4.3. Servicios
Gestión completa de servicios de grúas:
- **Crear Servicio**: Formulario completo con cliente, grúa, operador, vehículo
- **Importar Servicios**: Carga masiva via CSV/Excel con plantilla descargable
- **Filtros Avanzados**: Por estado, fecha, cliente, operador, tipo de servicio
- **Estados**: `pending`, `in_progress`, `completed`, `cancelled`
- **Acciones**: Ver detalles, editar, cambiar estado

### 4.4. Clientes
Gestión de base de datos de clientes:
- **Información Completa**: Datos de contacto, facturación, RUT
- **Historial de Servicios**: Servicios realizados por cliente
- **Estado**: Activar/desactivar clientes
- **Filtros**: Búsqueda por nombre, RUT, estado

### 4.5. Grúas
Administración de flota de grúas:
- **Información Técnica**: Marca, modelo, tipo, capacidad
- **Documentación**: Licencias, seguros, revisiones técnicas
- **Estado Operativo**: Disponible, en servicio, mantenimiento
- **Alertas**: Vencimientos de documentos

### 4.6. Operadores
Gestión de personal operativo:
- **Datos Personales**: Nombre, RUT, contacto
- **Documentación**: Licencias, certificaciones
- **Vinculación**: Conexión con usuarios del sistema para portal operador
- **Historial**: Servicios realizados por operador

### 4.7. Cierres de Servicios
Sistema de agrupación para facturación:
- **Nuevo Cierre**: Agrupa servicios completados por período y/o cliente
- **Filtros**: Solo servicios completados no incluidos en cierres anteriores
- **Estados**: Abierto → Cerrado → Facturado
- **Prevención**: Evita doble facturación de servicios
- **Totales**: Cálculo automático de montos

### 4.8. Facturación
Generación y gestión de facturas:
- **Desde Cierres**: Crear facturas basadas en cierres
- **Individuales**: Facturas por servicios específicos
- **Estados**: Borrador, Enviada, Pagada, Vencida
- **PDF**: Generación de documentos para envío
- **Seguimiento**: Control de pagos y vencimientos

### 4.9. Costos
Registro de costos operativos:
- **Categorías**: Combustible, mantenimiento, personal, otros
- **Registro**: Fecha, monto, descripción, categoría
- **Análisis**: Integración con reportes de rentabilidad
- **Filtros**: Por fecha, categoría, monto

### 4.10. Reportes
Análisis de rendimiento del negocio:
- **Filtros**: Rango de fechas, cliente específico
- **Métricas**: Ingresos, costos, beneficios, márgenes
- **Gráficos**: Tendencias, distribución por cliente, evolución temporal
- **Exportación**: PDF, Excel para análisis externo
- **Comparativas**: Períodos anteriores, objetivos

### 4.11. Configuración
Personalización del sistema:
- **Empresa**: Nombre, RUT, dirección, logotipo
- **Sistema**: IVA, formato de folios, notificaciones
- **Usuarios**: Gestión de accesos y roles
- **PWA**: Configuración de funcionalidades offline

## 5. Portal del Operador

### 5.1. Dashboard Operador
Vista simplificada enfocada en trabajo de campo:
- **Servicios Asignados**: Solo servicios pendientes y en progreso
- **Información Clave**: Cliente, ubicación, tipo de servicio
- **Estado Actual**: Pendiente, en progreso
- **Acceso Rápido**: Navegación directa a inspección

### 5.2. Inspección de Servicios
Herramienta completa para trabajo en terreno:
- **Checklist de Equipos**: Verificación de grúa y herramientas
- **Inspección de Vehículo**: Estado del vehículo a trasladar
- **Captura de Fotos**: Registro visual del servicio
- **Firmas Digitales**: Cliente y operador
- **Observaciones**: Notas del servicio
- **Actualización de Estado**: Cambio a completado tras inspección

### 5.3. Funcionalidades PWA para Operadores
- **Offline**: Trabajo sin conexión a internet
- **Sincronización**: Carga automática al recuperar conexión
- **Instalable**: App nativa en dispositivo móvil
- **Notificaciones**: Alertas de nuevos servicios asignados

## 6. Funcionalidades PWA

### 6.1. Trabajo Offline
- **Cache Inteligente**: Datos principales disponibles sin conexión
- **Acciones Pendientes**: Registro de cambios para sincronizar
- **Indicador de Estado**: Muestra conexión y elementos pendientes

### 6.2. Sincronización
- **Automática**: Al recuperar conexión
- **Manual**: Botón de sincronización forzada
- **Historial**: Registro de sincronizaciones exitosas
- **Conflictos**: Resolución inteligente de datos

### 6.3. Instalación
- **Detección**: Prompt automático de instalación
- **Multiplataforma**: Funciona en Android, iOS, Desktop
- **Actualizaciones**: Notificación de nuevas versiones

## 7. Flujos de Trabajo Principales

### 7.1. Registro de Servicio Completo
1. Crear servicio desde Dashboard o Calendario
2. Asignar cliente, grúa y operador
3. Completar información del vehículo
4. Operador realiza inspección en terreno
5. Servicio se marca como completado
6. Incluir en cierre para facturación

### 7.2. Facturación por Período
1. Crear cierre con rango de fechas
2. Filtrar por cliente (opcional)
3. Seleccionar servicios completados
4. Cerrar período
5. Generar factura desde cierre
6. Enviar PDF al cliente

### 7.3. Trabajo del Operador
1. Login al portal del operador
2. Ver servicios asignados
3. Seleccionar servicio pendiente
4. Realizar inspección completa
5. Capturar fotos y firmas
6. Completar servicio
7. Sistema sincroniza automáticamente

## 8. Consejos y Mejores Prácticas

### 8.1. Para Administradores
- Mantener documentos de grúas y operadores actualizados
- Revisar alertas de vencimientos regularmente
- Crear cierres periódicos para facturación ordenada
- Monitorear reportes de rentabilidad mensualmente

### 8.2. Para Operadores
- Instalar la app PWA en el dispositivo móvil
- Completar inspecciones detalladamente
- Capturar fotos de calidad del servicio
- Obtener firmas de clientes siempre
- Sincronizar al finalizar cada servicio

### 8.3. Generales
- Mantener información de clientes actualizada
- Usar filtros para encontrar información rápidamente
- Aprovechar la carga masiva para migración de datos
- Configurar notificaciones según necesidades

## 9. Resolución de Problemas

### 9.1. Problemas de Conexión
- Verificar conexión a internet
- Revisar indicador de sincronización
- Forzar sincronización manual si es necesario

### 9.2. Problemas de Acceso Operador
- Verificar que el usuario tenga rol 'operator'
- Confirmar vinculación en tabla de operadores
- Contactar administrador para configuración

### 9.3. Datos No Sincronizados
- Verificar indicador PWA de elementos pendientes
- Forzar sincronización manual
- Verificar logs en consola del navegador

## 10. Soporte y Contacto

Para soporte técnico o consultas sobre el uso del sistema, contacte a su administrador del sistema o al departamento de TI de su empresa.

La documentación técnica completa está disponible para desarrolladores y administradores de sistema en los archivos de documentación del proyecto.

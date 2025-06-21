
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
- **Gestión de respaldos y restauración**

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

#### Estados de Servicios
- **Pendiente** (`pending`): Servicio programado, sin iniciar
- **En Progreso** (`in_progress`): Servicio siendo ejecutado
- **Completado** (`completed`): Servicio terminado, listo para facturar
- **Cancelado** (`cancelled`): Servicio cancelado
- **Facturado** (`invoiced`): Servicio ya incluido en factura (automático)

#### Crear Servicio
- **Formulario Completo**: Cliente, grúa, operador, vehículo
- **Servicios Especiales**: 
  - **Taxi**: Transporte de pasajeros (información de vehículo opcional)
  - **Transporte de Materiales**: Traslado de materiales y suministros (información de vehículo opcional)
- **Importar Servicios**: Carga masiva via CSV/Excel con plantilla descargable
- **Filtros Avanzados**: Por estado, fecha, cliente, operador, tipo de servicio

#### Tipos de Servicios Especiales
El sistema reconoce automáticamente ciertos tipos de servicios donde la información del vehículo no es requerida:

- **Servicios de Taxi**: Para transporte de pasajeros
- **Transporte de Materiales**: Para traslado de materiales y suministros
- **Otros servicios especializados**: Según configuración de tipos de servicio

Para estos servicios, los campos de marca, modelo y patente del vehículo son opcionales y aparecen claramente marcados en el formulario.

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
Sistema de agrupación para facturación **con prevención de doble facturación**:

#### Características Principales
- **Nuevo Cierre**: Agrupa servicios completados por período y/o cliente
- **Filtros Inteligentes**: 
  - Solo servicios con estado `completado`
  - Excluye servicios ya incluidos en cierres anteriores
  - Excluye automáticamente servicios ya facturados
- **Estados**: Abierto → Cerrado → Facturado
- **Prevención Automática**: Sistema evita doble facturación
- **Totales**: Cálculo automático de montos

#### ¿Por qué no veo algunos servicios?
El sistema filtra automáticamente para mostrar solo servicios disponibles:
- ✅ **Se incluyen**: Servicios con estado "completado" en el rango de fechas
- ❌ **Se excluyen**: Servicios ya incluidos en cierres anteriores
- ❌ **Se excluyen**: Servicios ya facturados (estado "facturado")

#### Información en Pantalla
- **Alertas informativas**: Explican por qué ciertos servicios no aparecen
- **Contadores**: Muestran servicios disponibles vs excluidos
- **Estado por servicio**: Indica el estado actual de cada servicio

### 4.8. Facturación
Generación y gestión de facturas **con actualización automática**:

#### Características Principales
- **Desde Cierres**: Crear facturas basadas en cierres
- **Individuales**: Facturas por servicios específicos
- **Estados**: Borrador, Enviada, Pagada, Vencida
- **PDF**: Generación de documentos para envío
- **Seguimiento**: Control de pagos y vencimientos

#### Automatización del Sistema
- **Actualización Automática**: Al crear factura, servicios cambian a estado "facturado"
- **Trigger de Base de Datos**: Mantiene consistencia automáticamente
- **Prevención de Errores**: Servicios facturados no aparecen en futuros cierres

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

#### 4.11.1. Empresa
- **Información Básica**: Nombre, RUT, dirección, contacto
- **Logotipo**: Carga y gestión de imagen corporativa
- **Formato de Folios**: Personalización de numeración
- **Configuración Fiscal**: IVA, términos legales

#### 4.11.2. Usuario
- **Preferencias**: Idioma, zona horaria, formato de fecha
- **Notificaciones**: Configuración de alertas
- **Tema**: Personalización visual
- **Moneda**: Configuración regional

#### 4.11.3. Sistema
- **Respaldo Automático**: Configuración de frecuencia
- **Retención de Datos**: Políticas de almacenamiento
- **Modo Mantenimiento**: Control de acceso durante actualizaciones
- **Gestión de Respaldos**: Herramientas de backup y restauración

#### 4.11.4. Notificaciones
- **Email**: Configuración de correos automáticos
- **Recordatorios**: Alertas de servicios y vencimientos
- **Facturación**: Notificaciones de pagos y vencimientos
- **Sistema**: Actualizaciones y mantenimiento

#### 4.11.5. Usuarios
- **Gestión de Roles**: Administración de permisos
- **Activación/Desactivación**: Control de acceso
- **Configuración de Operadores**: Vinculación con personal
- **Auditoría**: Registro de actividades

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
- **Inspección de Vehículo**: Estado del vehículo a trasladar (si aplica)
- **Captura de Fotos**: Registro visual del servicio
- **Firmas Digitales**: Cliente y operador
- **Observaciones**: Notas del servicio
- **Actualización de Estado**: Cambio a completado tras inspección

### 5.3. Funcionalidades PWA para Operadores
- **Offline**: Trabajo sin conexión a internet
- **Sincronización**: Carga automática al recuperar conexión
- **Instalable**: App nativa en dispositivo móvil
- **Notificaciones**: Alertas de nuevos servicios asignados

## 6. Gestión de Respaldos y Recuperación

### 6.1. Sistema de Respaldos Automáticos
- **Configuración**: Frecuencia diaria, semanal o mensual
- **Automático**: Generación sin intervención manual
- **Notificaciones**: Alertas sobre estado de respaldos
- **Historial**: Registro de todos los respaldos generados

### 6.2. Respaldos Manuales

#### Tipos de Respaldo
1. **Respaldo Completo** (Recomendado)
   - Incluye todos los datos del sistema
   - Estructura completa de tablas
   - Formato SQL para restauración completa
   - Tamaño mayor, tiempo de generación más largo

2. **Respaldo Rápido** (Configuración)
   - Solo configuración de empresa y sistema
   - Estadísticas básicas y conteos
   - Formato JSON liviano
   - Ideal para migración de configuración

#### Proceso de Respaldo Manual
1. **Acceder**: Configuración → Sistema → Gestión de Respaldos
2. **Seleccionar Tipo**: Completo o Rápido
3. **Generar**: El sistema procesa y descarga automáticamente
4. **Verificar**: Confirmar descarga y almacenamiento seguro

### 6.3. Almacenamiento de Respaldos
- **Ubicación Externa**: Nunca almacenar solo en el servidor
- **Múltiples Copias**: Mantener en diferentes ubicaciones
- **Cifrado**: Proteger archivos sensibles
- **Etiquetado**: Fecha y tipo claramente identificados
- **Prueba**: Verificar integridad periódicamente

### 6.4. Recuperación y Restauración

#### Cuándo Restaurar
- **Pérdida de Datos**: Corrupción o eliminación accidental
- **Migración**: Cambio de servidor o instalación
- **Desarrollo**: Copia de datos de producción
- **Auditoría**: Verificación de estados anteriores

#### Proceso de Restauración
1. **Preparación**: Sistema limpio o respaldo actual
2. **Archivo SQL**: Usar respaldo completo más reciente
3. **Ejecución**: Aplicar mediante herramientas de base de datos
4. **Verificación**: Confirmar integridad y funcionalidad
5. **Configuración**: Ajustar parámetros específicos del entorno

#### Consideraciones Importantes
- ⚠️ **Solo administradores** pueden generar respaldos
- ⚠️ **Verificar compatibilidad** antes de restaurar
- ⚠️ **Respaldar antes** de cualquier restauración
- ⚠️ **Probar en entorno de desarrollo** primero

### 6.5. Monitoreo y Alertas
- **Dashboard**: Estado de último respaldo en configuración
- **Historial**: Registro de todos los respaldos generados
- **Alertas**: Notificaciones de fallas o respaldos exitosos
- **Métricas**: Tamaño, tiempo de generación, frecuencia

## 7. Funcionalidades PWA

### 7.1. Trabajo Offline
- **Cache Inteligente**: Datos principales disponibles sin conexión
- **Acciones Pendientes**: Registro de cambios para sincronizar
- **Indicador de Estado**: Muestra conexión y elementos pendientes

### 7.2. Sincronización
- **Automática**: Al recuperar conexión
- **Manual**: Botón de sincronización forzada
- **Historial**: Registro de sincronizaciones exitosas
- **Conflictos**: Resolución inteligente de datos

### 7.3. Instalación
- **Detección**: Prompt automático de instalación
- **Multiplataforma**: Funciona en Android, iOS, Desktop
- **Actualizaciones**: Notificación de nuevas versiones

## 8. Flujos de Trabajo Principales

### 8.1. Registro de Servicio Completo
1. Crear servicio desde Dashboard o Calendario
2. Asignar cliente, grúa y operador
3. Completar información del vehículo (si aplica)
4. Operador realiza inspección en terreno
5. Servicio se marca como completado
6. Incluir en cierre para facturación
7. **Sistema actualiza automáticamente a "facturado" al crear factura**

### 8.2. Registro de Servicios Especiales
1. Seleccionar tipo de servicio (Taxi, Transporte de Materiales)
2. El sistema automáticamente hace opcionales los campos de vehículo
3. Completar solo la información requerida
4. Proceder normalmente con el flujo de servicio

### 8.3. Facturación por Período (Con Prevención de Doble Facturación)
1. Crear cierre con rango de fechas
2. Filtrar por cliente (opcional)
3. **Sistema muestra solo servicios disponibles**:
   - ✅ Servicios completados en el período
   - ❌ Excluye servicios ya en cierres anteriores
   - ❌ Excluye servicios ya facturados
4. Seleccionar servicios disponibles
5. Cerrar período
6. Generar factura desde cierre
7. **Sistema automáticamente marca servicios como "facturados"**
8. Enviar PDF al cliente

### 8.4. Trabajo del Operador
1. Login al portal del operador
2. Ver servicios asignados
3. Seleccionar servicio pendiente
4. Realizar inspección completa
5. Capturar fotos y firmas
6. Completar servicio
7. Sistema sincroniza automáticamente

### 8.5. Gestión de Respaldos (Solo Administradores)
1. Acceder a Configuración → Sistema
2. Revisar estado de último respaldo
3. Configurar respaldos automáticos (recomendado)
4. Generar respaldo manual cuando sea necesario:
   - **Antes de actualizaciones importantes**
   - **Antes de migración de datos**
   - **Periodicidad según políticas de empresa**
5. Descargar y almacenar en ubicación segura
6. Verificar integridad del archivo descargado
7. Documentar respaldo en registros de empresa

## 9. Estados de Servicios y Flujo

### 9.1. Ciclo de Vida del Servicio
```
Pendiente → En Progreso → Completado → Facturado
     ↓           ↓
 Cancelado   Cancelado
```

### 9.2. Transiciones Automáticas
- **Manual**: Operador cambia de "pendiente" a "en progreso"
- **Manual**: Operador cambia de "en progreso" a "completado"
- **Automática**: Sistema cambia de "completado" a "facturado" al crear factura

### 9.3. Reglas de Negocio
- Solo servicios "completados" aparecen en cierres
- Servicios "facturados" no aparecen en futuros cierres
- Sistema previene automáticamente doble facturación
- Operadores solo ven servicios asignados a ellos
- Solo administradores pueden generar respaldos

## 10. Consejos y Mejores Prácticas

### 10.1. Para Administradores
- Mantener documentos de grúas y operadores actualizados
- Revisar alertas de vencimientos regularmente
- Crear cierres periódicos para facturación ordenada
- Monitorear reportes de rentabilidad mensualmente
- Utilizar tipos de servicio especiales para simplificar registro
- **Confiar en el sistema**: La prevención de doble facturación es automática
- **Respaldos regulares**: Generar respaldos antes de cambios importantes
- **Almacenamiento externo**: Nunca confiar solo en respaldos del servidor
- **Verificación periódica**: Probar restauración en entorno de desarrollo

### 10.2. Para Operadores
- Instalar la app PWA en el dispositivo móvil
- Completar inspecciones detalladamente
- Capturar fotos de calidad del servicio
- Obtener firmas de clientes siempre
- Sincronizar al finalizar cada servicio

### 10.3. Generales
- Mantener información de clientes actualizada
- Usar filtros para encontrar información rápidamente
- Aprovechar la carga masiva para migración de datos
- Configurar notificaciones según necesidades
- Aprovechar los tipos de servicio especiales para agilizar el proceso
- **Importante**: Si un servicio no aparece en cierres, revisar su estado actual

### 10.4. Respaldos y Seguridad
- **Generar respaldos** antes de actualizaciones o cambios importantes
- **Almacenar externamente** en múltiples ubicaciones seguras
- **Verificar integridad** de archivos descargados
- **Documentar respaldos** con fecha, tipo y responsable
- **Probar restauración** periódicamente en entorno de pruebas
- **Capacitar personal** en procedimientos de emergencia

## 11. Resolución de Problemas

### 11.1. Problemas de Conexión
- Verificar conexión a internet
- Revisar indicador de sincronización
- Forzar sincronización manual si es necesario

### 11.2. Problemas de Acceso Operador
- Verificar que el usuario tenga rol 'operator'
- Confirmar vinculación en tabla de operadores
- Contactar administrador para configuración

### 11.3. Servicios No Aparecen en Cierres
**Posibles causas y soluciones:**

1. **Servicio no está completado**
   - ✅ Verificar que el estado sea "Completado"
   - ✅ Si está "En Progreso", finalizar el servicio

2. **Servicio ya está facturado**
   - ✅ Revisar estado del servicio (debería mostrar "Facturado")
   - ✅ Buscar en qué factura está incluido

3. **Servicio ya está en otro cierre**
   - ✅ Verificar cierres anteriores en el mismo período
   - ✅ Revisar si el cierre anterior fue procesado

4. **Fuera del rango de fechas**
   - ✅ Verificar que la fecha del servicio esté en el rango seleccionado
   - ✅ Ajustar filtros de fecha si es necesario

### 11.4. Datos No Sincronizados
- Verificar indicador PWA de elementos pendientes
- Forzar sincronización manual
- Verificar logs en consola del navegador

### 11.5. Problemas con Campos de Vehículo
- Verificar que el tipo de servicio permita campos opcionales
- Para servicios especiales (taxi, materiales), los campos son opcionales
- Contactar administrador para configurar tipos de servicio especiales

### 11.6. Problemas con Respaldos

#### No se puede generar respaldo
1. **Verificar permisos de usuario**
   - ✅ Solo administradores pueden generar respaldos
   - ✅ Contactar administrador para asignar rol correcto

2. **Error durante generación**
   - ✅ Verificar conexión a internet
   - ✅ Revisar espacio de almacenamiento disponible
   - ✅ Intentar con respaldo rápido primero
   - ✅ Contactar soporte técnico con detalles del error

3. **Respaldo no se descarga**
   - ✅ Verificar configuración del navegador para descargas
   - ✅ Desactivar bloqueadores de ventanas emergentes
   - ✅ Intentar con navegador diferente

#### Problemas de restauración
1. **Archivo corrupto o no válido**
   - ✅ Verificar integridad del archivo de respaldo
   - ✅ Usar respaldo más reciente disponible
   - ✅ Contactar administrador del sistema

2. **Error de compatibilidad**
   - ✅ Verificar versión del sistema origen y destino
   - ✅ Consultar documentación técnica
   - ✅ Contactar soporte especializado

## 12. Mensajes Informativos del Sistema

### 12.1. En Cierres de Servicios
**"¿Por qué no veo algunos servicios?"**
- Solo se muestran servicios completados del rango de fechas seleccionado
- Se excluyen servicios ya incluidos en cierres anteriores
- Se excluyen servicios ya facturados (status: facturado)

### 12.2. Estados de Servicios
- **Pendiente**: Servicio programado
- **En Progreso**: Operador trabajando en el servicio
- **Completado**: Servicio terminado, disponible para facturar
- **Facturado**: Ya incluido en factura (cambio automático)
- **Cancelado**: Servicio no realizado

### 12.3. En Respaldos
**"Estado del Sistema"**
- **Verde**: Último respaldo exitoso reciente
- **Amarillo**: No hay respaldos recientes, se recomienda generar uno
- **Rojo**: Error en último respaldo, revisar configuración

**"Progreso de Respaldo"**
- Indica etapa actual del proceso de generación
- Muestra porcentaje de completado
- Notifica cuando está listo para descarga

## 13. Procedimientos de Emergencia

### 13.1. Pérdida Total del Sistema
1. **Evaluación**: Determinar extensión del daño
2. **Comunicación**: Notificar a usuarios sobre situación
3. **Restauración**: Usar respaldo completo más reciente
4. **Verificación**: Confirmar integridad de datos restaurados
5. **Reanudación**: Reactivar servicios gradualmente
6. **Análisis**: Documentar causa y medidas preventivas

### 13.2. Corrupción de Datos
1. **Detección**: Identificar alcance de corrupción
2. **Aislamiento**: Detener operaciones afectadas
3. **Respaldo**: Generar respaldo del estado actual (si es posible)
4. **Restauración Selectiva**: Recuperar datos desde respaldo
5. **Validación**: Verificar consistencia de datos
6. **Reanudación**: Reactivar operaciones normales

### 13.3. Falla de Respaldos Automáticos
1. **Detección**: Monitorear alertas de respaldos fallidos
2. **Diagnóstico**: Identificar causa del fallo
3. **Respaldo Manual**: Generar respaldo inmediatamente
4. **Reparación**: Corregir configuración automática
5. **Prueba**: Verificar funcionamiento del sistema automático
6. **Documentación**: Registrar incidente y solución

## 14. Soporte y Contacto

Para soporte técnico o consultas sobre el uso del sistema, contacte a su administrador del sistema o al departamento de TI de su empresa.

**Características de Seguridad:**
- El sistema previene automáticamente la doble facturación
- Los estados se actualizan automáticamente al crear facturas
- Los filtros protegen contra errores de usuario
- La auditoría de cambios mantiene trazabilidad completa
- **Los respaldos están cifrados y protegidos con permisos de administrador**
- **Sistema de logging completo para auditoría de respaldos**

**Funcionalidades de Respaldo:**
- Respaldos automáticos programables (diario, semanal, mensual)
- Respaldos manuales instantáneos (completo y rápido)
- Historial completo de respaldos generados
- Verificación de integridad automática
- Descarga segura y cifrada de archivos

La documentación técnica completa está disponible para desarrolladores y administradores de sistema en los archivos de documentación del proyecto.

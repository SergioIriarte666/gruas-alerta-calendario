# Manual de Usuario - TMS Grúas

## Introducción

TMS Grúas es un sistema integral de gestión para empresas de servicios de grúas que permite administrar servicios, clientes, operadores, equipos y facturación de manera eficiente con funcionalidades avanzadas como inspecciones digitales, generación automática de PDFs, portal de clientes y **sistema de notificaciones push en tiempo real**.

## Roles de Usuario

### Administrador
- Acceso completo al sistema
- Gestión de usuarios y configuración
- Acceso a todos los módulos
- Gestión de invitaciones de usuarios
- Configuración de empresa y sistema
- **Configuración de notificaciones push**

### Operador
- Acceso al portal del operador
- Gestión de inspecciones con set fotográfico unificado
- Visualización de servicios asignados
- Generación de PDFs de inspección
- Firmas digitales
- **Notificaciones push de nuevos servicios asignados**

### Cliente
- Acceso al portal de clientes
- Visualización de servicios contratados
- Solicitud de nuevos servicios
- Descarga de facturas e inspecciones
- **Notificaciones push de servicios completados**

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

### 13. **Sistema de Notificaciones Push (NUEVO)**
**Ubicación**: Configuración > Notificaciones
**Función**: Sistema completo de notificaciones push en tiempo real

#### Configuración de Notificaciones Push
**Acceso**: Menú Configuración > Pestaña "Notificaciones"

##### Pasos para Habilitar Notificaciones Push:
1. **Acceder a Configuración**:
   - Ir a Configuración desde el menú principal
   - Seleccionar pestaña "Notificaciones"

2. **Solicitar Permisos**:
   - Click en "Solicitar Permisos de Notificación"
   - Autorizar notificaciones en el navegador
   - El estado cambiará a "Permitido"

3. **Habilitar Notificaciones Push**:
   - Una vez con permisos, click en "Habilitar"
   - El sistema se suscribirá automáticamente
   - Aparecerán las "Preferencias de Notificación"

4. **Configurar Preferencias**:
   - **Nuevos Servicios Asignados**: Para operadores
   - **Actualizaciones de Servicios**: Cambios de estado
   - **Inspecciones Completadas**: Cuando se completa una inspección
   - **Facturas Generadas**: Nuevas facturas (opcional)
   - **Alertas del Sistema**: Vencimientos importantes

#### Tipos de Notificaciones Push

##### Para Administradores:
- 📋 Nuevas solicitudes de servicio desde el portal
- ✅ Servicios completados por operadores
- 💰 Nuevas facturas generadas
- ⚠️ Alertas de vencimientos críticos

##### Para Operadores:
- 🚛 Nuevos servicios asignados
- 📝 Actualizaciones de estado en servicios
- 🔄 Cambios en programación

##### Para Clientes:
- 🎉 Servicios completados
- 📄 Facturas disponibles
- 📧 Inspecciones listas para descarga

#### Gestión de Notificaciones

##### Estados de Permisos:
- **Permitido** ✅: Notificaciones habilitadas
- **Denegado** ❌: Permisos bloqueados por el navegador
- **Pendiente** ⏳: Esperando autorización del usuario

##### Acciones Disponibles:
- **Habilitar/Deshabilitar**: Control total de suscripción
- **Configurar Preferencias**: Personalizar tipos de notificación
- **Reactivar**: En caso de pérdida de conexión

#### Compatibilidad y Requisitos
- **Navegadores Compatible**: Chrome, Firefox, Safari, Edge
- **Dispositivos**: Desktop, móvil, tablet
- **Conexión**: Requiere HTTPS (automático en producción)
- **Permisos**: Autorización del navegador necesaria

### 14. Calendario
**Ubicación**: Menú principal > Calendario
**Función**: Vista de calendario integrada con servicios

#### Funcionalidades del Calendario
- Vista por mes, semana y día
- Eventos integrados con servicios
- Filtros por tipo de evento
- Navegación intuitiva
- Integración con alertas de vencimientos

## Flujos de Trabajo Principales

### Flujo Completo de Servicio con Notificaciones
1. **Creación**: Cliente solicita servicio (portal o admin)
   - 🔔 **Notificación push** a administradores sobre nueva solicitud
2. **Planificación**: Asignación automática de recursos
3. **Notificación al Operador**: 
   - 🚛 **Notificación push** "Nuevo Servicio Asignado"
4. **Ejecución**: Operador realiza servicio e inspección completa
5. **Inspección Digital**: Set fotográfico + firmas + observaciones
6. **Documentación**: Generación automática de PDF
7. **Comunicación**: Envío automático por email
8. **Notificación de Completado**:
   - 🎉 **Notificación push** al cliente "Servicio Completado"
   - ✅ **Notificación push** al administrador
9. **Facturación**: Inclusión en cierre y factura
   - 💰 **Notificación push** "Nueva Factura Generada"
10. **Cobro**: Gestión de pagos y recordatorios

### Flujo de Notificaciones Push
1. **Configuración Inicial**:
   - Usuario habilita permisos en navegador
   - Sistema registra suscripción
   - Configuración de preferencias

2. **Activación Automática**:
   - Eventos del sistema disparan notificaciones
   - Filtrado según preferencias del usuario
   - Envío inmediato y registro en logs

3. **Interacción del Usuario**:
   - Click en notificación navega a sección relevante
   - Notificaciones desaparecen automáticamente
   - Historial disponible en logs del sistema

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

### Sistema de Notificaciones Push
- **Tecnología WebPush**: Estándar web para notificaciones
- **Service Workers**: Funcionamiento en segundo plano
- **Persistencia**: Notificaciones funcionan aunque la app esté cerrada
- **Tiempo Real**: Activación inmediata mediante Supabase Realtime
- **Filtrado Inteligente**: Según rol y preferencias del usuario

### Seguridad de Notificaciones
- **Suscripciones Únicas**: Una por usuario
- **Validación de Permisos**: Control a nivel de navegador
- **Logs Auditables**: Registro completo de envíos
- **Desactivación Segura**: Proceso controlado de desuscripción

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

## Funcionalidades PWA

### Capacidades Offline
- Cache inteligente de recursos
- Funcionamiento básico sin conexión
- Sincronización al recuperar conexión
- Instalación como aplicación nativa

### **Notificaciones Push Nativas**
- **Funcionamiento sin conexión**: Notificaciones llegan aunque la app esté cerrada
- **Integración con SO**: Aparecen en centro de notificaciones del dispositivo
- **Acciones rápidas**: Click para navegar directamente a la funcionalidad
- **Persistencia**: Se mantienen hasta ser leídas o descartadas

## Mejores Prácticas de Uso

### Para Administradores
- **Habilitar notificaciones push** para seguimiento en tiempo real
- Configurar todas las alertas críticas
- Revisar logs de notificaciones semanalmente
- Mantener actualizada la configuración de preferencias

### Para Operadores
- **Obligatorio habilitar notificaciones** para servicios asignados
- Mantener dispositivo con notificaciones activas
- Responder rápidamente a notificaciones de nuevos servicios
- Verificar completado de servicios para activar notificaciones a clientes

### Para Clientes
- Habilitar notificaciones para seguimiento de servicios
- Configurar preferencias según necesidades
- Utilizar notificaciones como recordatorio de facturas

## Solución de Problemas - Notificaciones Push

### Problemas Comunes

#### "No puedo habilitar notificaciones"
**Solución**:
1. Verificar que el navegador sea compatible
2. Asegurar conexión HTTPS
3. Limpiar cache del navegador
4. Revisar configuración de privacidad del navegador

#### "No recibo notificaciones"
**Solución**:
1. Verificar permisos en configuración del navegador
2. Revisar que las preferencias estén habilitadas
3. Comprobar que la suscripción esté activa
4. Reiniciar navegador y volver a suscribirse

#### "Notificaciones duplicadas"
**Solución**:
1. Deshabilitar y volver a habilitar notificaciones
2. Limpiar datos del sitio en el navegador
3. Contactar soporte técnico

### Limitaciones del Sistema
- Requiere navegador moderno con soporte WebPush
- Necesita permisos explícitos del usuario
- Funciona mejor en dispositivos con conexión estable
- Algunas funciones limitadas en modo incógnito

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

### Sistema de Notificaciones Push (v3.0)
- **Implementación completa** de notificaciones push nativas
- **Configuración granular** por tipo de evento
- **Integración con roles** para notificaciones específicas
- **Dashboard de preferencias** en configuración
- **Logs auditables** de todas las notificaciones
- **Compatibilidad PWA** para funcionamiento offline

### Set Fotográfico Unificado (v2.0)
- Migración de 3 sets independientes a 1 unificado
- 6 categorías específicas de fotos
- Interfaz por pestañas mejorada
- Validación simplificada (mínimo 1 foto)
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

## Cómo Usar el Sistema de Notificaciones Push

### 1. **Configuración Inicial (Administrador)**

**Ubicación**: Configuración > Pestaña "Notificaciones"

1. **Acceder a la configuración**:
   - Ve al menú principal > Configuración
   - Selecciona la pestaña "Notificaciones"

2. **Habilitar notificaciones**:
   - Click en "Solicitar Permisos de Notificación"
   - Autoriza en el popup del navegador
   - El estado cambiará a "Permitido" ✅

3. **Suscribirse**:
   - Click en "Habilitar" notificaciones push
   - El sistema te suscribirá automáticamente
   - Aparecerán las preferencias de notificación

### 2. **Configurar Preferencias**

Una vez suscrito, puedes personalizar qué notificaciones recibir:

- **Nuevos Servicios Asignados**: Para operadores cuando se les asigna trabajo
- **Actualizaciones de Servicios**: Cambios de estado en servicios
- **Inspecciones Completadas**: Cuando se completa una inspección
- **Facturas Generadas**: Nuevas facturas (opcional)
- **Alertas del Sistema**: Vencimientos y eventos críticos

### 3. **Funcionamiento Automático por Rol**

#### **Administradores reciben**:
- 📋 Nuevas solicitudes de servicio desde el portal
- ✅ Servicios completados por operadores  
- 💰 Facturas generadas automáticamente
- ⚠️ Alertas de vencimientos críticos

#### **Operadores reciben**:
- 🚛 **Nuevos servicios asignados** (crítico - aparece inmediatamente)
- 📝 Actualizaciones de estado en sus servicios
- 🔄 Cambios en la programación

#### **Clientes reciben**:
- 🎉 **Servicios completados** 
- 📄 Facturas disponibles para descarga
- 📧 Inspecciones listas

### 4. **Interacción con Notificaciones**

- **Click en la notificación**: Te lleva directamente a la sección relevante
- **Ignorar**: La notificación desaparece automáticamente
- **Navegación inteligente**: 
  - Operadores van a su dashboard
  - Administradores van a la sección correspondiente
  - Clientes van a su portal

### 5. **Requisitos Técnicos**

- **Navegador compatible**: Chrome, Firefox, Safari moderno, Edge
- **Conexión HTTPS**: Automática en producción
- **Permisos del navegador**: Debes autorizar explícitamente
- **Service Worker**: Se instala automáticamente

### 6. **Resolución de Problemas**

**Si no recibes notificaciones**:
1. Verifica permisos en configuración del navegador
2. Comprueba que la suscripción esté activa (pestaña Notificaciones)
3. Reinicia el navegador
4. Deshabilita y vuelve a habilitar notificaciones

**Si aparece "No compatible"**:
- Actualiza tu navegador
- Verifica que estés en HTTPS
- Prueba con otro navegador compatible

### 7. **Beneficios del Sistema**

- **Tiempo real**: Las notificaciones llegan instantáneamente
- **Funciona sin la app abierta**: Recibes notificaciones aunque no tengas el sistema abierto
- **Específico por rol**: Solo recibes lo que es relevante para ti
- **Integración nativa**: Se ve como cualquier otra notificación de tu dispositivo
- **Navegación directa**: Click para ir directo a la funcionalidad

El sistema está completamente integrado y **no afecta ninguna funcionalidad existente** - simplemente añade esta nueva capacidad de notificaciones push en tiempo real para mejorar la comunicación y eficiencia del equipo.

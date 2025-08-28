# Guía de Administrador del Sistema TMS Grúas v2.2.0

## Administración del Sistema

### Sistema de Backup y Restauración

#### Configuración de Respaldos Automáticos
- **Ubicación**: Configuraciones → Configuraciones del Sistema
- **Frecuencia**: Diaria, semanal o mensual
- **Retención**: Configurable por el administrador
- **Ubicación de Almacenamiento**: Automáticamente en Supabase Storage

#### Proceso de Backup
1. Los respaldos se ejecutan automáticamente según la configuración
2. Se respaldan todas las tablas críticas del sistema
3. Se genera un archivo comprimido con timestamp
4. Se almacena en el bucket de storage configurado
5. Se registra en los logs de backup para auditoría

#### Restauración de Datos
1. Acceder a **Configuraciones → Backup y Restauración**
2. Seleccionar el respaldo deseado de la lista
3. Confirmar la operación de restauración
4. El sistema restaurará automáticamente los datos
5. Se generará un log de la operación

### Gestión de Usuarios y Permisos

#### Roles Disponibles
- **Admin**: Acceso completo al sistema
- **Operator**: Acceso a operaciones diarias
- **Client**: Acceso limitado al portal de cliente
- **Viewer**: Solo lectura

#### Invitación de Usuarios
1. Ir a **Configuraciones → Gestión de Usuarios**
2. Hacer clic en "Invitar Usuario"
3. Completar email y seleccionar rol
4. El sistema enviará automáticamente una invitación por email
5. El usuario recibirá un enlace para completar el registro

### Monitoreo del Sistema

#### Logs de Auditoría
- **Ubicación**: Dashboard → Logs del Sistema
- **Información Registrada**:
  - Todas las operaciones CRUD
  - Cambios en configuraciones críticas
  - Accesos al sistema
  - Errores y excepciones

#### Métricas del Dashboard
- **Servicios Activos**: Servicios en progreso o pendientes
- **Alertas de Vencimientos**: Documentos próximos a vencer
- **Facturas Vencidas**: Estado de cobranza
- **Stock Bajo**: Alertas de inventario
- **Servicios Sin Cerrar**: Servicios completados sin cierre financiero

### Seguridad del Sistema

#### Configuraciones de Seguridad
- **Autenticación de Doble Factor**: Disponible para administradores
- **Políticas de Contraseñas**: Configurables por el administrador
- **Sesiones**: Tiempo de expiración configurable
- **Acceso API**: Control de acceso a funciones del sistema

#### Respaldo de Seguridad
- Todas las funciones críticas requieren confirmación
- Log de auditoría para todas las operaciones administrativas
- Backup automático antes de operaciones críticas
- Cifrado de datos sensibles

## Configuraciones Avanzadas

### Integración Inventario-Grúas

#### Configuración del Flujo Automático
1. **Activar Sincronización**: Configuraciones → Integración → Inventario-Grúas
2. **Configurar Categorías**: Mapear categorías de inventario con tipos de gastos
3. **Establecer Ubicaciones**: Definir ubicaciones por defecto para movimientos automáticos
4. **Configurar Precios**: Método de cálculo de precios (FIFO, Promedio Ponderado, etc.)

#### Prevención de Duplicados
- El sistema previene automáticamente la creación de registros duplicados
- Validación cruzada entre inventario y gastos de grúas
- Alertas para resolución de conflictos

### Gestión de Proveedores

#### Configuración Inicial
1. **Crear Proveedores**: Configuraciones → Proveedores
2. **Configurar Categorías**: Categorizar por tipo de suministro
3. **Establecer Términos de Pago**: Configurar días de pago por proveedor
4. **Integrar con Costos**: Activar creación automática de costos

#### Flujo de Pagos
1. Registro de factura de proveedor
2. Validación y aprobación
3. Programación de pago
4. Ejecución de pago
5. Registro automático en costos

## Mantenimiento del Sistema

### Rutinas de Mantenimiento

#### Diarias
- Verificación de backup automático
- Revisión de logs de error
- Monitoreo de performance

#### Semanales
- Limpieza de logs antiguos
- Verificación de integridad de datos
- Actualización de métricas del dashboard

#### Mensuales
- Análisis de uso del sistema
- Optimización de base de datos
- Revisión de configuraciones de seguridad

### Resolución de Problemas Comunes

#### Problema: Servicios sin sincronizar con inventario
**Solución**:
1. Ir a Herramientas → Sincronización
2. Ejecutar "Sincronizar Inventario-Grúas"
3. Revisar log de sincronización

#### Problema: Duplicados en costos
**Solución**:
1. Ejecutar función `resolve_commission_conflicts`
2. Usar herramienta de limpieza de duplicados
3. Revisar configuración de triggers

#### Problema: Facturas con inconsistencias de pago
**Solución**:
1. Ejecutar `fix_invoice_payment_inconsistencies()`
2. Verificar aplicaciones de pago
3. Revisar reconciliación de pagos

## Configuración PWA

### Instalación y Configuración
1. El sistema genera automáticamente el manifest PWA
2. Service Worker se actualiza automáticamente
3. Los usuarios pueden instalar desde cualquier navegador moderno

### Funcionalidades Offline
- Visualización de datos descargados
- Registro de entradas rápidas sin conexión
- Sincronización automática al recuperar conexión

### Notificaciones Push
1. **Configurar**: Configuraciones → Notificaciones
2. **Activar por Usuario**: Cada usuario puede gestionar sus notificaciones
3. **Tipos de Notificación**:
   - Vencimiento de documentos
   - Facturas vencidas
   - Alertas de stock
   - Recordatorios de mantenimiento

## Contacto y Soporte

### Soporte Técnico
- **Email**: admin@tmsgruas.cl
- **Documentación**: Esta guía y manual de usuario
- **Logs del Sistema**: Disponibles en el dashboard administrativo

### Actualizaciones del Sistema
- Las actualizaciones se despliegan automáticamente
- Los usuarios serán notificados de nuevas funcionalidades
- Los cambios críticos requerirán confirmación administrativa
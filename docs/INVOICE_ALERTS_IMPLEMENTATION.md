# Sistema de Alertas para Facturas Vencidas

## Resumen
Se ha implementado un sistema completo de alertas para facturas vencidas que detecta automáticamente facturas que han pasado su fecha de vencimiento y las marca como `overdue`, además de generar notificaciones visibles para los usuarios.

## Componentes Implementados

### 1. Funciones de Base de Datos

#### `update_overdue_invoices()`
- **Propósito**: Actualiza automáticamente facturas vencidas
- **Funcionamiento**: Cambia el status de `sent` o `draft` a `overdue` para facturas que han pasado su fecha de vencimiento
- **Seguridad**: SECURITY DEFINER con search_path fijo

#### `get_overdue_invoices_for_alerts()`
- **Propósito**: Obtiene todas las facturas que deberían estar vencidas para generar alertas
- **Retorna**: Tabla con datos completos incluyendo días de vencimiento y nombre del cliente
- **Ventaja**: Detecta facturas vencidas incluso si no tienen el status correcto

#### `fix_existing_overdue_invoices()`
- **Propósito**: Función administrativa para corregir facturas vencidas existentes
- **Restricción**: Solo accesible por administradores
- **Uso**: Ejecutar una vez para corregir datos históricos

### 2. Trigger Automático

#### `check_and_update_overdue_invoices()`
- **Activación**: BEFORE INSERT OR UPDATE en tabla `invoices`
- **Funciones**:
  - Ejecuta actualización global de facturas vencidas
  - Verifica y corrige la factura actual si está vencida
- **Beneficio**: Mantiene los datos actualizados en tiempo real

### 3. Sistema de Notificaciones Mejorado

#### Actualización en `useNotificationsData.ts`
- **Cambio**: Reemplazó consulta directa por llamada a función RPC
- **Mejoras**:
  - Detecta facturas vencidas automáticamente
  - Muestra días de vencimiento específicos
  - Incluye información del total de la factura
  - Manejo robusto de errores

## Flujo de Funcionamiento

1. **Actualización Automática**:
   - Cada vez que se inserta/actualiza una factura, el trigger ejecuta la verificación
   - Se actualizan todas las facturas vencidas del sistema
   - La factura actual se corrige si es necesario

2. **Generación de Alertas**:
   - El sistema de notificaciones usa `get_overdue_invoices_for_alerts()`
   - Se generan alertas con información detallada
   - Las alertas son de tipo `error` (críticas)

3. **Corrección de Datos Históricos**:
   - Los administradores pueden ejecutar `fix_existing_overdue_invoices()`
   - Corrige facturas que no fueron detectadas anteriormente

## Ejemplo de Uso

### Para corregir facturas vencidas existentes:
```sql
SELECT fix_existing_overdue_invoices();
```

### Para verificar facturas vencidas manualmente:
```sql
SELECT * FROM get_overdue_invoices_for_alerts();
```

## Beneficios de la Implementación

1. **Automatización Completa**: No requiere intervención manual
2. **Detección Inteligente**: Encuentra facturas vencidas independiente del status
3. **Información Rica**: Muestra días de vencimiento y totales
4. **Mantenimiento Automático**: Los datos se mantienen actualizados
5. **Corrección Histórica**: Puede arreglar datos existentes

## Consideraciones de Seguridad

- Todas las funciones usan `SECURITY DEFINER` con `search_path` fijo
- Solo administradores pueden ejecutar funciones de corrección
- El trigger es eficiente y no afecta el rendimiento

## Mejoras Implementadas - Sistema Automático 2025-07-28

### 1. Trigger Automático Reactivado
- **Función**: `check_and_update_overdue_invoices()`
- **Activación**: BEFORE INSERT OR UPDATE en tabla `invoices`
- **Beneficio**: Actualiza facturas vencidas automáticamente sin intervención manual

### 2. Función de Corrección Manual Mejorada
- **Función**: `fix_existing_overdue_invoices()`
- **Mejora**: Ahora retorna mensaje con cantidad de facturas actualizadas
- **Acceso**: Solo administradores

### 3. Estadísticas en Tiempo Real
- **Función**: `get_invoice_overdue_stats()`
- **Propósito**: Obtener métricas detalladas de facturas vencidas
- **Datos**: Total, monto, promedio días vencidos, más antigua

### 4. Sistema de Alertas Robusto
- **Función mejorada**: `get_overdue_invoices_for_alerts()`
- **Ventaja**: Detecta facturas vencidas por fecha, no solo por status
- **Seguridad**: Ejecuta actualización automática antes de consultar

## Sistema de Notificaciones y Alertas Completo - 2025-08-06

### 1. Base de Datos y Funciones RPC

#### Nueva Tabla: `invoice_alert_settings`
- **Propósito**: Configuración personalizada de alertas por usuario
- **Campos**: 
  - `overdue_alerts_enabled`: Habilitar alertas de facturas vencidas
  - `due_soon_alerts_enabled`: Habilitar alertas de vencimiento próximo
  - `due_soon_days`: Días de anticipación para alertas
  - `email_notifications`: Habilitar notificaciones por email
  - `push_notifications`: Habilitar notificaciones push

#### Nueva Función: `get_invoices_due_soon(days_ahead)`
- **Propósito**: Obtener facturas próximas a vencer con información detallada
- **Retorna**: Tabla con información completa del cliente y días hasta vencimiento
- **Parámetro**: Días de anticipación (por defecto 7)

### 2. Frontend - Componentes y Hooks

#### Hook: `useInvoiceAlerts`
- **Archivo**: `src/hooks/useInvoiceAlerts.ts`
- **Funcionalidades**:
  - Consulta automática de facturas vencidas y próximas a vencer
  - Gestión de configuración de alertas por usuario
  - Actualización forzada de estados de facturas
  - Refrescado automático cada 5 minutos (vencidas) y cada hora (próximas)

#### Componente: `InvoiceAlertSettings`
- **Archivo**: `src/components/invoices/InvoiceAlertSettings.tsx`
- **Características**:
  - Configuración personalizable de tipos de alertas
  - Control de días de anticipación para alertas
  - Selección de canales de notificación (push/email)
  - Botón de actualización manual de estados

#### Componente: `InvoiceAlertsDashboard`
- **Archivo**: `src/components/invoices/InvoiceAlertsDashboard.tsx`
- **Características**:
  - Cards de resumen con métricas clave
  - Listado de facturas vencidas con navegación directa
  - Listado de facturas próximas a vencer
  - Enlaces directos a filtros específicos en módulo de facturas

### 3. Integración en la Aplicación

#### Dashboard Principal (`src/pages/Dashboard.tsx`)
- **Integración**: Dashboard de alertas como sección destacada
- **Ubicación**: Antes del grid principal de contenido
- **Beneficio**: Visibilidad inmediata de problemas críticos

#### Módulo de Facturas (`src/pages/Invoices.tsx`)
- **Nueva Pestaña**: "Alertas" en el sistema de tabs
- **Contenido**: Dashboard completo de alertas de facturas
- **Navegación**: Integrada con filtros existentes

#### Configuraciones (`src/pages/Settings.tsx`)
- **Ubicación**: Pestaña "Notificaciones"
- **Funcionalidad**: Configuración completa de alertas
- **Persistencia**: Configuración por usuario en base de datos

### 4. Sistema de Notificaciones Mejorado

#### Actualización en `useNotificationsData.ts`
- **Funciones RPC**: Uso de `get_overdue_invoices_for_alerts` y `get_invoices_due_soon`
- **Detección Inteligente**: Identificación automática por fecha, no solo por status
- **Información Rica**: Días de vencimiento, montos, nombres de clientes
- **Niveles de Urgencia**: Error para muy críticas, warning para importantes

### 5. Tipos TypeScript Actualizados

#### Nuevas Interfaces en `src/types/notifications.ts`
- `InvoiceAlertSettings`: Configuración de alertas
- `OverdueInvoice`: Facturas vencidas con datos completos
- `InvoiceDueSoon`: Facturas próximas a vencer con información detallada

## Archivos de Migración

- Implementación original: `supabase/migrations/20250124_173824_overdue_invoice_alerts.sql`
- Mejoras del sistema: `supabase/migrations/20250725_*_improved_overdue_invoice_system.sql`
- Sistema completo de alertas: `supabase/migrations/20250806_*_invoice_alerts_system.sql`

## Flujo Completo de Alertas

1. **Detección Automática**: Trigger y funciones RPC actualizan estados automáticamente
2. **Configuración Personal**: Usuarios configuran preferencias en Settings
3. **Visualización Dashboard**: Alertas visibles en dashboard principal
4. **Gestión Específica**: Módulo dedicado en sección de Facturas
5. **Notificaciones Activas**: Sistema de notificaciones integrado con alertas
6. **Navegación Inteligente**: Enlaces directos a facturas específicas con filtros

## Beneficios del Sistema Completo

1. **Prevención Proactiva**: Alertas antes del vencimiento
2. **Configuración Flexible**: Cada usuario define sus preferencias
3. **Visibilidad Centralizada**: Dashboard unificado de alertas críticas
4. **Navegación Eficiente**: Acceso directo a facturas problemáticas
5. **Automatización Total**: Sin intervención manual necesaria
6. **Escalabilidad**: Sistema preparado para notificaciones por email/push futuras
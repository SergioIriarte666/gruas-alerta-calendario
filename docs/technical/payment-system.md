# Sistema de Pagos

## Funcionalidades Principales
- Conciliación automática de pagos con facturas
- Validación de integridad del sistema
- Corrección automática de inconsistencias
- Triggers para mantener consistencia en tiempo real

## Triggers Activos Críticos

### 1. `maintain_payment_consistency_trigger`
- **Tabla**: `payment_applications`
- **Eventos**: INSERT, UPDATE, DELETE
- **Función**: Actualiza automáticamente el estado y montos del pago cuando se crea/modifica/elimina una aplicación
- **Campos actualizados**: `applied_amount`, `status`, `updated_at`

### 2. `payment_applications_auto_update_invoice_status`
- **Tabla**: `payment_applications`
- **Eventos**: INSERT, UPDATE, DELETE
- **Función**: Actualiza automáticamente el estado y monto pagado de la factura
- **Campos actualizados**: `paid_amount`, `status`, `updated_at`

## Funciones de Administrador
- **Corregir Inconsistencias**: `fix_existing_payment_inconsistencies()` y `fix_existing_invoice_inconsistencies()` recalculan montos y estados
- **Validar Sistema**: Detecta y reporta problemas de integridad
- **Pagos Automáticos**: Genera pagos para facturas según reglas de negocio

## Estados de Factura
- **Borrador**: En construcción
- **Enviada**: Emitida al cliente  
- **Parcial**: Pagada parcialmente
- **Pagada**: Saldada completamente
- **Vencida**: Fuera de plazo

## Validaciones Implementadas
- Prevención de pagos duplicados
- Verificación de montos aplicados
- Consistencia entre paid_amount y remaining_amount
- Integridad referencial con aplicaciones de pago

## Interface de Usuario
- Botones de corrección en panel de administración
- Reportes de validación con detalles de inconsistencias
- Feedback visual de operaciones exitosas
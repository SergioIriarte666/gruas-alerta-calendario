

## Problema Identificado

Hay **dos triggers en la base de datos** que fuerzan cambios de estado incorrectos en los servicios:

### Trigger 1: `auto_update_service_invoice_status`
- Si se quita `invoice_folio` → fuerza el estado a `completed`
- **Problema**: Un servicio `quoted` sin `invoice_folio` es válido, pero el trigger lo revierte a `completed`

### Trigger 2: `validate_service_invoice_consistency`  
- Si no hay `invoice_folio` y el estado es `invoiced` → fuerza a `completed`
- Si hay `invoice_folio` y el estado NO es `invoiced` → fuerza a `invoiced`
- **Problema**: No contempla los estados intermedios del flujo VIP (`quoted`, `purchase_order_pending`, `with_purchase_order`). Un servicio con `invoice_folio` en estado `quoted` sería forzado a `invoiced`.

### Solución

Crear una migración SQL que actualice ambas funciones de trigger para respetar los estados del flujo post-servicio:

1. **`auto_update_service_invoice_status`**: Solo revertir a `completed` cuando el estado actual ES `invoiced` y se quita el folio. No tocar otros estados como `quoted`, `purchase_order_pending`, `with_purchase_order`.

2. **`validate_service_invoice_consistency`**: 
   - Permitir que servicios con `invoice_folio` estén en estados post-servicio válidos (`quoted`, `purchase_order_pending`, `with_purchase_order`, `invoiced`, `completed`, `failed`)
   - Solo auto-corregir a `completed` si el estado es `invoiced` y no hay folio (no si es `quoted`, etc.)

### Cambios

- **1 migración SQL** que redefine ambas funciones (`auto_update_service_invoice_status` y `validate_service_invoice_consistency`) con la lógica corregida que respeta los estados del flujo VIP.


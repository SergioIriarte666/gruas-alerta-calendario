

# Plan: Mostrar usuario en movimientos de bodega del reporte de grúas

## Problema
El campo "Usuario" aparece como "-" porque los movimientos de inventario creados automáticamente (importación XML, consumo inmediato desde costos) no asignan `created_by` al insertar. Solo 4 de 66 salidas tienen usuario registrado.

## Solución

### 1. `src/services/UnifiedPurchaseService.ts`
- En las funciones que crean movimientos de entrada y salida, obtener el usuario actual con `supabase.auth.getUser()` y agregar `created_by: user?.id` al payload de insert.
- Aplica tanto para `createExitMovementAndCranePart` como para los inserts de movimientos de entrada.

### 2. `src/components/inventory/XMLInventoryUpload.tsx`
- En la función de importación que crea movimientos (entrada y salida), agregar `created_by: user?.id` al payload. El usuario ya se obtiene al inicio del proceso de importación.

### 3. `src/hooks/useInventory.ts`
- En la función `createMovement`, verificar que `created_by` se esté incluyendo en el insert (probablemente ya lo hace, pero confirmar).

### 4. Datos históricos (SQL)
- Ejecutar un UPDATE para asignar `created_by` a los movimientos históricos que tengan `created_by IS NULL`, usando el usuario del costo vinculado (`costs.created_by`) o un usuario por defecto.

## Archivos a modificar
- `src/services/UnifiedPurchaseService.ts`
- `src/components/inventory/XMLInventoryUpload.tsx`
- `src/hooks/useInventory.ts` (verificar)

## Lo que NO se toca
- Lógica de sincronización existente
- Reportes, UI de bodega, hooks de grúas


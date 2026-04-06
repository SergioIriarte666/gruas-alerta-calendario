
# Plan: Agregar campo "Realizado por" en mantenimiento (modal + tarjetas + informe)

## Problema
El modal de mantenimiento y las tarjetas no muestran quién realizó/registró la mantención. El informe PDF ya tiene la columna "Usuario" pero depende de que el dato llegue correctamente.

## Cambios

### 1. `src/hooks/useCraneMaintenance.ts`
- Modificar `CRANE_MAINTENANCE_SELECT` para incluir join con profiles: agregar `creator:profiles!crane_maintenance_created_by_fkey(id, full_name, email)`.
- Agregar `createdBy` y `creatorName` al interface `MaintenanceRecord`.
- Mapear `record.created_by` y `record.creator?.full_name || record.creator?.email` en el return.

### 2. `src/components/cranes/CraneMaintenance.tsx`
- En cada tarjeta de mantenimiento, agregar una línea con icono `User` mostrando el nombre del creador (similar a como se muestra el proveedor).

### 3. `src/components/cranes/forms/MaintenanceForm.tsx`
- En modo edición, mostrar un campo de solo lectura "Realizado por" con el nombre del creador del registro (usando `editingRecord.creatorName`).
- En modo creación, mostrar el nombre del usuario actual (ya se obtiene auth en el componente).

## Archivos a modificar
- `src/hooks/useCraneMaintenance.ts`
- `src/components/cranes/CraneMaintenance.tsx`
- `src/components/cranes/forms/MaintenanceForm.tsx`

## Lo que NO se toca
- Lógica de creación/actualización/eliminación
- Informe PDF (ya tiene la columna Usuario)
- Otros módulos

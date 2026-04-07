

# Plan: Agregar campo "Realizado por" en mantenimiento

## Problema
El formulario de mantenimiento no tiene un campo para indicar quién realizó físicamente la mantención (distinto de quién la registró en el sistema). El informe PDF tampoco lo muestra.

## Cambios

### 1. Migración SQL: agregar columna `performed_by`
- `ALTER TABLE crane_maintenance ADD COLUMN performed_by TEXT;`
- Campo de texto libre (no vinculado a users, ya que puede ser un técnico externo).

### 2. `src/hooks/useCraneMaintenance.ts`
- Agregar `performed_by` al `CRANE_MAINTENANCE_SELECT`.
- Agregar `performedBy` al tipo `MaintenanceRecord`.
- Mapear en las queries de lectura, creación y actualización.

### 3. `src/components/cranes/forms/MaintenanceForm.tsx`
- Agregar campo `performed_by` al `FormData`.
- Agregar input de texto "Realizado por" con icono `User` en la fila de Costo/Kilometraje/Proveedor (convertir a grid de 4 columnas o agregar nueva fila).
- Incluirlo en `onSubmit` para creación y actualización.
- Pre-llenar en modo edición.

### 4. `src/components/cranes/CraneMaintenance.tsx`
- Mostrar "Realizado por: {record.performedBy}" en las tarjetas, junto a "Registrado por".

### 5. `src/components/cranes/CraneInventoryTab.tsx` (informe PDF)
- En la sección "Movimientos de Mantenciones" (~línea 427-438), agregar columna "Realizado por" usando `m.performed_by`.
- Ajustar anchos de columnas para acomodar la nueva columna.

## Archivos a modificar
- Nueva migración SQL
- `src/hooks/useCraneMaintenance.ts`
- `src/components/cranes/forms/MaintenanceForm.tsx`
- `src/components/cranes/CraneMaintenance.tsx`
- `src/components/cranes/CraneInventoryTab.tsx`


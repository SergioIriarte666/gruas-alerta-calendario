
# Plan: Corregir error FK en servicios tercerizados

## Problema
El campo `services.outsourced_provider_id` tiene una FK que apunta a la tabla `suppliers`, pero el selector `SupplierCombobox` obtiene los proveedores de la tabla `inventory_suppliers`. Son tablas distintas con IDs distintos, por lo que al guardar un servicio tercerizado se viola la FK.

## Solución
Cambiar la FK para que apunte a `inventory_suppliers` en lugar de `suppliers`, ya que `inventory_suppliers` es la tabla que el sistema usa activamente para la gestión de proveedores.

## Cambios

### 1. Migración SQL
- `ALTER TABLE services DROP CONSTRAINT services_outsourced_provider_id_fkey;`
- `ALTER TABLE services ADD CONSTRAINT services_outsourced_provider_id_fkey FOREIGN KEY (outsourced_provider_id) REFERENCES inventory_suppliers(id) ON DELETE SET NULL;`

### 2. `src/integrations/supabase/types.ts`
- Actualizar la referencia de la FK de `suppliers` a `inventory_suppliers` en el tipo generado.

## Archivos a modificar
- Nueva migración SQL
- `src/integrations/supabase/types.ts`

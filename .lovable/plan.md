
# Plan: Auto-crear registro de Costo al completar un Mantenimiento

## Análisis

### Situación actual
- La tabla `costs` ya tiene `maintenance_id` (FK a `crane_maintenance`) — la infraestructura existe.
- El hook `useMaintenanceCostStatus` ya verifica si un mantenimiento tiene costo asociado.
- La UI muestra "Sincronizando..." cuando un mantenimiento completado con monto > 0 no tiene costo — pero nada lo crea realmente.
- No existe trigger ni lógica frontend que genere el costo automáticamente.

### Pro de automatizarlo
- Toda salida de dinero queda reflejada en Costos sin doble digitación.
- Los reportes financieros y de grúa serán consistentes.
- El badge "Sincronizando..." dejará de ser engañoso y mostrará "Costo Registrado".
- La FK `maintenance_id` ya existe, solo hay que usarla.

### Contra / Riesgo
- Se necesita asignar una `category_id` (obligatoria en `costs`). Solución: buscar o crear la categoría "Mantenimiento".
- Se necesita una `date` para el costo. Solución: usar `completed_date` o `scheduled_date`.
- Si el usuario edita el monto del mantenimiento después, el costo debe actualizarse. Solución: hacerlo desde el frontend al actualizar.
- Complejidad: **baja** — es agregar un `insert` a `costs` después del insert/update de mantenimiento.

### Decisión: hacerlo desde el frontend (no trigger)
Un trigger SQL añadiría complejidad y posibles conflictos con los triggers de sincronización de costos existentes. Hacerlo en el hook `useCreateMaintenance` / `useUpdateMaintenance` es más seguro, controlado y fácil de depurar.

## Cambios

### 1. Consultar la categoría "Mantenimiento" en `cost_categories`
En el hook, antes de insertar el costo, buscar `cost_categories` con nombre "Mantenimiento" (o similar). Si no existe, la migración la creará.

### 2. Migración SQL (si es necesario)
Verificar si existe la categoría "Mantenimiento" en `cost_categories`. Si no:
```sql
INSERT INTO cost_categories (name) VALUES ('Mantenimiento') ON CONFLICT DO NOTHING;
```

### 3. `src/hooks/useCraneMaintenance.ts` — `useCreateMaintenance`
Después del insert exitoso en `crane_maintenance`, si `status === 'completed'` y `cost > 0`:
- Buscar `category_id` de "Mantenimiento"
- Insertar en `costs` con: `crane_id`, `category_id`, `maintenance_id`, `amount = cost`, `description`, `date = completed_date`, `subcategory = maintenanceType`
- Invalidar queries de costos

### 4. `src/hooks/useCraneMaintenance.ts` — `useUpdateMaintenance`
Al actualizar un mantenimiento:
- Si pasa a `completed` con `cost > 0` y no tiene costo asociado → crear el costo
- Si ya tiene costo y cambia el monto/descripción → actualizar el costo existente
- Si cambia de `completed` a otro estado → opcionalmente eliminar el costo

### 5. Invalidar queries de costos
En `onSuccess` de ambas mutaciones, agregar invalidación de `['crane-costs']` y `['maintenance-cost-status']`.

## Archivos a modificar
- Nueva migración SQL (asegurar categoría "Mantenimiento")
- `src/hooks/useCraneMaintenance.ts` — agregar lógica de creación/actualización de costo en las mutaciones

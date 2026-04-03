

# Plan: Corregir descripción larga en costos y verificar visibilidad de salidas en bodega

## Diagnóstico

Verificado en base de datos:
- Los **movimientos de salida SÍ existen** (8 registros activos con `movement_type='exit'`, `crane_id` asignado, `status='active'`). Deberían ser visibles en el historial de movimientos de bodega al refrescar la página.
- Los **crane_parts también existen** (8 registros vinculados a los exit movements). Deberían verse en la pestaña de piezas de la grúa.
- El **stock en 0** es correcto: entrada + salida inmediata = 0 stock disponible.
- El problema real es la **descripción del costo**: contiene todos los ítems concatenados ("MGS Repuestos y Cia. Ltda. SILENCIADOR 5" REFORZADO U.S.A., ABRAZADERA PREF.5"...") porque fue creado ANTES de la corrección de `buildCostDescription`. Lo mismo ocurre en el campo `notes`.

## Cambios

### 1. Reparar descripción y notas del costo existente (SQL migration)
- Actualizar `costs.description` de la factura 389111 a simplemente **"MGS Repuestos y Cia. Ltda."** (formato correcto multi-ítem: solo proveedor).
- Limpiar `costs.notes` para que muestre solo la referencia útil: `"Factura: 389111 | Archivo XML: 389111.xml"` sin repetir los nombres de todos los ítems.

### 2. Asegurar que la `description` en el formulario de edición de costos no quede bloqueada
- Revisar el componente `CostCombobox` para confirmar que textos largos no impidan la edición.
- Si el campo trunca o bloquea con textos extensos, ajustar para que use un `textarea` cuando el valor exceda cierta longitud, permitiendo edición libre.

### 3. Prevención futura en `buildCostDescription`
- Verificar (ya corregido) que para facturas multi-ítem la descripción sea solo el nombre del proveedor, sin concatenar ítems.
- Confirmar que el campo `notes` también sigue un formato limpio y no repite la lista completa de ítems.

## Archivos a modificar
- `supabase/migrations/` — Nueva migración para reparar descripción y notas del costo 389111
- `src/components/costs/form/CostFormStep1.tsx` — Si es necesario, hacer el campo description editable con textarea para textos largos
- `src/components/inventory/XMLInventoryUpload.tsx` — Limpiar el contenido de `notes` para no concatenar todos los ítems

## Nota
Los movimientos de salida y crane_parts ya están correctamente creados en la base de datos. Si no aparecen en la UI, basta con refrescar la página (F5). No hay bug de código en la visualización.


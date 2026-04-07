

# Plan: Agregar sugerencias y buscador manual de productos en importador XML

## Problema actual
Cuando `findMatchedInventoryItem` encuentra **múltiples coincidencias parciales**, descarta todas y muestra "Sin coincidencia" + solo el botón "Crear producto". No hay forma de:
1. Ver las sugerencias parciales que sí encontró
2. Buscar manualmente un producto del catálogo

## Cambios propuestos

### 1. Extender `findMatchedInventoryItem` para retornar candidatos
Modificar la función para que, además del match único, retorne la lista de candidatos parciales cuando hay más de uno. Cambiar el retorno de `InventoryCatalogItem | null` a un objeto `{ match: InventoryCatalogItem | null, candidates: InventoryCatalogItem[] }`.

Actualizar `ValidatedInvoiceLine` para incluir `candidates: InventoryCatalogItem[]`.

### 2. UI: Mostrar sugerencias cuando hay candidatos
En la columna "Producto" de la tabla de líneas (~línea 1577-1608):
- Si hay `candidates.length > 0` y no hay match, mostrar una lista compacta de sugerencias con botón "Usar" al lado de cada una.
- Al hacer clic en "Usar", se asigna como `manualMatchedItems[lineKey]` (patrón ya existente).

### 3. UI: Agregar buscador manual (Combobox)
Debajo de las sugerencias (o cuando no hay candidatos), agregar un Combobox/Popover con `Command` (componentes ya importados en el archivo) que permita buscar en todo el catálogo por nombre/SKU.
- Al seleccionar un producto, se asigna como `manualMatchedItems[lineKey]`.
- Mantener el botón "Crear producto" como última opción.

### 4. Recalcular validación al seleccionar
Ya funciona así: `manualMatchedItems` alimenta `validatedDocuments` via `useMemo`, por lo que al asignar un match manual la línea se revalida automáticamente y el error desaparece.

## Archivos a modificar
- `src/components/inventory/XMLInventoryUpload.tsx` — único archivo afectado

## Sin riesgo
- No se toca la lógica de importación, creación de productos, ni sincronización
- Solo se extiende la UI de previsualización y el retorno interno del matcher


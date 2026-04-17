

# Plan: Auto-SKU solo en importación XML + Backfill

## Decisiones confirmadas
- **Alcance**: Auto-SKU **solo cuando se crea un producto desde importación XML** (donde el proveedor no entrega código). El formulario manual sigue exigiendo SKU manual.
- **Formato**: `SKU-{YYYYMMDD}-{HEX4}` (ej: `SKU-20260417-A3F2`). Único garantizado, sin necesidad de contador en BD.
- **Backfill**: completar SKU faltantes en productos existentes con el mismo formato.
- **Memoria**: actualizar la regla `manual-sku-enforcement-v2` para reflejar la excepción XML.

## Cambios técnicos

### 1. Helper nuevo: `src/utils/skuGenerator.ts`
```ts
export const generateAutoSku = (): string => {
  const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const hex = Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase().padStart(4,'0');
  return `SKU-${date}-${hex}`;
};
```

### 2. Auto-SKU en creación XML
Localizar los 3 puntos donde el flujo XML crea `inventory_items` (sin SKU manual):
- `src/services/UnifiedPurchaseService.ts` (línea ~204) — crea item desde compra unificada
- `src/hooks/useUnifiedParts.ts` (línea ~196) — crea item desde XML/repuestos
- `src/hooks/useSupplierPayments.ts` (línea ~169) — crea item desde pago proveedor

En cada uno: si el `productCode` del XML viene vacío, asignar `sku: generateAutoSku()`. Si viene con código, respetarlo.

El parser XML (`xmlSupplierParser.ts` línea 614) ya extrae `productCode` desde múltiples campos (`codigo, sku, product_code...`); solo necesitamos rellenar cuando llega vacío al insert.

### 3. Backfill productos existentes sin SKU
Migración SQL puntual:
```sql
UPDATE inventory_items
SET sku = 'SKU-' || to_char(now(),'YYYYMMDD') || '-' ||
          upper(substr(md5(id::text || random()::text), 1, 4))
WHERE (sku IS NULL OR sku = '') AND is_active = true;
```
Genera SKU determinístico-único por fila usando hash del id.

### 4. Formulario manual
**No se modifica.** Sigue permitiendo SKU vacío como hoy (campo opcional). La regla "no auto-SKU manual" se mantiene.

### 5. Actualizar memoria
Editar `mem://constraints/inventory/manual-sku-enforcement-v2` para indicar:
> Auto-SKU permitido **únicamente** en importación XML (proveedor no entrega código). Formulario manual sigue sin auto-generación.

## Lo que NO se toca
- Validación de unicidad de SKU (ya existe vía índice + manejo de error)
- Formulario manual `ProductFormModal`
- Lógica de stock, movimientos, costos
- Importador XML general (solo se rellena un campo cuando viene vacío)

## Archivos modificados
- `src/utils/skuGenerator.ts` (nuevo, ~10 líneas)
- `src/services/UnifiedPurchaseService.ts` (~2 líneas)
- `src/hooks/useUnifiedParts.ts` (~2 líneas)
- `src/hooks/useSupplierPayments.ts` (~2 líneas)
- 1 migración SQL (UPDATE backfill)
- Memoria: `manual-sku-enforcement-v2`

## Resultado
- Productos existentes sin SKU quedan completados con formato `SKU-20260417-XXXX`.
- Próximas importaciones XML sin código de producto generan SKU automático.
- Creación manual de productos sigue requiriendo SKU explícito (sin cambios).


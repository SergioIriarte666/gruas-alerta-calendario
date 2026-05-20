
## Diagnóstico

El XML 850394 trae 4 líneas distintas; todas con `<CdgItem><TpoCodigo>QBLI</TpoCodigo><VlrCodigo>0</VlrCodigo></CdgItem>`. El parser extrae `product_code = "0"` para las 4.

En el modal **Importar XML de Bodega** (`src/components/inventory/XMLInventoryUpload.tsx`):

- `findMatchedInventoryItem` (línea 332) trata `"0"` como un SKU real y matchea cualquier item con `sku="0"`.
- `createMissingProductDirect` (línea 644) crea el primer producto con `sku: "0"`.
- A partir de ese momento las otras 3 líneas hacen "match" contra ese mismo producto (la UI muestra "Catalogo: Adaptador 10MB-10MJ" en las 3 inferiores).
- Resultado en BD: solo se creó "Adaptador 10MB-10MJ" y los 8 movimientos (4 entradas + 4 salidas, folio 850394) apuntan todos a ese `item_id`. Los otros 3 productos no existen.

Causa raíz: códigos placeholder (`"0"`, vacíos, solo ceros) tratados como SKU válidos.

El módulo de Costos quedó bien (1 costo por documento, no toca productos individuales).

## Cambios de código

### `src/components/inventory/XMLInventoryUpload.tsx`

1. Agregar helper junto a `normalizeCode` (línea 106):

   ```ts
   const isPlaceholderCode = (value: string | null | undefined) => {
     const n = normalizeCode(value);
     return !n || /^0+$/.test(n);
   };
   ```

2. En `findMatchedInventoryItem` (línea 334) filtrar candidatos placeholder y descartar matches por SKU/barcode placeholder en el catálogo:

   ```ts
   const codeCandidates = [
     !isPlaceholderCode(line.product_code) ? normalizeCode(line.product_code) : '',
     normalizeCode(line.product_name),
     normalizeCode(line.description),
   ].filter(Boolean);

   for (const code of codeCandidates) {
     const exactCodeMatch = inventoryCatalog.find(
       (item) =>
         (!isPlaceholderCode(item.sku) && normalizeCode(item.sku) === code) ||
         (!isPlaceholderCode(item.barcode) && normalizeCode(item.barcode) === code) ||
         normalizeCode(item.name) === code
     );
     if (exactCodeMatch) return { match: exactCodeMatch, candidates: [] };
   }
   ```

3. En `createMissingProductDirect` (línea 638) sanear el SKU al crear:

   ```ts
   const rawCode = line.item.product_code?.trim() || null;
   const normalizedCode = !isPlaceholderCode(rawCode) ? rawCode : null;
   ```

   Pasar `sku: normalizedCode` (queda `null` cuando el XML trae `VlrCodigo=0`).

Con esto cada línea sin código real se identifica por descripción y crea un producto independiente.

## Reparación de datos del folio 850394

Migración que:

1. Limpia el SKU del producto ya creado para que no siga atrapando matches:
   - `UPDATE inventory_items SET sku = NULL WHERE id = '75b7abc4-3909-4559-8cdc-290a406d8189'` (Adaptador 10MB-10MJ).
2. Crea los 3 productos faltantes con `sku = NULL`, `unit_of_measure='unidad'`, categoría = misma de Adaptador 10MB-10MJ:
   - "Adaptador 8MJ-8MP 90°"  unit_cost 5892
   - "Manguera R2-8 Term. FJX-FJX 90° LT: 2.15 MTS"  unit_cost 30155
   - "Manguera R2-8 Term. FJX-FJX 90° LT: 2.35 MTS"  unit_cost 31837
3. Re-apunta los 6 movimientos mal asignados (3 entradas + 3 salidas con `observations` que mencionan cada nombre, `created_at` del 2026-05-20) al `item_id` correcto.
4. Deja intactos los 2 movimientos correctos de "Adaptador 10MB-10MJ" (qty 2, $4.056).
5. Los triggers existentes de `inventory_movements` recalculan stock automáticamente.

## Validación

- Volver a importar mentalmente el mismo XML: las 4 líneas se crean como 4 productos distintos (sku NULL) y los movimientos quedan repartidos correctamente.
- Probar un XML con códigos reales (no "0"): sigue matcheando por SKU como antes.
- En `/inventory`, revisar que aparezcan los 4 productos con stock 0 (entrada + consumo) y costo correcto, y que el historial muestre cada movimiento con su producto real.

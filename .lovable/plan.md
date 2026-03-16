

## Agregar columna "Valor Servicio" y badge "Total OC" al importador de OC

### Cambios en `src/components/vip/PurchaseOrderPDFImporter.tsx`

1. **Importar `formatCurrency`** desde `@/lib/utils` y `getUserCurrencySync` desde `@/utils/currencyUtils`.

2. **Agregar badge "Total OC"** junto a los badges de coincidencias (línea ~157), mostrando `state.parsedOCs[0]?.totals.neto` formateado. Mismo estilo emerald que en el importador de cotizaciones.

3. **Agregar columna "Valor Servicio"** a la tabla:
   - Nuevo `<TableHead>` después de "N° OC Nueva" (línea 188): `Valor Servicio`
   - Nuevo `<TableCell>` después de la celda de OC (línea 228): muestra `match.parsedItem.amount` con `formatCurrency`, o `—` si es 0.

### Archivos a modificar
- `src/components/vip/PurchaseOrderPDFImporter.tsx`


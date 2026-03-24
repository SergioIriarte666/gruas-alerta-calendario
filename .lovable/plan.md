

## Plan: Hacer que el importador XML de Costos realmente sincronice con Bodega/Inventario

### Problema actual
Cuando se activa "Sincronizar con Bodega/Inventario" en el importador XML, solo se guardan metadatos (`purchase_quantity`, `purchase_unit_cost`) en el registro de costo, pero **no se crean los movimientos de inventario** (entrada en bodega). Los movimientos solo se crean desde el formulario manual de costos cuando se selecciona la categoría "Inventario".

### Solución
Después de crear cada costo con la opción de sync activada, llamar a `createDirectInventoryConsumption` (de `inventoryConsumptionHelper.ts`) para crear automáticamente los movimientos de entrada en inventario. Como no hay grúa seleccionada en la importación XML, solo se creará el movimiento de **entrada** (sin salida/consumo inmediato).

### Cambios

| Archivo | Cambio |
|---------|--------|
| `src/components/costs/XMLCostUpload.tsx` (~líneas 361-380) | Después de crear exitosamente cada costo con `syncToInventory=true`, llamar a la función de inventario para crear el movimiento de entrada en bodega usando los datos del costo recién creado (ID, descripción, monto, fecha, supplier_id). |

### Detalle técnico

En el bloque `onSuccess` de `addCost` (línea 370), cuando `syncToInventory` es true:

```typescript
onSuccess: async (data) => {
  successCount++;
  
  if (syncToInventory && data?.[0]) {
    try {
      // Create inventory entry movement (no immediate consumption from XML)
      await createDirectInventoryEntry({
        costId: data[0].id,
        itemName: doc.description || `Factura ${doc.folio}`,
        quantity: 1,
        unitCost: doc.total_amount,
        date: emissionDate,
        supplierId: supplierId,
      });
    } catch (invErr) {
      console.warn('Inventory sync failed for cost:', data[0].id, invErr);
    }
  }
  
  resolve();
}
```

Se creará una función auxiliar `createDirectInventoryEntry` (adaptada de `createDirectInventoryConsumption`) que solo crea el movimiento de **entrada** sin el de salida, ya que desde XML no se selecciona grúa destino.

### Flujo resultante
1. Usuario sube XML y activa "Sincronizar con Bodega/Inventario"
2. Por cada documento, se crea el costo normalmente
3. Adicionalmente se crea: item de inventario (si no existe) + movimiento de entrada
4. El inventario refleja la compra sin consumo inmediato


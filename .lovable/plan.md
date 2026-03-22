

## Plan: Eliminar duplicación de costos al registrar piezas con consumo inmediato

### Problema raíz

Cuando se crea un costo desde el CostForm con `immediate_consumption=true` y una grúa seleccionada, ocurre doble creación:

1. **`addCost` (useCosts.ts)** → crea **Costo #1** (ej. categoría Inventario, subcategoría "Partes y Piezas")
2. **CostForm onSuccess** → llama `UnifiedPurchaseService.registerPurchase()` que crea **Costo #2** (categoría Mantenimiento, subcategoría "Piezas y Repuestos") + movimientos de inventario + crane_parts

Resultado: 2 costos ($60,000 en vez de $30,000), 2 registros en Piezas (uno "Directo", otro "Desde Costo").

### Solución

Reemplazar la llamada a `UnifiedPurchaseService.registerPurchase()` en CostForm por una que solo cree movimientos de inventario y crane_parts usando el costo YA existente, sin crear un segundo costo.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/services/UnifiedPurchaseService.ts` | Agregar método estático `registerForExistingCost()` que ejecuta los pasos 1,2,4,5,6 (sin paso 3 de crear costo) |
| `src/components/costs/CostForm.tsx` | Reemplazar llamadas a `registerPurchase()` por `registerForExistingCost()` pasando el costId existente |

### Detalle técnico

**Nuevo método en UnifiedPurchaseService:**
```typescript
static async registerForExistingCost(params: {
  costId: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  date: string;
  craneId: string;
  supplierId?: string | null;
  supplierName?: string | null;
}): Promise<void> {
  // 1. Find or create inventory item
  // 2. Get warehouse location
  // 3. Create entry movement (linked to existing costId)
  // 4. Create exit movement (consumption to crane)
  // 5. Update cost with inventory_movement_id
  // 6. Create crane_parts record linked to existing costId
  // NO crea un segundo costo
}
```

**CostForm.tsx** (líneas ~349 y ~396): cambiar de:
```typescript
await UnifiedPurchaseService.registerPurchase({...});
```
a:
```typescript
await UnifiedPurchaseService.registerForExistingCost({
  costId: cost.id, // usa el costo ya creado
  itemName: submissionData.description,
  ...
});
```

### Limpieza de datos existentes (migración SQL)

Crear migración para limpiar los duplicados ya generados por este bug:
- Identificar costos duplicados (mismo description, crane_id, date, amount, uno con categoría Mantenimiento/Piezas y Repuestos y otro diferente)
- Eliminar el costo duplicado de Mantenimiento si ya existe el original

### Resultado esperado

- Un solo costo por compra con consumo inmediato
- Un solo registro en Piezas (tipo "Directo")  
- Movimientos de inventario correctos (entrada + salida)
- Sin afectar flujos existentes que usen `registerPurchase()` directamente (desde PartsForm de grúas)


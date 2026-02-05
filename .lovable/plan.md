

# Plan: Sincronización Bidireccional Completa entre Costos, Proveedores e Inventario

## Problema Identificado

Cuando se registra un costo desde el módulo de Costos (como "MANGUERAS HIDRAULICAS" por $25,479), la información **no se sincroniza** con:

1. **Proveedores > Pagos**: Debería aparecer como un pago pendiente (o pagado según la fecha de pago)
2. **Bodega > Movimientos**: Debería aparecer como una entrada de inventario

### Análisis del Estado Actual

| Dirección | Trigger Existe | Funciona |
|-----------|----------------|----------|
| Supplier Payments → Costs | Sí | Sí (cuando status='paid') |
| Supplier Payments → Inventory | Sí | Sí (si tiene part_name, part_quantity) |
| Costs → Inventory | Sí | **Parcial** (requiere purchase_quantity + purchase_unit_cost) |
| Costs → Supplier Payments | **NO** | No existe |
| Inventory → Costs | Sí | Sí (si tiene supplier_id) |

### Brechas Detectadas en XML Upload

El cargador XML actual:
- **No vincula proveedor**: Guarda el nombre en `notes`, no usa `supplier_id`
- **No envía datos de compra**: No incluye `purchase_quantity` ni `purchase_unit_cost`
- **No crea pago a proveedor**: No hay trigger para crear el registro en `supplier_payments`

---

## Solución Propuesta

### Fase 1: Nuevo Trigger - Costs → Supplier Payments

Crear un trigger que, cuando se inserta un costo con `supplier_id` y `payment_date`, automáticamente cree un registro en `supplier_payments`.

```sql
CREATE OR REPLACE FUNCTION create_supplier_payment_from_cost()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo procesar si tiene supplier_id y no fue creado desde un payment
  IF NEW.supplier_id IS NOT NULL 
     AND NEW.supplier_payment_id IS NULL THEN
    
    INSERT INTO supplier_payments (
      supplier_id,
      amount,
      due_date,
      description,
      status,
      cost_id,
      created_by
    ) VALUES (
      NEW.supplier_id,
      NEW.amount,
      COALESCE(NEW.payment_date, NEW.date),
      NEW.description,
      CASE 
        WHEN NEW.payment_date <= CURRENT_DATE THEN 'paid'
        ELSE 'pending'
      END,
      NEW.id,
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Fase 2: Modificar XMLCostUpload para Vincular Proveedor

Actualizar el componente para:
1. Buscar el proveedor por RUT o nombre
2. Enviar `supplier_id` al crear el costo
3. Enviar `purchase_quantity = 1` y `purchase_unit_cost = monto` para activar sincronización con inventario

### Fase 3: Agregar Selector de Categoría de Inventario

Agregar opción en la UI del XML upload para indicar si los costos deben sincronizarse con inventario (categoría "Inventario" o "Mantenimiento").

---

## Cambios Técnicos Detallados

### 1. Migración SQL - Nuevo Trigger Bidireccional

```sql
-- Trigger: Costs → Supplier Payments (NUEVO)
CREATE OR REPLACE FUNCTION public.create_supplier_payment_from_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_id UUID;
BEGIN
  -- Verificar condiciones
  IF NEW.supplier_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- No crear si ya fue creado desde un payment
  IF NEW.supplier_payment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar si ya existe un payment para este costo
  IF EXISTS (SELECT 1 FROM supplier_payments WHERE cost_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  
  -- Crear el pago a proveedor
  INSERT INTO supplier_payments (
    supplier_id,
    amount,
    due_date,
    paid_date,
    description,
    status,
    cost_id,
    category,
    created_by
  ) VALUES (
    NEW.supplier_id,
    NEW.amount,
    COALESCE(NEW.payment_date, NEW.date),
    CASE WHEN NEW.payment_date <= CURRENT_DATE THEN NEW.payment_date ELSE NULL END,
    NEW.description,
    CASE 
      WHEN NEW.payment_date IS NOT NULL AND NEW.payment_date <= CURRENT_DATE THEN 'paid'
      ELSE 'pending'
    END,
    NEW.id,
    NEW.category_id::TEXT,
    NEW.created_by
  ) RETURNING id INTO v_payment_id;
  
  -- Actualizar el costo con la referencia al pago
  UPDATE costs 
  SET supplier_payment_id = v_payment_id 
  WHERE id = NEW.id;
  
  RAISE NOTICE '✅ [Cost→SupplierPayment] Pago creado: %', v_payment_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS create_supplier_payment_from_cost_trigger ON public.costs;
CREATE TRIGGER create_supplier_payment_from_cost_trigger
  AFTER INSERT ON public.costs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_supplier_payment_from_cost();
```

### 2. Agregar Columna cost_id en supplier_payments

```sql
ALTER TABLE public.supplier_payments 
ADD COLUMN IF NOT EXISTS cost_id UUID REFERENCES public.costs(id);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_cost_id 
ON public.supplier_payments(cost_id);
```

### 3. Modificar XMLCostUpload.tsx

```typescript
// Función para buscar proveedor por RUT o nombre
const findSupplierByRutOrName = async (rut: string, name: string): Promise<string | null> => {
  // Primero buscar por RUT
  if (rut) {
    const { data } = await supabase
      .from('suppliers')
      .select('id')
      .eq('rut', rut.trim())
      .single();
    if (data) return data.id;
  }
  
  // Luego buscar por nombre (similarity)
  if (name) {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .ilike('name', `%${name.trim()}%`)
      .limit(1)
      .single();
    if (data) return data.id;
  }
  
  return null;
};

// En handleUploadCosts, modificar costData:
const supplierId = await findSupplierByRutOrName(xmlCost.rut || '', finalProveedor || '');

const costData = {
  date: emissionDateStr,
  description: String(finalDescripcion),
  amount: Number(finalMonto),
  category_id: categoryId,
  subcategory: xmlCost.subcategoria || null,
  notes: [...].filter(Boolean).join(' | ') || null,
  service_folio: xmlCost.numeroFactura || null,
  payment_date: paymentDate,
  // NUEVO: Vinculación con proveedor
  supplier_id: supplierId,
  // NUEVO: Datos para sincronización con inventario
  purchase_quantity: xmlCost.cantidad || 1,
  purchase_unit_cost: Number(finalMonto) / (xmlCost.cantidad || 1),
  immediate_consumption: false
};
```

### 4. Toggle de Sincronización en UI

Agregar control en la sección de acciones masivas:

```tsx
<div className="flex items-center gap-3">
  <Switch
    checked={syncToInventory}
    onCheckedChange={setSyncToInventory}
  />
  <Label className="text-sm">
    Sincronizar con Bodega/Inventario
  </Label>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger>
        <Info className="w-4 h-4 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent>
        Los costos se registrarán como entradas de inventario
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>
```

---

## Diagrama de Sincronización Final

```text
              ┌─────────────────────┐
              │   XML Upload        │
              │   (Costos)          │
              └─────────┬───────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │      costs          │◄─────────────────┐
              │                     │                  │
              └─────────┬───────────┘                  │
                        │                              │
         ┌──────────────┼──────────────┐               │
         │              │              │               │
         ▼              ▼              ▼               │
┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│ supplier_   │  │ inventory_  │  │ crane_      │      │
│ payments    │──│ movements   │  │ parts       │      │
│             │  │             │  │             │      │
└─────────────┘  └─────────────┘  └─────────────┘      │
         │              │                              │
         │              │                              │
         └──────────────┴──────────────────────────────┘
              (triggers bidireccionales)
```

---

## Archivos a Crear/Modificar

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | Nueva migración SQL | Trigger Costs → Supplier Payments + columna cost_id |
| 2 | `src/components/costs/XMLCostUpload.tsx` | Vincular supplier_id + datos de compra |
| 3 | `src/integrations/supabase/types.ts` | Regenerar tipos (automático) |

---

## Resultado Esperado

Después de la implementación:

1. **Al cargar XML de costos** con proveedor identificable:
   - Se crea el costo
   - Se crea automáticamente el pago a proveedor (pendiente o pagado según fecha)
   - Se crea el movimiento de inventario (si está habilitado)

2. **En el módulo de Proveedores > Pagos**:
   - Aparecerá el pago de "MANGUERAS HIDRAULICAS" por $25,479

3. **En Bodega > Movimientos**:
   - Aparecerá la entrada de "MANGUERAS HIDRAULICAS"

4. **Trazabilidad completa**:
   - Cada registro tendrá referencias cruzadas para auditoría




## Plan: Backfill de Pagos a Proveedores desde Costos Existentes

### Problema

El trigger `create_supplier_payment_from_cost` fue creado en febrero 2026. Todos los costos anteriores a esa fecha que tienen `supplier_id` asignado nunca generaron un registro en `supplier_payments`. Por eso Starlink muestra 12 costos pero solo 1 pago en Proveedores.

### Solución

Crear una migración SQL que:

1. **Identifique costos huérfanos**: costos con `supplier_id` que NO tienen un `supplier_payment_id` y NO tienen un registro en `supplier_payments.cost_id`
2. **Genere los registros faltantes**: inserte en `supplier_payments` un registro por cada costo huérfano, respetando la lógica del trigger (estado paid/pending según `payment_date`)
3. **Vincule bidireccionalmente**: actualice `costs.supplier_payment_id` con el ID del pago creado

### Migración SQL

```sql
-- Backfill: crear supplier_payments para costos existentes sin pago asociado
DO $$
DECLARE
  r RECORD;
  v_payment_id UUID;
  v_status TEXT;
  v_paid_amount NUMERIC;
  v_paid_date DATE;
  v_count INT := 0;
BEGIN
  FOR r IN
    SELECT c.*
    FROM costs c
    WHERE c.supplier_id IS NOT NULL
      AND c.supplier_payment_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM supplier_payments sp WHERE sp.cost_id = c.id
      )
  LOOP
    -- Determinar estado
    IF r.payment_date IS NOT NULL AND r.payment_date <= CURRENT_DATE THEN
      v_status := 'paid';
      v_paid_amount := r.amount;
      v_paid_date := r.payment_date;
    ELSE
      v_status := 'pending';
      v_paid_amount := 0;
      v_paid_date := NULL;
    END IF;

    INSERT INTO supplier_payments (
      supplier_id, amount, paid_amount, description,
      due_date, status, paid_date, cost_id, created_by, category
    ) VALUES (
      r.supplier_id, r.amount, v_paid_amount,
      COALESCE(r.description, 'Gasto registrado'),
      COALESCE(r.date, CURRENT_DATE),
      v_status, v_paid_date, r.id, r.created_by, r.subcategory
    ) RETURNING id INTO v_payment_id;

    UPDATE costs SET supplier_payment_id = v_payment_id WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfill completado: % pagos creados', v_count;
END $$;
```

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | Backfill de supplier_payments desde costos existentes |

### Resultado esperado

Después de la migración, todos los costos de Starlink (y cualquier otro proveedor) que tengan `supplier_id` aparecerán tanto en Costos como en Proveedores, con el estado correcto (pagado/pendiente).


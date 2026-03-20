

## Plan: Agregar columna "Pagado" en tabla de Costos

### Objetivo
Agregar una columna visual después de "Monto" que indique si el costo fue pagado, usando un ícono de check verde (pagado) o un indicador pendiente.

### Lógica
Un costo se considera **pagado** cuando tiene `payment_date` con valor (no null). Esto ya existe en la base de datos.

### Previa visual

```text
Fecha | Descripción | Categoría | Monto    | Pagado | Asociado a | Acciones
------|-------------|-----------|----------|--------|------------|--------
21/03 | Factura...  | Pagos...  | $47.412  |   ✓    | N/A        | ...
18/03 | Hotel Ibis  | Gastos... | $360.591 |   ○    | N/A        | ...
17/03 | Combustible | Gastos... | $100.000 |   ✓    | Servicio   | ...
```

- **✓ verde** = tiene `payment_date` → Pagado
- **○ gris** = sin `payment_date` → Pendiente

### Cambios

**Archivo: `src/components/costs/CostsTable.tsx`**

1. Agregar columna `<TableHead>` "Pagado" entre Monto y Asociado a
2. Agregar `<TableCell>` con ícono condicional:
   - `payment_date` existe → ícono `CheckCircle` verde + tooltip "Pagado"
   - `payment_date` null → ícono `Circle` gris + tooltip "Pendiente"
3. Actualizar `colSpan` del estado vacío de 6 a 7


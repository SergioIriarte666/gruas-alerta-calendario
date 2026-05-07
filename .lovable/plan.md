## Problemas detectados

### 1. Validación errónea al editar el costo creado por una cuota
Al pagar una cuota desde Cuentas por Pagar, se crea un costo en categoría "Deudas y Obligaciones". Si la cuota se asoció a una grúa, al abrir ese costo en edición el `CostForm` asume `immediate_consumption = true` (porque hay `crane_id`), y dispara la validación de "Cantidad requerida" pensando que es una compra de inventario. No corresponde: una cuota nunca es una entrada a bodega.

Adicionalmente el costo se guarda sin `subcategory`, por lo que al editarlo el campo aparece vacío.

### 2. Pago de cuota repite datos ya definidos en la deuda
El `PayInstallmentModal` pide centro de costo, grúa y operador en cada pago, cuando esto debería definirse una sola vez al crear la deuda y heredarse a todas las cuotas/costos. La tabla `debts` actualmente no tiene esos campos.

## Plan

### A. Persistir asociaciones a nivel de Deuda
**Migración** sobre `public.debts`:
- Agregar `cost_center_id uuid` (FK a `cost_centers`)
- Agregar `crane_id uuid` (FK a `cranes`)
- Agregar `operator_id uuid` (FK a `operators`)
- Agregar `subcategory text` (default `'Cuotas de Deuda'` o seleccionable; ver pregunta)

### B. `DebtForm` (crear/editar deuda)
- Añadir selectores de Centro de Costo, Grúa, Operador y Subcategoría (subcategorías de "Deudas y Obligaciones": Compra Activo Fijo, Sobregiro Bancario, Convenios, etc.).
- Mismo estilo visual que `CostForm` (ColoredSectionCard, Select shadcn, mismas tipografías y badges violeta).

### C. `PayInstallmentModal`
- Quitar los selectores de Centro de costo / Grúa / Operador.
- Mantener solo: Fecha de pago, Método, Valor UF (si aplica), Notas.
- Tomar las asociaciones directamente desde `installment.debts.*`.

### D. `usePayInstallment` (hook)
- Leer `cost_center_id`, `crane_id`, `operator_id`, `subcategory` desde la deuda asociada.
- Insertar el costo con esos valores y con `subcategory` poblado.

### E. `CostForm` — fix de la validación
En el `useEffect` de carga (línea 231) y en la validación (línea 399):
- No forzar `immediate_consumption = true` cuando la categoría del costo es **"Deudas y Obligaciones"** (ni para otras categorías financieras como "Comisiones"/"Impuestos" si aplica). Solo derivarlo de `crane_parts.length > 0` o del flag explícito guardado en BD.
- En la validación de inventario, excluir la categoría "Deudas y Obligaciones" (una cuota con grúa asociada no es compra de inventario).

### F. Costos existentes
Para el costo recién creado sin subcategoría: una vez aplicada la corrección al formulario, el usuario podrá editarlo sin el bloqueo. Opcional: backfill por SQL del `subcategory` en costos creados por cuotas (los identificamos por `description ILIKE 'Cuota%'` y categoría "Deudas y Obligaciones").

## Pregunta antes de implementar

La subcategoría por defecto al crear una Deuda no es obvia. ¿Cómo prefieres manejarla?

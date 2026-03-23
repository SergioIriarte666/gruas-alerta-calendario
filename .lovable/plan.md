

## Plan: Mover condiciones de pago desde Acciones Masivas a cada registro individual

### Problema
La sección "Acciones Masivas" con XMLPaymentConfig (Condición de Pago + Fechas + Aplicar a todos) queda confusa y alejada de los registros. El usuario quiere que las condiciones de pago estén directamente en cada tarjeta de registro, junto a la fecha de vencimiento ya existente.

### Solución

**Eliminar** el bloque XMLPaymentConfig de ambos importadores (Costos líneas 761-784, Proveedores líneas 684-709) y **agregar un Select de condiciones de pago por registro** junto al DatePicker de Fecha de Vencimiento que ya existe en cada tarjeta.

### Cambios

| Archivo | Cambio |
|---------|--------|
| `src/components/costs/XMLCostUpload.tsx` | 1) Eliminar XMLPaymentConfig de Acciones Masivas (líneas 761-784). 2) En cada tarjeta de registro (línea 1017-1027), agregar un Select de condiciones de pago al lado del DatePicker. Al seleccionar un término, auto-calcula vencimiento = emisión + días. |
| `src/components/suppliers/XMLDocumentUpload.tsx` | 1) Eliminar XMLPaymentConfig de Opciones de Importación (líneas 684-709). 2) En cada documento (línea 939-978), agregar un Select de condiciones de pago al lado del Popover de fecha existente. |
| `src/components/common/XMLPaymentConfig.tsx` | Se puede eliminar o dejar sin uso (ya no se importa). |

### UI por registro (Costos)

```text
┌─ Registro 1 de 5 ──────────────────── $150,000 ─┐
│ Descripción: [Compra combustible...]              │
│ Proveedor: [Copec SA]                            │
│ Fecha Emisión | Categoría       | Monto          │
│ [10/03/2026]  | [Combustible▾]  | [150000]       │
│ ─────────────────────────────────────────────── │
│ Condición de Pago            Fecha de Vencimiento │
│ [▾ Crédito 30 días (30d)]   [📅 09/04/2026]      │
└───────────────────────────────────────────────────┘
```

Al seleccionar una condición de pago, se auto-calcula la fecha de vencimiento (emisión + días del término). Si se elige "Sin condición (manual)", la fecha se edita libremente.

### UI por documento (Proveedores)

Se agrega el Select de condiciones de pago junto al botón de fecha ya existente, en la misma línea.

### Estado

Se agrega `paymentTermOverrides: Record<number|string, string>` para rastrear el término seleccionado por cada registro. El override de fecha ya existe (`paymentDateOverrides` / `dueDateOverrides`).


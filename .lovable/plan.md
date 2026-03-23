

## Plan: Unificar importadores XML y simplificar opciones de vencimiento

### Problema

Existen dos importadores XML completamente independientes con lógica y UI diferentes:
- **Costos** (`XMLCostUpload.tsx`, 1150 líneas): 3 modos de pago (inmediato/crédito/custom), botones [30,45,60,90]
- **Proveedores** (`XMLDocumentUpload.tsx`, 1104 líneas): 2 modos (crédito/contado), botones [30,45,60,90], además maneja proveedores y matching

El usuario quiere eliminar los botones 45, 60, 90 (dejar solo 30 + input personalizado) y unificar la experiencia.

### Solución

Crear un componente compartido de configuración de pago y usarlo en ambos importadores, asegurando que la UI y lógica sean idénticas.

### Cambios

| Archivo | Cambio |
|---------|--------|
| `src/components/common/XMLPaymentConfig.tsx` | **NUEVO** — Componente reutilizable con las opciones de pago unificadas: RadioGroup (Crédito/Contado), selector de días (solo botón 30 + input), selector de fecha de pago |
| `src/components/costs/XMLCostUpload.tsx` | Reemplazar la sección "Condiciones de Pago" (líneas 760-840) por `XMLPaymentConfig`. Eliminar botones 45/60/90. Unificar terminología: "A Crédito (Pendiente)" y "Contado / Ya Pagado" |
| `src/components/suppliers/XMLDocumentUpload.tsx` | Reemplazar la sección "Tipo de Pago" (líneas 680-806) por `XMLPaymentConfig`. Eliminar botones 45/60/90 |

### Componente compartido `XMLPaymentConfig`

```text
┌─────────────────────────────────────────────────┐
│ Tipo de Pago                                    │
│ ○ A Crédito (Pendiente)  ○ Contado / Ya Pagado  │
│                                                 │
│ [Si Crédito]                                    │
│ Días hasta vencimiento:                         │
│ [30] [___] días        [Aplicar a todos]        │
│                                                 │
│ [Si Contado]                                    │
│ Fecha de pago (defecto: fecha emisión XML):     │
│ [📅 dd/mm/yyyy]        [Aplicar a todos]        │
└─────────────────────────────────────────────────┘
```

Props del componente:
- `paymentType`: 'credit' | 'paid'
- `onPaymentTypeChange`
- `creditDays`: number
- `onCreditDaysChange`
- `paidDate`: string
- `onPaidDateChange`
- `onApplyToAll`
- `selectedCount`: number

### Detalle de unificación en Costos

El importador de costos actualmente tiene 3 modos (`immediate`, `credit`, `custom`). Se simplificará a 2 modos como proveedores:
- **"Contado / Ya Pagado"** = equivale al actual `immediate` (fecha pago = fecha emisión, editable)
- **"A Crédito (Pendiente)"** = calcula vencimiento con días

El modo `custom` se elimina porque es redundante: en modo Contado se puede cambiar la fecha individualmente por registro.

### Resultado esperado

- Ambos importadores usan el mismo componente visual y la misma lógica de pago
- Solo aparece el botón "30" + input numérico para días personalizados
- Terminología idéntica en ambos módulos
- La funcionalidad específica de cada importador (proveedores, matching, edición de campos) se mantiene intacta




## Plan: Reemplazar XMLPaymentConfig con sistema de Condiciones de Pago tipo Facturas

### Problema
El componente actual `XMLPaymentConfig` usa radio buttons (Crédito/Contado) + input de días + botón "Aplicar a todos", lo cual es confuso. El usuario prefiere el sistema simple de Facturas: un **dropdown de condiciones de pago** que auto-calcula la fecha de vencimiento, más campos de fecha de emisión y vencimiento editables.

### Solución
Reemplazar `XMLPaymentConfig` en ambos importadores por el mismo patrón de Facturas:
1. **Select dropdown** con las condiciones de pago de la BD (`usePaymentTerms`)
2. **Fecha de Emisión** (read-only, viene del XML)
3. **Fecha de Vencimiento** (auto-calculada desde emisión + días del término, editable)
4. Botón "Aplicar a todos" para propagar la configuración a todos los registros seleccionados

### Cambios

| Archivo | Cambio |
|---------|--------|
| `src/components/common/XMLPaymentConfig.tsx` | Reescribir completamente: reemplazar RadioGroup por Select de `paymentTerms`, agregar DatePickers de Emisión y Vencimiento con layout tipo `InvoiceFormStep2` usando `ColoredSectionCard` |
| `src/components/costs/XMLCostUpload.tsx` | Pasar `paymentTerms` al nuevo componente. Actualizar lógica: cuando se selecciona un término, calcular vencimiento = emisión + días. Eliminar estados `paymentType`/`creditDays` y reemplazar por `paymentTermId` |
| `src/components/suppliers/XMLDocumentUpload.tsx` | Mismo cambio: integrar `usePaymentTerms`, pasar al componente, actualizar lógica de cálculo de fechas |

### UI resultante (igual a la imagen de Facturas)

```text
┌─ Condiciones de Pago ────────────────────────────┐
│ Condición de Pago (Opcional)                      │
│ [▾ Crédito 30 días (30 días)              ]       │
│ Auto-calcula fecha de vencimiento según los días  │
└───────────────────────────────────────────────────┘

┌─ Fechas ─────────────────────────────────────────┐
│ Fecha de Emisión          Fecha de Vencimiento    │
│ [📅 20/03/2026]           [📅 19/04/2026]         │
│                                                   │
│            [Aplicar a todos los seleccionados]    │
└───────────────────────────────────────────────────┘
```

### Detalle técnico

El nuevo `XMLPaymentConfig` recibirá:
- `paymentTerms: PaymentTerm[]` y `loadingTerms: boolean` (del hook existente)
- `paymentTermId: string`, `onPaymentTermIdChange`
- `issueDate: string` (read-only, del XML)
- `dueDate: string`, `onDueDateChange`
- `onApplyToAll`, `selectedCount`

La lógica de auto-cálculo (emisión + días = vencimiento) se maneja en el componente padre, igual que en `InvoiceForm.tsx`.


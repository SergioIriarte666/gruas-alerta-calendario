

## Confirmación: Conciliación SÍ está incluida en el plan

Revisando, los archivos de conciliación **ya están contemplados** en el plan original:

| Archivo | Línea | Cambio |
|---------|-------|--------|
| `PaymentReconciliationUpdated.tsx` | 411 | `clients.map(` → `clients.filter(c => c.isActive).map(` |
| `PaymentReconciliation.tsx` | 244 | `clients.map(` → `clients.filter(c => c.isActive).map(` |

### Lista completa de archivos a modificar (10 archivos, ~12 cambios)

1. `src/components/invoices/SmartPaymentForm.tsx`
2. `src/components/invoices/PaymentForm.tsx`
3. `src/components/invoices/PaymentHistory.tsx`
4. **`src/components/invoices/PaymentReconciliationUpdated.tsx`** ← incluido
5. **`src/components/invoices/PaymentReconciliation.tsx`** ← incluido
6. `src/components/closures/ClientSelector.tsx`
7. `src/components/closures/ClosuresSearch.tsx`
8. `src/components/settings/CreateUserDialog.tsx`
9. `src/components/reports/ReportFilters.tsx` (2 ocurrencias)
10. `src/components/reports/shared/ReportFilters.tsx` (2 ocurrencias)

Todos reciben el mismo cambio: agregar `.filter(c => c.isActive)` antes del `.map()`.


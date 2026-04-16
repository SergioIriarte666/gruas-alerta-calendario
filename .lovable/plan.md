

# Plan: Corregir desfase de 1 día en cálculo de fecha de vencimiento

## Problema
En `src/components/invoices/InvoiceForm.tsx` (línea 116), al calcular la fecha de vencimiento a partir de la condición de pago:

```typescript
const dueDate = new Date(watchedIssueDate); // "2026-04-15" -> UTC midnight
dueDate.setDate(dueDate.getDate() + term.days);
```

`new Date('2026-04-15')` se interpreta como **UTC medianoche**, que en Chile (UTC-4) es **14 de abril a las 20:00**. Al sumar 30 días con `getDate()` (que usa hora local), opera sobre el día 14 y da **14 de mayo** en vez de **15 de mayo**.

## Solución
Reemplazar `new Date(watchedIssueDate)` por `safeParseDateOnly(watchedIssueDate)`, que ya existe en el proyecto y parsea la fecha como mediodía local, evitando el desfase.

## Cambio exacto

**Archivo**: `src/components/invoices/InvoiceForm.tsx`

Línea 116, cambiar:
```typescript
const dueDate = new Date(watchedIssueDate);
```
Por:
```typescript
const dueDate = safeParseDateOnly(watchedIssueDate);
```

Y agregar el import de `safeParseDateOnly` desde `@/utils/timezoneUtils`.

Es un cambio de 1 línea + 1 import.


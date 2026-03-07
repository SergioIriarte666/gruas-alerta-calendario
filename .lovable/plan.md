

## Problem Summary

The Finanzas/Facturas module is contaminated with historical/imported invoice data (HIST-*) in three places:

1. **Stats cards** (line 571): `<InvoicesStats invoices={invoices} />` passes ALL invoices (including HIST-*), causing inflated counts (1869 vs ~1) and wrong totals for Pendientes/Vencidas/Cobradas.
2. **Alert functions** (`get_overdue_invoices_for_alerts`, `get_invoices_due_soon`): No `folio NOT LIKE 'HIST-%'` filter, so the Alertas tab shows 504+ historical overdue invoices.
3. **`useInvoiceData` full fetch** (`fetchAllInvoices`): Fetches ALL invoices including historical, which feeds into stats and pipeline views.

## Plan

### 1. Fix InvoicesStats to use filtered data
In `src/pages/Invoices.tsx` line 571, change from `invoices` (all) to `baseInvoices` (already filtered to exclude HIST-*):
```tsx
<InvoicesStats invoices={baseInvoices} />
```

### 2. Filter historical invoices from `fetchAllInvoices`
In `src/hooks/invoices/useInvoiceData.ts`, add `.not('folio', 'like', 'HIST-%')` to the full fetch query (same filter already applied to paged query). This ensures the `invoices` array from `useInvoices()` never includes historical data.

### 3. Exclude historical invoices from alert DB functions
Create a migration to update both functions:
- `get_overdue_invoices_for_alerts`: add `AND i.folio NOT LIKE 'HIST-%'`
- `get_invoices_due_soon`: add `AND i.folio NOT LIKE 'HIST-%'`

This isolates historical data entirely to the Históricos module.

### Files to modify
- `src/pages/Invoices.tsx` — stats prop fix
- `src/hooks/invoices/useInvoiceData.ts` — add HIST- filter to full fetch
- New migration SQL — update alert functions


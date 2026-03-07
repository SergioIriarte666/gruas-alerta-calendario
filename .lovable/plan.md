

# Fix: RUT normalization consistency + Invoice selection

## Problem 1: RUT still not matching
The `normalizeRut` function in the parser was fixed to strip dots, spaces, and dashes. But in `InvoiceHistoryImport.tsx`, there are 4 places that still use the old regex `replace(/\./g, '')` (only strips dots):
- Line 136: creating client RUT map
- Line 188: looking up unmatched invoice RUT
- Line 193: finding unmatched client entry
- Line 441: counting importable invoices in the button label

All of these need to use the same normalization: `replace(/[.\s-]/g, '').trim().toUpperCase()`.

## Problem 2: No invoice selection
Currently all matched invoices are imported automatically with no way to exclude individual ones. The user wants checkboxes to select/deselect invoices.

### Changes to `InvoiceHistoryImport.tsx`:
- Add `selectedInvoices` state (`Set<string>`) tracking selected invoice keys
- Initialize all matched invoices as selected on preview load
- Add select all / deselect all toggle
- Add checkbox column to `InvoicePreviewTable`
- Show all invoices (remove the slice(0,10) limit, keep scroll)
- Filter by `selectedInvoices` during import
- Update button count to reflect selection
- Extract a shared `normalizeRut` helper used consistently everywhere

## Files to modify
- `src/components/invoices/InvoiceHistoryImport.tsx` — fix 4 normalization calls + add selection UI




## Plan: Fix category/subcategory not saving from XML import and not loading on edit

### Root Causes

1. **XML importer ignores user's category selection**: Line 440 in `XMLDocumentUpload.tsx` uses `paymentData.category` (from the parser — a generic name like "Pagos a Proveedores") instead of the user's selection from `supplierCategoryMapping`. The user selects "Pagos a Proveedores" with subcategory "Telefonia e Internet" but only the parser's default category is saved.

2. **Category saved as name, form expects UUID**: The XML importer saves category as a name string (e.g., "Pagos a Proveedores"), but the edit form's Select uses `category.id` (UUID) as option values. So when editing, `payment.category = "Pagos a Proveedores"` doesn't match any UUID option — the field appears empty.

3. **Subcategory not passed from mapping to payment**: The subcategory from `supplierSubcategoryMapping` is passed (line 441), but since category is wrong, the whole chain breaks.

### Changes

| File | Change |
|------|--------|
| `src/components/suppliers/XMLDocumentUpload.tsx` (~line 440) | Replace `paymentData.category` with the user's mapped category: look up the category ID from `supplierCategoryMapping[paymentData.supplier_rut]` against `activeCategories`, and pass the **UUID** instead of the name string. Same for subcategory. |
| `src/components/suppliers/PaymentForm.tsx` (~line 92) | On init, resolve `payment.category` — if it's a name string (not UUID), find the matching `costCategory.id` and use that. Same for subcategory: resolve name to name (already works if category is correct). |

### Technical detail

**XMLDocumentUpload.tsx** — when creating payment, resolve category name to ID:
```typescript
const catName = supplierCategoryMapping[paymentData.supplier_rut] || paymentData.category;
const catObj = activeCategories?.find(c => c.name === catName);
const categoryId = catObj?.id || paymentData.category;
const subcatName = supplierSubcategoryMapping[paymentData.supplier_rut] || null;

createPayment({
  ...
  category: categoryId,    // UUID instead of name
  subcategory: subcatName,
  ...
});
```

**PaymentForm.tsx** — resolve existing category on load:
```typescript
// In defaultValues
const resolvedCategoryId = (() => {
  if (!payment?.category) return '';
  // If it's already a UUID, use as-is
  const isUuid = /^[0-9a-f]{8}-/.test(payment.category);
  if (isUuid) return payment.category;
  // Otherwise, find by name
  const match = costCategories.find(c => c.name?.toLowerCase() === payment.category?.toLowerCase());
  return match?.id || '';
})();
```

This ensures categories are stored as UUIDs (matching the Select values) and resolved correctly when editing existing records.


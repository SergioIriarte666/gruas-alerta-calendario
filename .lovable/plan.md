

## Plan: Fix category saving and add subcategory to Supplier Payment form

### Problems identified

1. **Category not saving on update**: The `updatePaymentMutation` spreads the entire form data (`...data`) into the Supabase update, including non-DB fields like `add_to_inventory`, `selected_invoice_ids`, `part_name`, etc. This can cause silent Supabase errors. The create mutation explicitly maps each field, but the update does not.

2. **Subcategory field hidden**: The subcategory Select is only rendered when `subcategories.length > 0`. If no subcategories have been loaded yet (e.g., category not selected or still loading), the field is completely invisible. It should always be visible when a category is selected, showing "Sin subcategorías" if none exist.

### Changes

| File | Change |
|------|--------|
| `src/hooks/useSupplierPayments.ts` (lines 119-140) | Fix `updatePaymentMutation` to explicitly map only valid DB columns (matching the create mutation pattern) instead of spreading `...data`. Include `subcategory` in the mapped fields. |
| `src/components/suppliers/PaymentForm.tsx` (lines 336-358) | Always show the subcategory field when a category is selected (remove `subcategories.length > 0` condition). Show "Sin subcategorías disponibles" as disabled option when empty. |

### Technical detail

**Update mutation fix** -- explicitly map fields like the create mutation does:
```typescript
const cleanedData = {
  supplier_id: data.supplier_id,
  amount: data.amount,
  due_date: data.due_date,
  description: data.description,
  category: data.category || null,
  subcategory: data.subcategory || null,
  reference_number: data.reference_number || null,
  notes: data.notes || null,
  status: data.status || 'pending',
  crane_id: data.crane_id || null,
  part_name: data.part_name || null,
  part_quantity: data.part_quantity || null,
  part_unit_price: data.part_unit_price || null,
  add_to_inventory: data.add_to_inventory || false,
};
```

**Subcategory visibility** -- show field whenever a category is selected:
```tsx
{selectedCategoryId && (
  <div>
    <Label>Subcategoría</Label>
    <Select ...>
      {subcategories.length === 0 ? (
        <SelectItem value="none" disabled>Sin subcategorías</SelectItem>
      ) : (
        subcategories.map(...)
      )}
    </Select>
  </div>
)}
```


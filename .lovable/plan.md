

## Problem

When a cost is created with a supplier, the trigger `create_supplier_payment_from_cost` always marks the supplier payment as **"pending"** because `payment_date` is never set from the cost form. The form has no way for the user to indicate whether the expense has already been paid.

## Plan

### Step 1: Add `is_paid` checkbox to cost schema

Add a boolean field `is_paid` to `costSchema.ts` (default `false`). This is a UI-only field that controls whether `payment_date` gets populated.

### Step 2: Add checkbox to cost form (CostFormInputs.tsx)

Below the **Proveedor** selector (line ~487), add a conditional checkbox that only appears when a supplier is selected:

```text
┌─────────────────────────────────┐
│ Proveedor: [Dropdown]           │
│ ☑ Este gasto ya fue pagado      │
└─────────────────────────────────┘
```

Uses the existing `Checkbox` component with a label "Este gasto ya fue pagado al proveedor".

### Step 3: Set `payment_date` on submission (CostForm.tsx)

In the submission logic (~line 298-313), when `is_paid` is checked and a `supplier_id` is set, populate `payment_date = values.date`. This makes the trigger create the supplier payment as "paid" with `paid_date` set.

### Step 4: Fix trigger to set `paid_amount`

Update `create_supplier_payment_from_cost` to also set `paid_amount = NEW.amount` when status is 'paid'. Currently it never sets `paid_amount`, causing the display bug. Also use `NEW.date` as fallback for status resolution.

### Step 5: Fix existing orphaned records

Data migration to update existing supplier payments created from costs that should be 'paid' but are 'pending'.


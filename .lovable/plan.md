

## Plan: Separate department grouping for historical vs app invoices

### Problem
Historical imported invoices (folio starting with `HIST-`) were assigned to arbitrary departments during import because SII data doesn't contain department info. Sub-grouping these by department is misleading.

### Solution
In the department sub-grouping logic, treat historical invoices as department-agnostic while keeping department differentiation for app-created invoices.

### Changes to `HistoricalSalesPipelineView.tsx`

**Grouping logic (lines 184-185)**: When building department sub-groups, check if the invoice folio starts with `HIST-`. If so, assign it to a special group (e.g., "Histórico") instead of using `inv.client?.department`. App invoices keep their real department.

```text
Current:  const dept = inv.client?.department || 'General';
New:      const dept = inv.folio.startsWith('HIST-') ? 'Histórico' : (inv.client?.department || 'General');
```

**Department visibility (line 201)**: Update `hasMultipleDepartments` to consider whether there are multiple *non-historical* departments. If the only groups are "Histórico" + one real department, still show the department level so the user can distinguish imported vs app data.

**Visual distinction**: The "Histórico" department group will use a different icon (e.g., `Archive` or `FileText`) instead of `Building2` to make it clear these are imported records without department assignment.

### File to modify
- `src/components/finance/historical/HistoricalSalesPipelineView.tsx`


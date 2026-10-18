interface ClassifiedInvoiceLine {
  cost_subcategory?: string | null;
  subtotal: number | string | null;
}

export function resolveLineSubcategoryId(value: string | undefined, defaultName: string, options: { id: string; name: string }[]) {
  return value === undefined ? options.find(option => option.name === defaultName)?.id || null : value || null;
}

export function summarizeInvoiceClassifications(lines: ClassifiedInvoiceLine[], defaultSubcategory?: string | null) {
  const groups = new Map<string, { name: string; lineCount: number; netAmount: number }>();
  for (const line of lines) {
    const name = (line.cost_subcategory ?? defaultSubcategory) || 'Sin subcategoría';
    const group = groups.get(name) || { name, lineCount: 0, netAmount: 0 };
    group.lineCount += 1;
    group.netAmount += Number(line.subtotal) || 0;
    groups.set(name, group);
  }
  return Array.from(groups.values());
}

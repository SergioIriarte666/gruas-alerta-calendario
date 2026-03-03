type CostCategoryLike = {
  id: string;
  name?: string | null;
};

/**
 * Resuelve la etiqueta de categoría para supplier_payments.category.
 * Ahora solo busca en cost_categories (fuente de verdad única).
 */
export const resolveSupplierPaymentCategoryLabel = (
  category: string | null | undefined,
  costCategories: CostCategoryLike[],
  fallback = 'Sin categoría'
): string => {
  if (!category) return fallback;

  const match = costCategories.find((c) => c.id === category);
  if (match) return match.name || fallback;

  // Legacy string (not a UUID) — return as-is
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(category);
  if (!isUuid) return category;

  return fallback;
};

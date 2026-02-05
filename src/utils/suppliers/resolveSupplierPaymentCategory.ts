export const isUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

type SupplierCategoryLike = {
  id: string;
  label?: string | null;
  name?: string | null;
};

type CostCategoryLike = {
  id: string;
  name?: string | null;
  label?: string | null;
};

interface ResolveArgs {
  supplierCategories?: SupplierCategoryLike[];
  costCategories?: CostCategoryLike[];
  fallback?: string;
}

/**
 * Resuelve la etiqueta de categoría para supplier_payments.category.
 * Soporta datos históricos:
 * - UUID de supplier_categories
 * - UUID de cost_categories
 * - string legacy (ej: "otros", "administrativos")
 */
export const resolveSupplierPaymentCategoryLabel = (
  category: string | null | undefined,
  {
    supplierCategories = [],
    costCategories = [],
    fallback = 'Sin categoría',
  }: ResolveArgs
): string => {
  if (!category) return fallback;

  const costMatch = costCategories.find((c) => c.id === category);
  if (costMatch) return costMatch.name || costMatch.label || fallback;

  const supplierMatch = supplierCategories.find((c) => c.id === category);
  if (supplierMatch) return supplierMatch.label || supplierMatch.name || fallback;

  // Categorías legacy guardadas como texto
  if (!isUuid(category)) return category;

  // UUID desconocido: evitar mostrar "caracteres basura"
  return fallback;
};

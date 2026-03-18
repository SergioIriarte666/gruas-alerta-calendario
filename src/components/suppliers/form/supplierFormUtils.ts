import { Supplier } from '@/types/suppliers';

export interface SupplierCategoryOption {
  id: string;
  label: string;
  name: string;
}

const normalizeCategoryText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const LEGACY_CATEGORY_FALLBACKS = new Set([
  'general',
  'generales',
  'otro',
  'otros',
  'other',
  'sin categoria',
  'sin categoria definida',
]);

const findCategoryByNormalizedName = (
  categories: SupplierCategoryOption[],
  normalizedValue: string,
) =>
  categories.find((category) => {
    const normalizedName = normalizeCategoryText(category.name);
    const normalizedLabel = normalizeCategoryText(category.label);
    return normalizedName === normalizedValue || normalizedLabel === normalizedValue;
  });

export const resolveSupplierCategoryValue = (
  categories: SupplierCategoryOption[],
  categoryValue?: string | null,
): string => {
  if (!categoryValue) return '';

  const trimmedValue = categoryValue.trim();
  const byId = categories.find((category) => category.id === trimmedValue);
  if (byId) return byId.id;

  const normalizedValue = normalizeCategoryText(trimmedValue);
  const byName = findCategoryByNormalizedName(categories, normalizedValue);
  if (byName) return byName.id;

  if (LEGACY_CATEGORY_FALLBACKS.has(normalizedValue)) {
    const fallbackCategory = findCategoryByNormalizedName(categories, 'otros');
    if (fallbackCategory) return fallbackCategory.id;
  }

  return '';
};

export const buildSupplierFormValues = (
  supplier: Supplier | undefined,
  categories: SupplierCategoryOption[],
) => {
  const resolvedCategory = resolveSupplierCategoryValue(categories, supplier?.category);

  return {
    name: supplier?.name || '',
    rut: supplier?.rut || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    contact_name: supplier?.contact_name || supplier?.contact_person || '',
    category: resolvedCategory,
    subcategory: supplier?.subcategory || '',
    notes: supplier?.notes || '',
    is_active: supplier?.is_active ?? true,
  };
};

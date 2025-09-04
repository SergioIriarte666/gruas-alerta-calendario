import { SupplierCategory } from '@/hooks/useSupplierCategoryManager';

// Utility function to get category label from ID
export const getCategoryLabel = (categories: SupplierCategory[], categoryId: string): string => {
  const category = categories.find(c => c.id === categoryId);
  return category?.label || categoryId;
};

// Utility function to get category name from ID  
export const getCategoryName = (categories: SupplierCategory[], categoryId: string): string => {
  const category = categories.find(c => c.id === categoryId);
  return category?.name || categoryId;
};
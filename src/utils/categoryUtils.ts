// Utility function to get category name from ID (using cost_categories as single source of truth)
export const getCategoryLabel = (categories: { id: string; name?: string | null }[], categoryId: string): string => {
  const category = categories.find(c => c.id === categoryId);
  return category?.name || categoryId;
};

// Alias for backward compatibility
export const getCategoryName = getCategoryLabel;

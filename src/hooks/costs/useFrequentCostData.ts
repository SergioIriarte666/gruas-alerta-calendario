import { useMemo } from 'react';
import { useCosts } from '@/hooks/useCosts';

interface FrequentData {
  value: string;
  count: number;
}

export const useFrequentCostData = (categoryId?: string) => {
  const { data: costs = [] } = useCosts();

  const frequentDescriptions = useMemo(() => {
    const descriptionCounts = new Map<string, number>();
    
    costs.forEach(cost => {
      if (cost.description && cost.description.trim()) {
        const normalized = cost.description.trim();
        descriptionCounts.set(normalized, (descriptionCounts.get(normalized) || 0) + 1);
      }
    });

    return Array.from(descriptionCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [costs]);

  const frequentSuppliers = useMemo(() => {
    const supplierCounts = new Map<string, number>();
    
    costs.forEach(cost => {
      if (cost.crane_parts && Array.isArray(cost.crane_parts)) {
        cost.crane_parts.forEach(part => {
          if (part.supplier && part.supplier.trim()) {
            const normalized = part.supplier.trim();
            supplierCounts.set(normalized, (supplierCounts.get(normalized) || 0) + 1);
          }
        });
      }
    });

    return Array.from(supplierCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [costs]);

  const frequentPartNames = useMemo(() => {
    const partCounts = new Map<string, number>();
    
    costs.forEach(cost => {
      if (cost.crane_parts && Array.isArray(cost.crane_parts)) {
        cost.crane_parts.forEach(part => {
          if (part.part_name && part.part_name.trim()) {
            const normalized = part.part_name.trim();
            partCounts.set(normalized, (partCounts.get(normalized) || 0) + 1);
          }
        });
      }
    });

    return Array.from(partCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [costs]);

  const frequentSubcategories = useMemo(() => {
    const subcategoryCounts = new Map<string, number>();
    
    costs.forEach(cost => {
      // Filtrar por categoría si se proporciona
      if (categoryId && cost.category_id !== categoryId) return;
      
      if (cost.subcategory && cost.subcategory.trim()) {
        const normalized = cost.subcategory.trim();
        subcategoryCounts.set(normalized, (subcategoryCounts.get(normalized) || 0) + 1);
      }
    });

    return Array.from(subcategoryCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [costs, categoryId]);

  const searchData = (query: string, type: 'description' | 'supplier' | 'part_name' | 'subcategory'): FrequentData[] => {
    if (!query || query.length < 2) return [];

    const dataSource = type === 'description' 
      ? frequentDescriptions 
      : type === 'supplier' 
      ? frequentSuppliers 
      : type === 'part_name'
      ? frequentPartNames
      : frequentSubcategories;

    const searchTerm = query.toLowerCase();

    return dataSource.filter(item => 
      item.value.toLowerCase().includes(searchTerm)
    );
  };

  return {
    frequentDescriptions,
    frequentSuppliers,
    frequentPartNames,
    frequentSubcategories,
    searchData
  };
};

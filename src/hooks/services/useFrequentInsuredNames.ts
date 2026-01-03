import { useMemo } from 'react';
import { useServices } from '@/hooks/useServices';

interface InsuredNameFrequency {
  name: string;
  count: number;
}

export const useFrequentInsuredNames = () => {
  const { services } = useServices();

  const frequentInsuredNames = useMemo(() => {
    const nameCounts = new Map<string, number>();
    
    services.forEach(service => {
      if (service.insuredName && service.insuredName.trim()) {
        const normalizedName = service.insuredName.trim();
        nameCounts.set(normalizedName, (nameCounts.get(normalizedName) || 0) + 1);
      }
    });

    return Array.from(nameCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [services]);

  const searchInsuredNames = (query: string): InsuredNameFrequency[] => {
    if (!query || query.length < 2) return [];

    const searchTerm = query.toLowerCase();

    return frequentInsuredNames.filter(item => 
      item.name.toLowerCase().includes(searchTerm)
    );
  };

  return {
    frequentInsuredNames,
    searchInsuredNames
  };
};

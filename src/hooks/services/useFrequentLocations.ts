import { useMemo } from 'react';
import { useServices } from '@/hooks/useServices';

interface LocationFrequency {
  location: string;
  count: number;
}

export const useFrequentLocations = () => {
  const { services } = useServices();

  const frequentOrigins = useMemo(() => {
    const originCounts = new Map<string, number>();
    
    services.forEach(service => {
      if (service.origin && service.origin.trim()) {
        const normalizedOrigin = service.origin.trim();
        originCounts.set(normalizedOrigin, (originCounts.get(normalizedOrigin) || 0) + 1);
      }
    });

    return Array.from(originCounts.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 más frecuentes
  }, [services]);

  const frequentDestinations = useMemo(() => {
    const destinationCounts = new Map<string, number>();
    
    services.forEach(service => {
      if (service.destination && service.destination.trim()) {
        const normalizedDestination = service.destination.trim();
        destinationCounts.set(normalizedDestination, (destinationCounts.get(normalizedDestination) || 0) + 1);
      }
    });

    return Array.from(destinationCounts.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 más frecuentes
  }, [services]);

  const searchLocations = (query: string, type: 'origin' | 'destination'): LocationFrequency[] => {
    if (!query || query.length < 2) return [];

    const locations = type === 'origin' ? frequentOrigins : frequentDestinations;
    const searchTerm = query.toLowerCase();

    return locations.filter(item => 
      item.location.toLowerCase().includes(searchTerm)
    );
  };

  return {
    frequentOrigins,
    frequentDestinations,
    searchLocations
  };
};
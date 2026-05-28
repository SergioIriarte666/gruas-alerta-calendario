import { useMemo } from 'react';
import { useServices } from '@/hooks/useServices';

interface LocationFrequency {
  location: string;
  count: number;
}

const normalizeKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

interface LocationIndexEntry {
  key: string;
  display: string;
  count: number;
}

const buildIndex = (values: Array<string | undefined | null>): LocationIndexEntry[] => {
  const map = new Map<string, LocationIndexEntry>();
  values.forEach((raw) => {
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = normalizeKey(trimmed);
    if (!key) return;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { key, display: trimmed, count: 1 });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
};

export const useFrequentLocations = () => {
  const { services } = useServices();

  const originIndex = useMemo(
    () => buildIndex(services.map((s) => s.origin)),
    [services]
  );

  const destinationIndex = useMemo(
    () => buildIndex(services.map((s) => s.destination)),
    [services]
  );

  const frequentOrigins: LocationFrequency[] = useMemo(
    () => originIndex.slice(0, 10).map((e) => ({ location: e.display, count: e.count })),
    [originIndex]
  );

  const frequentDestinations: LocationFrequency[] = useMemo(
    () => destinationIndex.slice(0, 10).map((e) => ({ location: e.display, count: e.count })),
    [destinationIndex]
  );

  const searchLocations = (
    query: string,
    type: 'origin' | 'destination'
  ): LocationFrequency[] => {
    if (!query || query.trim().length < 2) return [];
    const term = normalizeKey(query);
    if (!term) return [];
    const index = type === 'origin' ? originIndex : destinationIndex;
    return index
      .filter((entry) => entry.key.includes(term))
      .slice(0, 15)
      .map((entry) => ({ location: entry.display, count: entry.count }));
  };

  return {
    frequentOrigins,
    frequentDestinations,
    searchLocations,
  };
};
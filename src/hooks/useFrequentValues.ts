import { useMemo } from 'react';
import { Suggestion } from '@/components/common/AutocompleteInput';

interface UseFrequentValuesOptions<T> {
  data: T[];
  field: keyof T;
  maxResults?: number;
}

export function useFrequentValues<T>({ data, field, maxResults = 10 }: UseFrequentValuesOptions<T>) {
  const suggestions = useMemo<Suggestion[]>(() => {
    const counts = new Map<string, number>();

    data.forEach(item => {
      const val = item[field];
      if (typeof val === 'string' && val.trim()) {
        const normalized = val.trim();
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, maxResults);
  }, [data, field, maxResults]);

  const allValues = useMemo<Suggestion[]>(() => {
    const counts = new Map<string, number>();

    data.forEach(item => {
      const val = item[field];
      if (typeof val === 'string' && val.trim()) {
        const normalized = val.trim();
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [data, field]);

  const search = (query: string): Suggestion[] => {
    if (!query || query.length < 2) return suggestions;
    const term = query.toLowerCase();
    return allValues.filter(s => s.value.toLowerCase().includes(term)).slice(0, 15);
  };

  return { suggestions, search, allValues };
}

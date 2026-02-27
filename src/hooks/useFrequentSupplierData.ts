import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Suggestion } from '@/components/common/AutocompleteInput';

function buildSuggestions(values: string[]): Suggestion[] {
  const counts = new Map<string, number>();
  values.forEach(v => {
    if (v && v.trim()) {
      const normalized = v.trim();
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  });
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

export function useFrequentSupplierData() {
  const { data: payments = [] } = useQuery({
    queryKey: ['supplier_payments_autocomplete'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_payments')
        .select('description, part_name, reference_number')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const descriptionSuggestions = useMemo(
    () => buildSuggestions(payments.map(p => p.description).filter(Boolean) as string[]),
    [payments]
  );

  const partNameSuggestions = useMemo(
    () => buildSuggestions(payments.map(p => p.part_name).filter(Boolean) as string[]),
    [payments]
  );

  const referenceSuggestions = useMemo(
    () => buildSuggestions(payments.map(p => p.reference_number).filter(Boolean) as string[]),
    [payments]
  );

  return { descriptionSuggestions, partNameSuggestions, referenceSuggestions };
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_CREDITOR_TYPES = ['fiscal', 'bank', 'leasing', 'supplier', 'other'];

export const useCreditorTypes = () => {
  return useQuery({
    queryKey: ['creditor-types'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('creditors')
        .select('type');
      if (error) return DEFAULT_CREDITOR_TYPES;
      const types = Array.from(new Set((data || []).map((r: any) => String(r.type).trim()).filter(Boolean)));
      return types.length > 0 ? types : DEFAULT_CREDITOR_TYPES;
    },
    staleTime: 5 * 60 * 1000,
  });
};

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Costos registrados, incluidas comisiones, consultados por página de servicios. */
export const useServiceCostTotals = (serviceIds: string[]) => {
  const ids = [...new Set(serviceIds)].sort();
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['costs', 'service-totals'] });
    };
    window.addEventListener('global-data-refresh', refresh);
    return () => window.removeEventListener('global-data-refresh', refresh);
  }, [queryClient]);

  return useQuery({
    queryKey: ['costs', 'service-totals', ids],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const totals: Record<string, number> = Object.fromEntries(ids.map(id => [id, 0]));
      // Paginar también los costos: una página de servicios puede superar
      // el límite de filas de PostgREST. No asumir costos cero ante un error.
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from('costs')
          .select('id, service_id, amount')
          .in('service_id', ids)
          .order('id')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        for (const cost of data) {
          if (cost.service_id) totals[cost.service_id] += Number(cost.amount || 0);
        }
        if (data.length < pageSize) break;
      }
      return totals;
    },
  });
};

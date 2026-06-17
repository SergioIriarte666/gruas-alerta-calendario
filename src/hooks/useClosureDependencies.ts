import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClosureDependencies {
  servicesCount: number;
  invoicesCount: number;
}

export const useClosureDependencies = (closureId: string | null) => {
  const { data, isLoading } = useQuery<ClosureDependencies>({
    queryKey: ['closure-dependencies', closureId],
    enabled: !!closureId,
    staleTime: 0,
    gcTime: 30_000,
    queryFn: async () => {
      const id = closureId!;
      const [servicesRes, invoicesRes] = await Promise.all([
        supabase.from('closure_services').select('id', { count: 'exact', head: true }).eq('closure_id', id),
        supabase.from('invoice_closures').select('id', { count: 'exact', head: true }).eq('closure_id', id),
      ]);
      return {
        servicesCount: servicesRes.count ?? 0,
        invoicesCount: invoicesRes.count ?? 0,
      };
    },
  });

  return {
    dependencies: data ?? null,
    isLoading,
  };
};

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceDependencies {
  costsCount: number;
  inspectionsCount: number;
  calendarCount: number;
  closuresCount: number;
  invoicesCount: number;
}

export const useServiceDependencies = (serviceId: string | null) => {
  const { data, isLoading } = useQuery<ServiceDependencies>({
    queryKey: ['service-dependencies', serviceId],
    enabled: !!serviceId,
    staleTime: 0,
    gcTime: 30_000,
    queryFn: async () => {
      const id = serviceId!;
      const [costsRes, inspRes, calRes, closRes, invRes] = await Promise.all([
        supabase.from('costs').select('id', { count: 'exact', head: true }).eq('service_id', id),
        supabase.from('inspections').select('id', { count: 'exact', head: true }).eq('service_id', id),
        supabase.from('calendar_events').select('id', { count: 'exact', head: true }).eq('service_id', id),
        supabase.from('closure_services').select('id', { count: 'exact', head: true }).eq('service_id', id),
        supabase.from('invoice_services').select('id', { count: 'exact', head: true }).eq('service_id', id),
      ]);
      return {
        costsCount: costsRes.count ?? 0,
        inspectionsCount: inspRes.count ?? 0,
        calendarCount: calRes.count ?? 0,
        closuresCount: closRes.count ?? 0,
        invoicesCount: invRes.count ?? 0,
      };
    },
  });

  return {
    dependencies: data ?? null,
    isLoading,
    hasRelatedData: data
      ? data.costsCount > 0 || data.inspectionsCount > 0 || data.calendarCount > 0 ||
        data.closuresCount > 0 || data.invoicesCount > 0
      : false,
  };
};

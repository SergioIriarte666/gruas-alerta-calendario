import { ServiceClosure } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatClosureData } from '@/utils/closureUtils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useClosureData");
const MAX_CLOSURES = 200;
const MAX_CLOSURES_WITH_SERVICE_LINKS = 50;

const fetchClosures = async (): Promise<ServiceClosure[]> => {
  logger.debug('Fetching closures...');
  
  // Fetch all closures (open, closed, and invoiced) so users can see their full history
  const { data: allClosuresData, error: activeError } = await supabase
    .from('service_closures')
    .select(`
      *,
      creator:profiles!service_closures_created_by_fkey (
        id,
        full_name,
        email
      )
    `)
    .order('created_at', { ascending: false })
    .limit(MAX_CLOSURES);

  if (activeError) throw activeError;

  const allClosures = allClosuresData || [];

  if (allClosures.length === 0) return [];

  // Fetch closure->service links only for the most recent subset to avoid UI freezes
  const closureIdsForServiceLinks = allClosures
    .slice(0, MAX_CLOSURES_WITH_SERVICE_LINKS)
    .map(c => c.id);

  let servicesByClosureId = new Map<string, { service_id: string }[]>();

  if (closureIdsForServiceLinks.length > 0) {
    const { data: closureServicesSubset, error: servicesError } = await supabase
      .from('closure_services')
      .select('closure_id, service_id')
      .in('closure_id', closureIdsForServiceLinks);

    if (servicesError) {
      logger.warn('Error fetching closure services batch:', servicesError);
    } else {
      servicesByClosureId = new Map<string, { service_id: string }[]>();
      (closureServicesSubset || []).forEach(cs => {
        if (!servicesByClosureId.has(cs.closure_id)) {
          servicesByClosureId.set(cs.closure_id, []);
        }
        servicesByClosureId.get(cs.closure_id)!.push(cs);
      });
    }
  }

  // Conteo real de servicios por cierre, agregado en la base de datos.
  const serviceCountByClosureId = new Map<string, number>();
  const { data: closureCounts, error: countError } = await supabase
    .rpc('get_closure_service_counts');

  if (countError) {
    logger.warn('Error fetching closure service counts:', countError);
  } else {
    (closureCounts || []).forEach((row: { closure_id: string; service_count: number }) => {
      serviceCountByClosureId.set(row.closure_id, Number(row.service_count) || 0);
    });
  }

  const closuresWithServices = allClosures.map(closure => ({
    ...closure,
    closure_services: servicesByClosureId.get(closure.id) || []
  }));

  return closuresWithServices.map((closure) => {
    try {
      return {
        ...formatClosureData(closure),
        serviceCount: serviceCountByClosureId.get(closure.id) ?? 0,
      };
    } catch (formatError) {
      return {
        id: closure.id,
        folio: closure.folio || 'N/A',
        serviceIds: [],
        serviceCount: serviceCountByClosureId.get(closure.id) ?? 0,
        dateRange: {
          from: closure.date_from,
          to: closure.date_to
        },
        clientId: closure.client_id || undefined,
        total: Number(closure.total) || 0,
        status: closure.status as ServiceClosure['status'] || 'open',
        createdAt: closure.created_at,
        updatedAt: closure.updated_at
      };
    }
  });
};

export const useClosureData = () => {
  const queryClient = useQueryClient();

  const { data: closures = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['closures'],
    queryFn: fetchClosures,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const addClosure = (closure: ServiceClosure) => {
    queryClient.setQueryData<ServiceClosure[]>(['closures'], (old) => 
      old ? [closure, ...old] : [closure]
    );
  };

  const updateClosure = (id: string, updates: Partial<ServiceClosure>) => {
    queryClient.setQueryData<ServiceClosure[]>(['closures'], (old) => 
      old ? old.map(c => c.id === id ? { ...c, ...updates } : c) : []
    );
  };

  const removeClosure = (id: string) => {
    queryClient.setQueryData<ServiceClosure[]>(['closures'], (old) => 
      old ? old.filter(c => c.id !== id) : []
    );
  };

  return {
    closures,
    loading,
    addClosure,
    updateClosure,
    removeClosure,
    refetch: async () => { await refetch(); }
  };
};

import { useState, useEffect } from 'react';
import { ServiceClosure } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatClosureData } from '@/utils/closureUtils';

export const useClosureData = () => {
  const [closures, setClosures] = useState<ServiceClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const MAX_CLOSURES = 500;

  const fetchClosures = async () => {
    try {
      const { data: basicClosures, error: basicError } = await supabase
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

      if (basicError) {
        throw basicError;
      }

      if (!basicClosures || basicClosures.length === 0) {
        setClosures([]);
        setLoading(false);
        return;
      }

      // Batch query: get ALL closure_services in a single request
      const allClosureIds = basicClosures.map(c => c.id);
      const { data: allClosureServices, error: servicesError } = await supabase
        .from('closure_services')
        .select('closure_id, service_id')
        .in('closure_id', allClosureIds);

      if (servicesError) {
        console.warn('Error fetching closure services batch:', servicesError);
      }

      // Group services by closure_id in memory
      const servicesByClosureId = new Map<string, { service_id: string }[]>();
      (allClosureServices || []).forEach(cs => {
        if (!servicesByClosureId.has(cs.closure_id)) {
          servicesByClosureId.set(cs.closure_id, []);
        }
        servicesByClosureId.get(cs.closure_id)!.push(cs);
      });

      const closuresWithServices = basicClosures.map(closure => ({
        ...closure,
        closure_services: servicesByClosureId.get(closure.id) || []
      }));

      const formattedClosures: ServiceClosure[] = closuresWithServices.map((closure) => {
        try {
          return formatClosureData(closure);
        } catch (formatError) {
          return {
            id: closure.id,
            folio: closure.folio || 'N/A',
            serviceIds: [],
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

      setClosures(formattedClosures);
    } catch (error: any) {
      console.error('Error fetching closures:', error);
      toast.error("Error", {
        description: `No se pudieron cargar los cierres: ${error.message}`,
      });
      setClosures([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosures();
  }, []);

  const addClosure = (closure: ServiceClosure) => {
    setClosures(prev => [closure, ...prev]);
  };

  const updateClosure = (id: string, updates: Partial<ServiceClosure>) => {
    setClosures(prev => prev.map(closure => 
      closure.id === id 
        ? { ...closure, ...updates }
        : closure
    ));
  };

  const removeClosure = (id: string) => {
    setClosures(prev => prev.filter(closure => closure.id !== id));
  };

  return {
    closures,
    loading,
    addClosure,
    updateClosure,
    removeClosure,
    refetch: fetchClosures
  };
};

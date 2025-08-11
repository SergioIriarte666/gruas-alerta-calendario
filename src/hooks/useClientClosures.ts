import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ServiceClosure } from '@/types';
import { toast } from 'sonner';

export const useClientClosures = (clientId: string | null) => {
  const [closures, setClosures] = useState<ServiceClosure[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClosuresByClient = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_closures')
        .select(`
          *,
          closure_services (
            service_id,
            services (
              id, folio, client_id
            )
          )
        `)
        .eq('client_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedClosures: ServiceClosure[] = data.map(closure => ({
        id: closure.id,
        folio: closure.folio,
        serviceIds: closure.closure_services?.map((cs: any) => cs.service_id) || [],
        dateRange: {
          from: closure.date_from,
          to: closure.date_to,
        },
        clientId: closure.client_id,
        total: Number(closure.total),
        status: closure.status as ServiceClosure['status'],
        createdAt: closure.created_at,
        updatedAt: closure.updated_at,
      }));
      
      setClosures(formattedClosures);
    } catch (error: any) {
      console.error('Error fetching client closures:', error);
      toast.error("Error", {
        description: "No se pudieron cargar los cierres del cliente.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clientId) {
      fetchClosuresByClient(clientId);
    } else {
      setClosures([]);
      setLoading(false);
    }
  }, [clientId, fetchClosuresByClient]);

  const closureMetrics = {
    totalClosures: closures.length,
    totalAmount: closures.reduce((sum, c) => sum + c.total, 0),
    openClosures: closures.filter(c => c.status === 'open').length,
    closedClosures: closures.filter(c => c.status === 'closed').length,
    invoicedClosures: closures.filter(c => c.status === 'invoiced').length,
  };

  return { 
    closures, 
    loading, 
    metrics: closureMetrics, 
    refetch: () => clientId && fetchClosuresByClient(clientId) 
  };
};
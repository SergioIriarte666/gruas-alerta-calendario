
import { useState, useEffect } from 'react';
import { ServiceClosure } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatClosureData } from '@/utils/closureUtils';

export const useClosuresForInvoices = () => {
  const [closures, setClosures] = useState<ServiceClosure[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClosures = async () => {
    try {
      setLoading(true);
      
      // Fetch only closed closures that are not yet invoiced
      const { data: closuresData, error: closuresError } = await supabase
        .from('service_closures')
        .select(`
          *,
          closure_services (
            service_id
          )
        `)
        .eq('status', 'closed')
        .order('created_at', { ascending: false });

      if (closuresError) {
        if (closuresError.message.includes('permission denied') || closuresError.message.includes('row-level security')) {
          toast.error("Permisos insuficientes", {
            description: "No tienes permisos para ver los cierres. Contacta a un administrador.",
          });
          setClosures([]);
          return;
        }
        throw closuresError;
      }

      // Check which closures are already invoiced
      const { data: invoicedClosures, error: invoicedError } = await supabase
        .from('invoice_closures')
        .select('closure_id');

      if (invoicedError && !invoicedError.message.includes('permission denied')) {
        console.warn('Could not fetch invoiced closures:', invoicedError);
      }

      const invoicedClosureIds = new Set(
        invoicedClosures?.map(ic => ic.closure_id) || []
      );

      // Filter out already invoiced closures
      const availableClosures = closuresData?.filter(
        closure => !invoicedClosureIds.has(closure.id)
      ) || [];

      const formattedClosures: ServiceClosure[] = availableClosures.map(formatClosureData);
      
      setClosures(formattedClosures);
    } catch (error: any) {
      console.error('Error fetching closures for invoices:', error);
      if (!error.message?.includes('permission denied')) {
        toast.error("Error", {
          description: "No se pudieron cargar los cierres disponibles para facturación.",
        });
      }
      setClosures([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosures();
  }, []);

  return {
    closures,
    loading,
    refetch: fetchClosures
  };
};


import { useState, useEffect } from 'react';
import { ServiceClosure } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatClosureData } from '@/utils/closureUtils';

export const useClosuresForInvoices = () => {
  const [closures, setClosures] = useState<ServiceClosure[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchClosuresForInvoices = async () => {
    try {
      setLoading(true);
      
      // Obtener todos los cierres cerrados
      const { data: allClosures, error: closuresError } = await supabase
        .from('service_closures')
        .select(`
          *,
          closure_services(service_id)
        `)
        .eq('status', 'closed')
        .order('created_at', { ascending: false });

      if (closuresError) throw closuresError;

      // Obtener todos los closure_ids que ya están facturados
      const { data: invoicedClosures, error: invoicedError } = await supabase
        .from('invoice_closures')
        .select('closure_id');

      if (invoicedError) throw invoicedError;

      const invoicedClosureIds = new Set(invoicedClosures?.map(ic => ic.closure_id) || []);

      // Filtrar cierres que NO han sido facturados
      const availableClosures = allClosures?.filter(closure => 
        !invoicedClosureIds.has(closure.id)
      ) || [];

      const formattedClosures: ServiceClosure[] = availableClosures.map(formatClosureData);
      setClosures(formattedClosures);
    } catch (error: any) {
      console.error('Error fetching closures for invoices:', error);
      toast.error("Error", {
        description: "No se pudieron cargar los cierres para facturación.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosuresForInvoices();
  }, []);

  return {
    closures,
    loading,
    refetch: fetchClosuresForInvoices
  };
};

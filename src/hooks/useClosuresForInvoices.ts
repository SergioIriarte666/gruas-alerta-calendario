
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
      
      // Solo obtener cierres cerrados que no han sido facturados
      const { data, error } = await supabase
        .from('service_closures')
        .select(`
          *,
          closure_services(service_id)
        `)
        .eq('status', 'closed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedClosures: ServiceClosure[] = data.map(formatClosureData);
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

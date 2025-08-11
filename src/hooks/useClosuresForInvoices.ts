
import { useState, useEffect, useMemo } from 'react';
import { ServiceClosure } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatClosureData } from '@/utils/closureUtils';

interface UseClosuresForInvoicesProps {
  includeInvoiced?: boolean; // For editing existing invoices
}

export const useClosuresForInvoices = (options: UseClosuresForInvoicesProps = {}) => {
  const [allClosures, setAllClosures] = useState<ServiceClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const { includeInvoiced = false } = options;

  const fetchClosures = async () => {
    try {
      console.log('Fetching closures for invoices, includeInvoiced:', includeInvoiced);
      setLoading(true);
      
      // Build query based on mode
      let query = supabase
        .from('service_closures')
        .select(`
          *,
          closure_services (
            service_id
          )
        `);

      // For editing mode, include both closed and invoiced closures
      // For creation mode, only include closed closures
      if (includeInvoiced) {
        query = query.in('status', ['closed', 'invoiced']);
        console.log('Edit mode: fetching closed AND invoiced closures');
      } else {
        query = query.eq('status', 'closed');
        console.log('Create mode: fetching only closed closures');
      }

      const { data: closuresData, error: closuresError } = await query
        .order('created_at', { ascending: false });

      if (closuresError) {
        console.error('Error fetching closures:', closuresError);
        if (closuresError.message.includes('permission denied') || closuresError.message.includes('row-level security')) {
          toast.error("Permisos insuficientes", {
            description: "No tienes permisos para ver los cierres. Contacta a un administrador.",
          });
          setAllClosures([]);
          return;
        }
        throw closuresError;
      }

      console.log('Fetched closures data:', closuresData?.length || 0, 'closures');

      // Format all closures
      const formattedClosures: ServiceClosure[] = (closuresData || []).map(formatClosureData);
      setAllClosures(formattedClosures);
      
    } catch (error: any) {
      console.error('Error fetching closures for invoices:', error);
      if (!error.message?.includes('permission denied')) {
        toast.error("Error", {
          description: "No se pudieron cargar los cierres disponibles para facturación.",
        });
      }
      setAllClosures([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosures();
  }, [includeInvoiced]); // Re-fetch when mode changes

  const [filteredClosures, setFilteredClosures] = useState<ServiceClosure[]>([]);

  // Filter closures based on mode
  useEffect(() => {
    const filterClosures = async () => {
      if (includeInvoiced) {
        // For editing, return all closures (already invoiced or not)
        console.log('Edit mode: including all closures', allClosures.length);
        setFilteredClosures(allClosures);
        return;
      }

      // For creating new invoices, filter out already invoiced closures
      try {
        const { data: invoicedClosures, error: invoicedError } = await supabase
          .from('invoice_closures')
          .select('closure_id');

        if (invoicedError && !invoicedError.message.includes('permission denied')) {
          console.warn('Could not fetch invoiced closures:', invoicedError);
          setFilteredClosures(allClosures); // Return all if we can't check
          return;
        }

        const invoicedClosureIds = new Set(
          invoicedClosures?.map(ic => ic.closure_id) || []
        );

        const availableClosures = allClosures.filter(
          closure => !invoicedClosureIds.has(closure.id)
        );

        console.log('Available closures for new invoicing:', availableClosures.length);
        setFilteredClosures(availableClosures);
      } catch (error) {
        console.error('Error filtering closures:', error);
        setFilteredClosures(allClosures);
      }
    };

    if (allClosures.length > 0) {
      filterClosures();
    }
  }, [allClosures, includeInvoiced]);

  return {
    closures: filteredClosures,
    loading,
    refetch: fetchClosures
  };
};


import { useState, useEffect } from 'react';
import { ServiceClosure } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatClosureData } from '@/utils/closureUtils';

export const useClosureData = () => {
  const [closures, setClosures] = useState<ServiceClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchClosures = async () => {
    try {
      console.log('Fetching closures...');
      
      // First, let's try to fetch closures without the join to see if basic data works
      const { data: basicClosures, error: basicError } = await supabase
        .from('service_closures')
        .select('*')
        .order('created_at', { ascending: false });

      if (basicError) {
        console.error('Error fetching basic closures:', basicError);
        throw basicError;
      }

      console.log('Basic closures data:', basicClosures);

      if (!basicClosures || basicClosures.length === 0) {
        console.log('No closures found in database');
        setClosures([]);
        setLoading(false);
        return;
      }

      // Now try to get the closure services for each closure
      const closuresWithServices = await Promise.all(
        basicClosures.map(async (closure) => {
          try {
            const { data: closureServices, error: servicesError } = await supabase
              .from('closure_services')
              .select('service_id')
              .eq('closure_id', closure.id);

            if (servicesError) {
              console.warn(`Error fetching services for closure ${closure.id}:`, servicesError);
              // Continue with empty services array
              return {
                ...closure,
                closure_services: []
              };
            }

            return {
              ...closure,
              closure_services: closureServices || []
            };
          } catch (error) {
            console.warn(`Error processing closure ${closure.id}:`, error);
            return {
              ...closure,
              closure_services: []
            };
          }
        })
      );

      console.log('Closures with services:', closuresWithServices);

      const formattedClosures: ServiceClosure[] = closuresWithServices.map((closure) => {
        try {
          return formatClosureData(closure);
        } catch (formatError) {
          console.error('Error formatting closure:', closure, formatError);
          // Return a basic formatted closure in case of error
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

      console.log('Formatted closures:', formattedClosures);
      setClosures(formattedClosures);
    } catch (error: any) {
      console.error('Error fetching closures:', error);
      toast({
        title: "Error",
        description: `No se pudieron cargar los cierres: ${error.message}`,
        variant: "destructive",
      });
      // Set empty array on error so the page doesn't stay loading
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


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
      const { data, error } = await supabase
        .from('service_closures')
        .select(`
          *,
          closure_services(service_id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('Raw closures data:', data);

      const formattedClosures: ServiceClosure[] = data.map(formatClosureData);

      console.log('Formatted closures:', formattedClosures);
      setClosures(formattedClosures);
    } catch (error: any) {
      console.error('Error fetching closures:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los cierres.",
        variant: "destructive",
      });
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

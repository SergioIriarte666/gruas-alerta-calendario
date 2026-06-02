
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Cost } from '@/types/costs';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useCraneCosts");
export const useCraneCosts = (craneId: string) => {
  return useQuery({
    queryKey: ['crane-costs', craneId],
    queryFn: async (): Promise<Cost[]> => {
      const { data, error } = await supabase
        .from('costs')
        .select(`
          *,
          cost_categories (*),
          operators (*),
          services (*, clients!services_client_id_fkey(*))
        `)
        .eq('crane_id', craneId)
        .order('date', { ascending: false });

      if (error) {
        logger.error('Error fetching crane costs:', error);
        throw error;
      }

      return (data as any) || [];
    },
    enabled: !!craneId
  });
};

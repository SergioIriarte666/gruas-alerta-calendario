import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useOperatorLinkedProfile');

export interface LinkedProfile {
  id: string;
  email: string;
  role: string;
  status: string;
  full_name: string | null;
}

export function useOperatorLinkedProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['operator-linked-profile', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<LinkedProfile | null> => {
      if (!userId) return null;
      const { data, error } = await supabase.rpc('get_operator_linked_profile', {
        p_user_id: userId,
      });

      if (error) {
        logger.error('Error fetching linked profile', { userId, error });
        throw error;
      }
      return data?.[0] ?? null;
    },
  });
}

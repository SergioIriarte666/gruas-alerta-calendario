import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('usePendingUsersCount');

export const usePendingUsersCount = (enabled: boolean) => {
  return useQuery({
    queryKey: ['pending-users-count'],
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pending_users_count');
      if (error) {
        logger.warn('[usePendingUsersCount] error:', error.message);
        return 0;
      }
      return (data as number) ?? 0;
    },
  });
};

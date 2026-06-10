import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type { PendingUser } from '@/types/pendingUsers';

const logger = createLogger('PendingUsersFetcher');

export function usePendingUsersFetcher() {
  return useQuery<PendingUser[]>({
    queryKey: ['pending-users'],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      logger.info('Fetching pending users');
      const { data, error } = await supabase.rpc('get_pending_users');
      if (error) throw error;
      return (data ?? []) as PendingUser[];
    },
  });
}

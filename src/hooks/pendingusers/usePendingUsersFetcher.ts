import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type { PendingUser } from '@/types/pendingUsers';

const logger = createLogger('PendingUsersFetcher');

export function usePendingUsersFetcher() {
  return useQuery<PendingUser[]>({
    queryKey: ['pending-users'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      logger.info('Fetching pending users');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, company, rut, created_at, status')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PendingUser[];
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays } from 'date-fns';
import { getBusinessTimezone, getTodayStringInTimezone, safeParseDateOnly } from '@/utils/timezoneUtils';
import { toLocalDateString } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useUpcomingServicesCount");
const ACTIVE_STATUSES = [
  'pending',
  'quoted',
  'purchase_order_pending',
  'with_purchase_order',
  'in_progress',
] as const;

/**
 * Counts services scheduled for today and tomorrow with an active status.
 * Used to render a sidebar badge that surfaces imminent operational load.
 */
export const useUpcomingServicesCount = () => {
  return useQuery({
    queryKey: ['upcomingServicesCount'],
    queryFn: async () => {
      const tz = await getBusinessTimezone();
      const todayStr = getTodayStringInTimezone(tz);
      const tomorrowStr = toLocalDateString(addDays(safeParseDateOnly(todayStr), 1));

      const { count, error } = await supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .in('service_date', [todayStr, tomorrowStr])
        .in('status', ACTIVE_STATUSES);

      if (error) {
        logger.warn('[useUpcomingServicesCount] error:', error.message);
        return 0;
      }
      return count ?? 0;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
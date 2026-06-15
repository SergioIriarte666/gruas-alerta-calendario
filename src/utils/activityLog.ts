import { supabase } from '@/integrations/supabase/client';

interface LogUserActivityParams {
  userId: string;
  eventType: string;
  path?: string | null;
  metadata?: Record<string, unknown> | null;
}

export const logUserActivity = async ({
  userId,
  eventType,
  path,
  metadata = null,
}: LogUserActivityParams) => {
  await supabase
    .from('user_activity_log')
    .insert({
      user_id: userId,
      event_type: eventType,
      path: path ?? null,
      metadata,
    });
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { createLogger } from '@/lib/logger';
import { toast } from 'sonner';

const logger = createLogger('useDismissibleNotice');

export interface UseDismissibleNoticeResult {
  isDismissed: boolean;
  isLoading: boolean;
  dismiss: () => void;
  restore: () => void;
}

export function useDismissibleNotice(
  noticeKey: string,
  version: string = 'v1'
): UseDismissibleNoticeResult {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const queryKey = ['dismissed-notice', userId, noticeKey];

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_dismissed_notices')
        .select('version, dismissed_at')
        .eq('user_id', userId!)
        .eq('notice_key', noticeKey)
        .maybeSingle();
      if (error) {
        logger.error('Fetch dismissed notice failed', { noticeKey, error });
        throw error;
      }
      return data;
    },
  });

  // isDismissed = existe registro Y su versión coincide con la actual.
  // Si la versión cambia (texto nuevo), reaparece.
  const isDismissed = !!data && data.version === version;

  const dismissMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('No hay sesión activa');
      const { error } = await supabase
        .from('user_dismissed_notices')
        .upsert(
          { user_id: userId, notice_key: noticeKey, version },
          { onConflict: 'user_id,notice_key' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: any) => {
      logger.error('Dismiss notice failed', { noticeKey, error });
      toast.error('No se pudo ocultar el aviso');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('No hay sesión activa');
      const { error } = await supabase
        .from('user_dismissed_notices')
        .delete()
        .eq('user_id', userId)
        .eq('notice_key', noticeKey);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: any) => {
      logger.error('Restore notice failed', { noticeKey, error });
      toast.error('No se pudo restaurar el aviso');
    },
  });

  return {
    isDismissed,
    isLoading,
    dismiss: () => dismissMutation.mutate(),
    restore: () => restoreMutation.mutate(),
  };
}

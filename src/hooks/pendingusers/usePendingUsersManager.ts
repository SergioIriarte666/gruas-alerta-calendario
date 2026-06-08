import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('PendingUsersManager');

export function usePendingUsersManager() {
  const queryClient = useQueryClient();

  const approveUser = useMutation({
    mutationFn: async (userId: string) => {
      logger.info('Approving user', userId);
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'approved', role: 'viewer' })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Usuario aprobado');
      queryClient.invalidateQueries({ queryKey: ['pending-users'] });
      queryClient.invalidateQueries({ queryKey: ['pending-users-count'] });
    },
    onError: (err: Error) => {
      logger.error('Error approving user', err);
      toast.error('Error al aprobar usuario');
    },
  });

  const rejectUser = useMutation({
    mutationFn: async (userId: string) => {
      logger.info('Rejecting user', userId);
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'rejected' })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Usuario rechazado');
      queryClient.invalidateQueries({ queryKey: ['pending-users'] });
      queryClient.invalidateQueries({ queryKey: ['pending-users-count'] });
    },
    onError: (err: Error) => {
      logger.error('Error rejecting user', err);
      toast.error('Error al rechazar usuario');
    },
  });

  return { approveUser, rejectUser };
}

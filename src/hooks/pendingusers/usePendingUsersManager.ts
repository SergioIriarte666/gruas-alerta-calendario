import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('PendingUsersManager');

export type PendingApprovalRole = 'admin' | 'operator' | 'viewer' | 'client';

interface ApprovePendingUserPayload {
  userId: string;
  role: PendingApprovalRole;
  clientId?: string | null;
}

export function usePendingUsersManager() {
  const queryClient = useQueryClient();

  const approveUser = useMutation({
    mutationFn: async ({ userId, role, clientId }: ApprovePendingUserPayload) => {
      logger.info('Approving user', { userId, role, clientId });

      if (role === 'client' && !clientId) {
        throw new Error('Debes asignar un cliente antes de aprobar a un usuario cliente');
      }

      const { error } = await supabase.rpc('approve_pending_user', {
        target_user_id: userId,
        new_role: role,
        target_client_id: role === 'client' ? clientId ?? null : null,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success('Usuario aprobado', {
        description:
          variables.role === 'client'
            ? 'El usuario ya puede ingresar con su cliente asociado.'
            : 'El usuario ya puede ingresar con el rol asignado.',
      });
      queryClient.invalidateQueries({ queryKey: ['pending-users'] });
      queryClient.invalidateQueries({ queryKey: ['pending-users-count'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (err: Error) => {
      logger.error('Error approving user', err);
      toast.error('Error al aprobar usuario', {
        description: err.message || 'No se pudo completar la aprobación.',
      });
    },
  });

  const rejectUser = useMutation({
    mutationFn: async (userId: string) => {
      logger.info('Rejecting user', userId);
      const { error } = await supabase.rpc('reject_pending_user', {
        target_user_id: userId,
      });
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

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

      const { error: roleError } = await supabase.rpc('update_user_role', {
        target_user_id: userId,
        new_role: role,
      });

      if (roleError) throw roleError;

      const { error: clientError } = await supabase.rpc('assign_user_client', {
        target_user_id: userId,
        target_client_id: role === 'client' ? clientId ?? null : null,
      });

      if (clientError) throw clientError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          status: 'approved',
          role,
          client_id: role === 'client' ? clientId ?? null : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) throw profileError;
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

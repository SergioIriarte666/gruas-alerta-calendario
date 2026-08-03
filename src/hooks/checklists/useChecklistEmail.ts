import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Checklists');

/** Estados de la fila del outbox, tal como los escribe el worker. */
export type ChecklistEmailStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';

export interface ChecklistEmailState {
  status: ChecklistEmailStatus;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
}

/** Resultado del RPC de encolado. */
export type EnqueueResult =
  | 'queued'
  | 'already_queued'
  | 'pdf_missing'
  | 'not_signed'
  | 'not_found';

/**
 * Estado del envío por correo de un checklist.
 *
 * Pasa por RPC y no por un SELECT a `notification_outbox`: esa tabla tiene RLS
 * con una única política de SELECT para admin, así que un operador no vería
 * nunca el estado de su propio envío.
 */
export const useChecklistEmailStatus = (checklistId?: string | null, enabled = true) => {
  const query = useQuery({
    queryKey: ['checklist-email-status', checklistId],
    enabled: Boolean(checklistId) && enabled,
    staleTime: 15 * 1000,
    queryFn: async (): Promise<ChecklistEmailState | null> => {
      const { data, error } = await supabase.rpc('get_checklist_email_status', {
        p_checklist_id: checklistId as string,
      });

      if (error) {
        logger.error('Error consultando el estado del correo del checklist:', error);
        throw error;
      }
      // RETURNS TABLE devuelve un arreglo aunque traiga una sola fila.
      return (data as ChecklistEmailState[])?.[0] ?? null;
    },
  });

  return {
    emailState: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};

export const useChecklistEmailSender = () => {
  const queryClient = useQueryClient();

  /**
   * Encola el envío. La idempotencia vive en el RPC, no acá: dos toques seguidos
   * no pueden meter dos filas porque la comprobación y el INSERT ocurren en la
   * misma transacción.
   */
  const enqueue = useMutation({
    mutationFn: async ({ checklistId }: { checklistId: string; silent?: boolean }): Promise<EnqueueResult> => {
      const { data, error } = await supabase.rpc('enqueue_checklist_email', {
        p_checklist_id: checklistId,
      });

      if (error) {
        logger.error('Error encolando el correo del checklist:', error);
        throw error;
      }
      return data as EnqueueResult;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['checklist-email-status', variables.checklistId] });

      if (variables.silent) return;

      switch (result) {
        case 'queued':
          toast.success('Correo encolado', {
            description: 'Se enviará a la casilla de la empresa en los próximos minutos.',
          });
          break;
        case 'already_queued':
          toast.info('Ya hay un envío en curso para este checklist');
          break;
        case 'pdf_missing':
          toast.error('Primero genere el PDF', {
            description: 'El correo se envía con el PDF adjunto.',
          });
          break;
        case 'not_signed':
          toast.error('El checklist debe estar firmado');
          break;
        default:
          toast.error('No se pudo encolar el correo');
      }
    },
    onError: (_error, variables) => {
      if (!variables?.silent) toast.error('No se pudo encolar el correo');
    },
  });

  return { enqueue, isEnqueueing: enqueue.isPending };
};

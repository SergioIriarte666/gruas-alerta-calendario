import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ComisionManualForm');

export interface CreateManualCommissionInput {
  date: string;
  operatorId: string;
  amount: number;
  description: string;
  notes?: string;
  serviceFolio?: string;
  craneId?: string;
}

export const useCreateManualCommission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateManualCommissionInput) => {
      const { data, error } = await supabase.rpc('create_manual_commission', {
        p_date: input.date,
        p_operator_id: input.operatorId,
        p_amount: input.amount,
        p_description: input.description,
        p_notes: input.notes || null,
        p_service_folio: input.serviceFolio || '9999',
        p_crane_id: input.craneId || null,
      });

      if (error) {
        logger.error('Error creando comisión manual:', error);
        throw new Error(error.message);
      }

      return data as string;
    },
    onSuccess: () => {
      toast.success('Comisión manual registrada correctamente');
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
    },
    onError: (error: Error) => {
      logger.error('Error en mutation de comisión manual:', error);
      toast.error(error.message || 'No se pudo registrar la comisión manual');
    },
  });
};

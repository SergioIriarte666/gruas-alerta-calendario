import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatForDatabase } from '@/utils/timezoneUtils';

interface UpdateCommissionPaymentDateParams {
  commissionIds: string[];
  paymentDate: Date;
  paymentBatchId?: string;
}

export const useCommissionPayments = () => {
  const queryClient = useQueryClient();

  const updatePaymentDateMutation = useMutation({
    mutationFn: async ({ commissionIds, paymentDate, paymentBatchId }: UpdateCommissionPaymentDateParams) => {
      console.log('🔄 [useCommissionPayments] Actualizando fechas de pago:', {
        commissionIds,
        paymentDate,
        paymentBatchId
      });

      const { data, error } = await supabase.rpc('update_commission_payment_date', {
        p_commission_ids: commissionIds,
        p_payment_date: formatForDatabase(paymentDate), // Usar utilidad de zona horaria
        p_payment_batch_id: paymentBatchId
      });

      if (error) {
        console.error('❌ [useCommissionPayments] Error updating payment dates:', error);
        throw error;
      }

      console.log('✅ [useCommissionPayments] Payment dates updated successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      // Invalidar queries relacionadas con comisiones
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      
      // Verificar que data es un objeto y tiene la propiedad updated_count
      const result = data as any;
      const updatedCount = result?.updated_count || 0;
      
      toast.success(
        "Fechas de Pago Actualizadas", 
        { 
          description: `Se actualizaron ${updatedCount} comisiones con la fecha de pago.` 
        }
      );
    },
    onError: (error: any) => {
      console.error('[useCommissionPayments] Error updating payment dates:', error);
      toast.error(
        "Error al Actualizar Fechas", 
        { description: error.message || "No se pudieron actualizar las fechas de pago" }
      );
    },
  });

  return {
    updateCommissionPaymentDate: updatePaymentDateMutation.mutate,
    isUpdatingPaymentDate: updatePaymentDateMutation.isPending
  };
};
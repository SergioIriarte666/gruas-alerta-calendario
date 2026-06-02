import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useSubmitPurchaseOrder');

interface SubmitOCPayload {
  serviceId: string;
  purchaseOrderNumber: string;
  quoteNumber?: string;
  notes?: string;
}

export const useSubmitPurchaseOrder = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serviceId, purchaseOrderNumber, quoteNumber }: SubmitOCPayload) => {
      const updateData: Record<string, unknown> = {
        purchase_order_number: purchaseOrderNumber.trim(),
        status: 'pending',
        updated_at: new Date().toISOString(),
      };

      if (quoteNumber?.trim()) {
        updateData.quote_number = quoteNumber.trim();
      }

      const { error } = await supabase
        .from('services')
        .update(updateData)
        .eq('id', serviceId);

      if (error) {
        logger.error('Error submitting purchase order:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientServices', user?.client_id] });
      toast.success('Orden de compra enviada', {
        description: 'Nuestro equipo la procesara en breve.',
      });
    },
    onError: () => {
      toast.error('No se pudo enviar la orden de compra', {
        description: 'Intentalo de nuevo en unos momentos.',
      });
    },
  });
};

export type { SubmitOCPayload };

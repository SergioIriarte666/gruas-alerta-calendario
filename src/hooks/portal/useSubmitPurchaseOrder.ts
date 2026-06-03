import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useClientBranding } from '@/hooks/portal/useClientBranding';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useSubmitPurchaseOrder');

interface SubmitOCPayload {
  serviceId: string;
  purchaseOrderNumber: string;
  quoteNumber?: string;
  serviceFolio: string;
  serviceValue: number;
  clientCompanyName: string;
}

const formatCLP = (value: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);

export const useSubmitPurchaseOrder = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { data: branding } = useClientBranding();

  return useMutation({
    mutationFn: async ({
      serviceId,
      purchaseOrderNumber,
      quoteNumber,
      serviceFolio,
      serviceValue,
      clientCompanyName,
    }: SubmitOCPayload) => {
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

      try {
        const descripcion = quoteNumber?.trim()
          ? `OC ${purchaseOrderNumber.trim()} · Cotizacion ${quoteNumber.trim()} · Servicio ${serviceFolio}`
          : `OC ${purchaseOrderNumber.trim()} · Servicio ${serviceFolio}`;

        await supabase.functions.invoke('send-whatsapp-admin', {
          body: {
            event: 'admin_orden_compra',
            data: {
              proveedor: clientCompanyName || branding?.companyName || 'Cliente',
              monto: formatCLP(serviceValue),
              descripcion,
            },
          },
        });

        logger.debug('Notificacion WhatsApp enviada al admin para OC:', purchaseOrderNumber);
      } catch (waError) {
        logger.warn('WhatsApp admin notification failed (non-critical):', waError);
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

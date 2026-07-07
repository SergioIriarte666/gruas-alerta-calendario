import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";

const logger = createLogger("useInvoiceEmail");

interface InvoiceEmailData {
  invoiceId: string;
  clientEmail: string;
  clientName: string;
  folio: string;
  issueDate: string;
  dueDate: string;
  total: number;
  services: Array<{
    folio: string;
    serviceDate: string;
    serviceType: string;
    value: number;
  }>;
}

interface OverdueNotificationData {
  invoiceId: string;
  folio: string;
}

export const useInvoiceEmail = () => {
  const queryClient = useQueryClient();

  const sendMutation = useMutation({
    mutationFn: async (invoiceData: InvoiceEmailData) => {
      logger.debug('Enviando factura por email:', invoiceData.folio);
      const result = await supabase.functions.invoke('send-invoice-email', {
        body: invoiceData
      });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (_data, variables) => {
      toast.success("Factura enviada", {
        description: `La factura ${variables.folio} ha sido enviada por email a ${variables.clientEmail}`,
      });
    },
    onError: (error: any) => {
      logger.error('Error enviando factura por email:', error);
      toast.error("Error al enviar factura", {
        description: "No se pudo enviar la factura por email. Verifica la direccion de email del cliente.",
      });
    },
  });

  const overdueMutation = useMutation({
    mutationFn: async (data: OverdueNotificationData) => {
      logger.debug('Enviando notificacion de factura vencida:', data.folio);
      const result = await supabase.functions.invoke('send-invoice-overdue-notification', {
        body: data
      });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-email-log'] });
      const sentTo = data?.sentTo || [];
      const count = Array.isArray(sentTo) ? sentTo.length : 0;
      toast.success("Notificacion enviada", {
        description: `Se ha notificado a ${count} destinatario${count !== 1 ? 's' : ''} que la factura ${variables.folio} esta vencida.`,
      });
    },
    onError: (error: any) => {
      logger.error('Error enviando notificacion de factura vencida:', error);
      toast.error("Error al enviar notificacion", {
        description: error?.message || "No se pudo enviar la notificacion de vencimiento.",
      });
    },
  });

  return {
    sendInvoiceEmail: sendMutation.mutate,
    isSending: sendMutation.isPending,
    sendOverdueNotification: overdueMutation.mutate,
    isSendingOverdue: overdueMutation.isPending,
  };
};

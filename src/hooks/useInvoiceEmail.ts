
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

export const useInvoiceEmail = () => {
  const sendInvoiceEmail = async (invoiceData: InvoiceEmailData) => {
    try {
      logger.debug('📧 Enviando factura por email:', invoiceData.folio);
      
      const emailResult = await supabase.functions.invoke('send-invoice-email', {
        body: invoiceData
      });

      if (emailResult.error) {
        logger.error('❌ Error enviando factura por email:', emailResult.error);
        toast.error("Error al enviar factura", {
          description: "No se pudo enviar la factura por email. Verifica la dirección de email del cliente.",
        });
        return { success: false, error: emailResult.error };
      } else {
        logger.debug('✅ Factura enviada por email exitosamente');
        toast.success("Factura enviada", {
          description: `La factura ${invoiceData.folio} ha sido enviada por email a ${invoiceData.clientEmail}`,
        });
        return { success: true, data: emailResult.data };
      }
    } catch (error: any) {
      logger.error('❌ Error crítico enviando factura:', error);
      toast.error("Error crítico", {
        description: "Ocurrió un error inesperado al enviar la factura por email.",
      });
      return { success: false, error: error.message };
    }
  };

  return {
    sendInvoiceEmail
  };
};

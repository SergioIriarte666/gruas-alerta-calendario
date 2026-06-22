import { businessClock } from '@/utils/businessClock';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { createLogger } from "@/lib/logger";
import { arrayBufferToBase64 } from '@/utils/base64';


const logger = createLogger("useInspectionEmail");

export const useInspectionEmail = () => {
  const sendInspectionEmailMutation = useMutation({
    mutationFn: async ({ pdfBlob, service, inspection }: {
      pdfBlob: Blob;
      service: any;
      inspection: InspectionFormValues;
    }) => {
      logger.debug('📧 [EMAIL] Enviando inspección por email...');
      
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      
      const emailData = {
        inspectionData: {
          serviceId: service.id,
          folio: service.folio,
          clientName: service.client?.name || 'Cliente',
          clientEmail: service.client?.email || 'cliente@example.com',
          operatorName: service.operator?.name || 'Operador',
          serviceDate: service.serviceDate || businessClock.format(businessClock.now(), 'dd/MM/yyyy'),
          equipmentCount: inspection.equipment?.length || 0,
        },
        pdfBlob: base64,
      };

      logger.debug('📧 [EMAIL] Datos del email:', emailData.inspectionData);

      const { data, error } = await supabase.functions.invoke('send-inspection-email', {
        body: emailData
      });

      if (error) {
        logger.error('❌ [EMAIL] Error invocando función:', error);
        throw new Error(`Error al invocar función de email: ${error.message}`);
      }

      logger.debug('✅ [EMAIL] Función invocada exitosamente:', data);
      return data;
    },
    onSuccess: () => {
      logger.debug('✅ [EMAIL] Email enviado exitosamente');
      toast.success('Inspección enviada por email exitosamente');
    },
    onError: (error) => {
      logger.error('💥 [EMAIL] Error enviando email:', error);
      toast.error(`Error al enviar email: ${error.message}`);
    }
  });

  return { sendInspectionEmailMutation };
};

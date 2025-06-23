
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { InspectionFormValues } from '@/schemas/inspectionSchema';

export const useInspectionEmail = () => {
  const sendInspectionEmailMutation = useMutation({
    mutationFn: async ({ pdfBlob, service, inspection }: {
      pdfBlob: Blob;
      service: any;
      inspection: InspectionFormValues;
    }) => {
      console.log('📧 [EMAIL] Enviando inspección por email...');
      
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      const emailData = {
        inspectionData: {
          serviceId: service.id,
          folio: service.folio,
          clientName: service.client?.name || 'Cliente',
          clientEmail: service.client?.email || 'cliente@example.com',
          operatorName: service.operator?.name || 'Operador',
          serviceDate: service.serviceDate || new Date().toLocaleDateString('es-CL'),
          equipmentCount: inspection.equipment?.length || 0,
        },
        pdfBlob: base64,
      };

      console.log('📧 [EMAIL] Datos del email:', emailData.inspectionData);

      const { data, error } = await supabase.functions.invoke('send-inspection-email', {
        body: emailData
      });

      if (error) {
        console.error('❌ [EMAIL] Error invocando función:', error);
        throw new Error(`Error al invocar función de email: ${error.message}`);
      }

      console.log('✅ [EMAIL] Función invocada exitosamente:', data);
      return data;
    },
    onSuccess: () => {
      console.log('✅ [EMAIL] Email enviado exitosamente');
      toast.success('Inspección enviada por email exitosamente');
    },
    onError: (error) => {
      console.error('💥 [EMAIL] Error enviando email:', error);
      toast.error(`Error al enviar email: ${error.message}`);
    }
  });

  return { sendInspectionEmailMutation };
};

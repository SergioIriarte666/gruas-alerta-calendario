
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useOperatorService } from '@/hooks/useOperatorService';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { useInspectionPDF } from '@/hooks/inspection/useInspectionPDF';
import { useInspectionEmail } from '@/hooks/inspection/useInspectionEmail';
import { useServiceStatusUpdate } from '@/hooks/inspection/useServiceStatusUpdate';

export const useServiceInspection = () => {
  const params = useParams();
  const navigate = useNavigate();
  
  const serviceId = params.id || params.serviceId;
  
  console.log('🎯 Service Inspection Hook - Service ID:', serviceId);
  
  const { data: service, isLoading, error, refetch } = useOperatorService(serviceId || '');
  const { 
    pdfProgress, 
    pdfStep, 
    isGeneratingPDF, 
    pdfDownloadUrl, 
    generatePDF, 
    handleManualDownload,
    cleanupPDF 
  } = useInspectionPDF();
  const { sendInspectionEmailMutation } = useInspectionEmail();
  const { updateServiceStatusMutation } = useServiceStatusUpdate(serviceId);

  console.log('📊 Service Inspection State:', {
    serviceId,
    hasService: !!service,
    serviceFolio: service?.folio,
    isLoading,
    error: error?.message
  });

  const processInspectionMutation = useMutation({
    mutationFn: async (values: InspectionFormValues) => {
      if (!service || !serviceId) {
        throw new Error('No hay datos del servicio disponibles.');
      }
      
      console.log('📋 [PROCESS] Iniciando procesamiento para:', service.folio);
      
      // 1. Generar PDF
      const { blob } = await generatePDF(service, values);
      
      // 2. Intentar enviar email si el cliente tiene email válido
      let emailSent = false;
      if (service.client?.email && service.client.email.includes('@')) {
        try {
          console.log('📧 [PROCESS] Enviando email...');
          await sendInspectionEmailMutation.mutateAsync({
            pdfBlob: blob,
            service,
            inspection: values
          });
          emailSent = true;
        } catch (emailError) {
          console.error('⚠️ [PROCESS] Error en email:', emailError);
          toast.error('PDF generado correctamente, pero no se pudo enviar por email');
        }
      } else {
        console.log('⚠️ [PROCESS] Cliente sin email válido');
        toast.info('PDF generado correctamente. Cliente sin email válido para envío.');
      }
      
      // 3. Limpiar fotos del localStorage
      [...values.photosBeforeService, ...values.photosClientVehicle, ...values.photosEquipmentUsed]
        .forEach(photoName => {
          localStorage.removeItem(`photo-${photoName}`);
        });
      
      console.log('🧹 [PROCESS] Fotos limpiadas del localStorage');
      
      return { values, emailSent };
    },
    onSuccess: async (result) => {
      const { emailSent } = result;
      
      console.log('✅ [PROCESS] Procesamiento completado');
      
      if (emailSent) {
        toast.success('PDF de inspección generado y enviado exitosamente');
      } else {
        toast.success('PDF de inspección generado exitosamente');
      }
      
      // 4. Actualizar estado del servicio INMEDIATAMENTE
      if (serviceId) {
        console.log('🔄 [PROCESS] Actualizando estado del servicio...');
        try {
          await updateServiceStatusMutation.mutateAsync(serviceId);
          console.log('✅ [PROCESS] Estado actualizado exitosamente');
          
          // 5. Navegar al dashboard después de actualizar
          setTimeout(() => {
            console.log('🔄 [PROCESS] Navegando al dashboard...');
            navigate('/operator');
          }, 1500);
        } catch (statusError) {
          console.error('💥 [PROCESS] Error crítico al actualizar estado:', statusError);
          toast.error(`Error crítico: ${statusError.message}`);
        }
      } else {
        console.error('💥 [PROCESS] No hay serviceId para actualizar');
        toast.error('Error: No se pudo identificar el servicio');
      }
    },
    onError: (error: Error) => {
      console.error('💥 [PROCESS] Error en procesamiento:', error);
      toast.error(`Error al procesar la inspección: ${error.message}`);
    },
    onSettled: () => {
      cleanupPDF();
    }
  });

  const handleRetry = () => {
    console.log('🔄 Retrying service fetch...');
    refetch();
  };

  return {
    id: serviceId,
    service,
    isLoading,
    error,
    pdfProgress,
    pdfStep,
    isGeneratingPDF,
    pdfDownloadUrl,
    processInspectionMutation,
    updateServiceStatusMutation,
    sendInspectionEmailMutation,
    handleManualDownload: () => handleManualDownload(service),
    handleRetry,
    navigate
  };
};

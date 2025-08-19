
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useOperatorService } from '@/hooks/useOperatorService';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { useInspectionPDF } from '@/hooks/inspection/useInspectionPDF';
import { useInspectionEmail } from '@/hooks/inspection/useInspectionEmail';
import { useServiceStatusUpdate } from '@/hooks/inspection/useServiceStatusUpdate';

export const useServiceInspection = () => {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
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
    serviceStatus: service?.status,
    isLoading,
    error: error?.message
  });

  const processInspectionMutation = useMutation({
    mutationFn: async ({ values, phase }: { values: InspectionFormValues; phase: 'initial' | 'final' }) => {
      if (!service || !serviceId) {
        throw new Error('No hay datos del servicio disponibles.');
      }
      
      console.log('📋 [PROCESS] Iniciando procesamiento para:', service.folio, 'Fase:', phase);
      
      // 1. Generar PDF (final para fase final, parcial para fase inicial)
      const { blob } = await generatePDF(service, values, phase === 'final');
      
      // 2. Intentar enviar email si el cliente tiene email válido
      let emailSent = false;
      if (service.client?.email && service.client.email.includes('@')) {
        try {
          console.log('📧 [PROCESS] Enviando email de inspección...');
          await sendInspectionEmailMutation.mutateAsync({
            pdfBlob: blob,
            service,
            inspection: values
          });
          emailSent = true;
          console.log('✅ [PROCESS] Email de inspección enviado exitosamente');
        } catch (emailError) {
          console.error('⚠️ [PROCESS] Error en email:', emailError);
          toast.error('PDF generado correctamente, pero no se pudo enviar por email');
        }
      } else {
        console.log('⚠️ [PROCESS] Cliente sin email válido');
        toast.info('PDF generado correctamente. Cliente sin email válido para envío.');
      }
      
      return { values, emailSent, phase };
    },
    onSuccess: async (result) => {
      const { emailSent, phase } = result;
      
      console.log('✅ [PROCESS] Procesamiento completado para fase:', phase);
      
      if (phase === 'initial') {
        if (emailSent) {
          toast.success('PDF de retiro generado y enviado exitosamente');
        } else {
          toast.success('PDF de retiro generado exitosamente');
        }
        
        // Actualizar estado del servicio a inspection_completed
        if (serviceId) {
          console.log('🔄 [PROCESS] Actualizando estado a inspection_completed...');
          try {
            await updateServiceStatusMutation.mutateAsync({ 
              id: serviceId, 
              targetStatus: 'inspection_completed' 
            });
            console.log('✅ [PROCESS] Estado actualizado a inspection_completed');
            
            // Forzar refetch del servicio actual y todas las queries relacionadas
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['operatorService', serviceId] }),
              queryClient.invalidateQueries({ queryKey: ['operatorServices'] }),
              queryClient.invalidateQueries({ queryKey: ['operator-services'] }),
              refetch()
            ]);
            
            toast.success('Inspección inicial completada. Regresando al menú principal...');
            
            // Navegación automática después de completar fase inicial
            setTimeout(() => {
              console.log('🔄 [PROCESS] Navegando al dashboard...');
              navigate('/operator');
            }, 1500);
            
          } catch (statusError) {
            console.error('💥 [PROCESS] Error al actualizar estado:', statusError);
            toast.error(`Error al actualizar estado: ${statusError.message}`);
          }
        }
      } else {
        // Fase final
        if (emailSent) {
          toast.success('PDF de entrega generado y enviado exitosamente');
        } else {
          toast.success('PDF de entrega generado exitosamente');
        }
        
        // Limpiar fotos del localStorage SOLO después de completar TODO
        console.log('🧹 [PROCESS] Limpiando fotos después de completar el servicio...');
        result.values.photographicSet?.forEach(photo => {
          localStorage.removeItem(`photo-${photo.fileName}`);
        });
        
        // Limpiar persistencia de inspección
        localStorage.removeItem(`inspection_${serviceId}`);
        localStorage.removeItem(`inspection_metadata_${serviceId}`);
        
        // Actualizar estado del servicio a completed
        if (serviceId) {
          console.log('🔄 [PROCESS] Actualizando estado a completed...');
          try {
            await updateServiceStatusMutation.mutateAsync({ 
              id: serviceId, 
              targetStatus: 'completed' 
            });
            console.log('✅ [PROCESS] Estado actualizado a completed');
            
            // Forzar refetch de todas las queries antes de navegar
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['operatorServices'] }),
              queryClient.invalidateQueries({ queryKey: ['operator-services'] }),
              queryClient.invalidateQueries({ queryKey: ['operatorService', serviceId] })
            ]);
            
            // Navegar al dashboard después de completar
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

  const handleRetry = async () => {
    console.log('🔄 Retrying service fetch...');
    await refetch();
    // También invalidar las queries del operador para refrescar las tabs
    await queryClient.invalidateQueries({ queryKey: ['operatorServices'] });
    await queryClient.invalidateQueries({ queryKey: ['operator-services'] });
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

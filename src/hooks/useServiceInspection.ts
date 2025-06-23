
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOperatorService } from '@/hooks/useOperatorService';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { createPDFGenerator } from '@/utils/enhancedPdfGenerator';

export const useServiceInspection = () => {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Extraer el serviceId de los parámetros - puede estar como 'id' o 'serviceId'
  const serviceId = params.id || params.serviceId;
  
  console.log('🎯 Service Inspection Hook - Params:', params);
  console.log('🎯 Service Inspection Hook - Extracted Service ID:', serviceId);
  console.log('🎯 Service Inspection Hook - Current URL:', window.location.pathname);
  
  const { data: service, isLoading, error, refetch } = useOperatorService(serviceId || '');
  
  console.log('📊 Service Inspection State:', {
    serviceId,
    hasService: !!service,
    serviceFolio: service?.folio,
    isLoading,
    error: error?.message,
    paramsReceived: params
  });

  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfStep, setPdfStep] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string>();

  const updateServiceStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!id) {
        throw new Error('ID del servicio requerido');
      }
      
      console.log('🔄 [STATUS UPDATE] Iniciando actualización de estado para servicio:', id);
      console.log('🔄 [STATUS UPDATE] Estado actual del servicio:', service?.status);
      
      // Verificar que el servicio existe antes de actualizarlo
      const { data: currentService, error: fetchError } = await supabase
        .from('services')
        .select('id, status, folio')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('❌ [STATUS UPDATE] Error al obtener servicio actual:', fetchError);
        throw new Error(`Error al obtener servicio: ${fetchError.message}`);
      }

      if (!currentService) {
        console.error('❌ [STATUS UPDATE] Servicio no encontrado:', id);
        throw new Error('Servicio no encontrado');
      }

      console.log('🔍 [STATUS UPDATE] Servicio encontrado:', {
        id: currentService.id,
        folio: currentService.folio,
        statusActual: currentService.status
      });

      if (currentService.status === 'in_progress') {
        console.log('⚠️ [STATUS UPDATE] El servicio ya está en progreso, saltando actualización');
        return currentService;
      }

      // Realizar la actualización
      console.log('🔄 [STATUS UPDATE] Ejecutando UPDATE a in_progress...');
      const { data: updatedService, error: updateError } = await supabase
        .from('services')
        .update({ status: 'in_progress' })
        .eq('id', id)
        .select('id, status, folio')
        .single();

      if (updateError) {
        console.error('❌ [STATUS UPDATE] Error en UPDATE:', updateError);
        throw new Error(`Error al actualizar el estado del servicio: ${updateError.message}`);
      }

      if (!updatedService) {
        console.error('❌ [STATUS UPDATE] No se recibió respuesta del UPDATE');
        throw new Error('No se pudo confirmar la actualización del servicio');
      }
      
      console.log('✅ [STATUS UPDATE] Actualización exitosa:', {
        id: updatedService.id,
        folio: updatedService.folio,
        nuevoStatus: updatedService.status
      });

      // Verificación adicional
      const { data: verificationService, error: verifyError } = await supabase
        .from('services')
        .select('id, status, folio')
        .eq('id', id)
        .single();

      if (verifyError) {
        console.error('⚠️ [STATUS UPDATE] Error en verificación:', verifyError);
      } else {
        console.log('🔍 [STATUS UPDATE] Verificación final:', {
          id: verificationService.id,
          folio: verificationService.folio,
          statusVerificado: verificationService.status
        });
      }

      return updatedService;
    },
    onSuccess: (updatedService) => {
      console.log('✅ [STATUS UPDATE] Mutation onSuccess ejecutado:', updatedService);
      
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['operatorServices'] });
      queryClient.invalidateQueries({ queryKey: ['operatorService', serviceId] });
      
      toast.success(`Servicio ${updatedService.folio} iniciado con éxito`);
      
      // Navegar después de un breve delay para permitir que las queries se actualicen
      setTimeout(() => {
        console.log('🔄 [STATUS UPDATE] Navegando al dashboard...');
        navigate('/operator');
      }, 1000);
    },
    onError: (error) => {
      console.error('💥 [STATUS UPDATE] Mutation onError ejecutado:', error);
      toast.error(`Error al iniciar servicio: ${error.message}`);
    },
  });

  const sendInspectionEmailMutation = useMutation({
    mutationFn: async ({ pdfBlob, service, inspection }: {
      pdfBlob: Blob;
      service: any;
      inspection: InspectionFormValues;
    }) => {
      console.log('📧 Enviando inspección por email...');
      
      // Convert blob to base64
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

      console.log('📧 Datos del email:', emailData.inspectionData);

      const { data, error } = await supabase.functions.invoke('send-inspection-email', {
        body: emailData
      });

      if (error) {
        console.error('❌ Error invocando función de email:', error);
        throw new Error(`Error al invocar función de email: ${error.message}`);
      }

      console.log('✅ Función de email invocada exitosamente:', data);
      return data;
    },
    onSuccess: () => {
      console.log('✅ Email enviado exitosamente');
      toast.success('Inspección enviada por email exitosamente');
    },
    onError: (error) => {
      console.error('💥 Error enviando email:', error);
      toast.error(`Error al enviar email: ${error.message}`);
    }
  });

  const processInspectionMutation = useMutation({
    mutationFn: async (values: InspectionFormValues) => {
      if (!service) {
        throw new Error('No hay datos del servicio disponibles.');
      }
      
      if (!serviceId) {
        throw new Error('ID del servicio no disponible.');
      }
      
      console.log('📋 [PROCESS] Iniciando procesamiento de inspección para servicio:', service.folio);
      
      setIsGeneratingPDF(true);
      setPdfProgress(0);
      setPdfStep('Iniciando generación...');
      
      const pdfGenerator = createPDFGenerator((progress, step) => {
        setPdfProgress(progress);
        setPdfStep(step);
      });
      
      console.log('📄 [PROCESS] Generando PDF...');
      const { blob, downloadUrl } = await pdfGenerator.generateWithProgress({
        service: service,
        inspection: values,
      });
      
      setPdfDownloadUrl(downloadUrl);
      
      const filename = `Inspeccion-${service.folio}-${new Date().toISOString().split('T')[0]}.pdf`;
      await pdfGenerator.downloadPDF(blob, filename, downloadUrl);
      
      console.log('✅ [PROCESS] PDF generado exitosamente');

      // Intentar enviar por email SOLO si el cliente tiene email válido
      let emailSent = false;
      if (service.client?.email && service.client.email.includes('@')) {
        try {
          setPdfStep('Enviando por email...');
          console.log('📧 [PROCESS] Enviando email...');
          await sendInspectionEmailMutation.mutateAsync({
            pdfBlob: blob,
            service,
            inspection: values
          });
          emailSent = true;
          console.log('✅ [PROCESS] Email enviado exitosamente');
        } catch (emailError) {
          console.error('⚠️ [PROCESS] Error enviando email (continuando con el proceso):', emailError);
          toast.error('PDF generado correctamente, pero no se pudo enviar por email');
        }
      } else {
        console.log('⚠️ [PROCESS] Cliente sin email válido, saltando envío por email');
        toast.info('PDF generado correctamente. Cliente sin email válido para envío.');
      }
      
      // Limpiar fotos del localStorage
      [...values.photosBeforeService, ...values.photosClientVehicle, ...values.photosEquipmentUsed]
        .forEach(photoName => {
          localStorage.removeItem(`photo-${photoName}`);
        });
      
      console.log('🧹 [PROCESS] Fotos limpiadas del localStorage');
      
      return { values, emailSent };
    },
    onSuccess: async (result) => {
      const { emailSent } = result;
      
      console.log('✅ [PROCESS] Procesamiento completado exitosamente');
      
      if (emailSent) {
        toast.success('PDF de inspección generado y enviado exitosamente');
      } else {
        toast.success('PDF de inspección generado exitosamente');
      }
      
      // INMEDIATAMENTE actualizar el estado del servicio
      if (serviceId) {
        console.log('🔄 [PROCESS] Iniciando actualización inmediata de estado del servicio...');
        try {
          await updateServiceStatusMutation.mutateAsync(serviceId);
          console.log('✅ [PROCESS] Estado del servicio actualizado exitosamente');
        } catch (statusError) {
          console.error('💥 [PROCESS] Error crítico al actualizar estado:', statusError);
          toast.error(`Error crítico: ${statusError.message}`);
        }
      } else {
        console.error('💥 [PROCESS] No hay serviceId para actualizar el estado');
        toast.error('Error: No se pudo identificar el servicio para actualizar su estado');
      }
    },
    onError: (error: Error) => {
      console.error('💥 [PROCESS] Error en procesamiento:', error);
      toast.error(`Error al procesar la inspección: ${error.message}`);
      setIsGeneratingPDF(false);
      setPdfProgress(0);
    },
    onSettled: () => {
      setTimeout(() => {
        setIsGeneratingPDF(false);
        setPdfProgress(0);
        setPdfStep('');
        if (pdfDownloadUrl) {
          URL.revokeObjectURL(pdfDownloadUrl);
          setPdfDownloadUrl(undefined);
        }
      }, 5000);
    }
  });

  const handleManualDownload = () => {
    if (pdfDownloadUrl && service) {
      const link = document.createElement('a');
      link.href = pdfDownloadUrl;
      link.download = `Inspeccion-${service.folio}-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      toast.success('Descarga iniciada');
    }
  };

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
    handleManualDownload,
    handleRetry,
    navigate
  };
};

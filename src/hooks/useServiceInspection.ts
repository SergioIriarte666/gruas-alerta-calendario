
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
      
      console.log('🔄 Updating service status to in_progress:', id);
      
      const { error } = await supabase
        .from('services')
        .update({ status: 'in_progress' })
        .eq('id', id);

      if (error) {
        console.error('❌ Error updating service status:', error);
        throw new Error(`Error al actualizar el estado del servicio: ${error.message}`);
      }
      
      console.log('✅ Service status updated successfully');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatorServices'] });
      queryClient.invalidateQueries({ queryKey: ['operatorService', serviceId] });
      
      toast.success('Servicio iniciado con éxito');
      navigate('/operator');
    },
    onError: (error) => {
      console.error('💥 Service status update failed:', error);
      toast.error(error.message);
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
      
      console.log('📋 Processing inspection for service:', service.folio);
      
      setIsGeneratingPDF(true);
      setPdfProgress(0);
      setPdfStep('Iniciando generación...');
      
      const pdfGenerator = createPDFGenerator((progress, step) => {
        setPdfProgress(progress);
        setPdfStep(step);
      });
      
      const { blob, downloadUrl } = await pdfGenerator.generateWithProgress({
        service: service,
        inspection: values,
      });
      
      setPdfDownloadUrl(downloadUrl);
      
      const filename = `Inspeccion-${service.folio}-${new Date().toISOString().split('T')[0]}.pdf`;
      await pdfGenerator.downloadPDF(blob, filename, downloadUrl);
      
      // Intentar enviar por email SOLO si el cliente tiene email válido
      let emailSent = false;
      if (service.client?.email && service.client.email.includes('@')) {
        try {
          setPdfStep('Enviando por email...');
          await sendInspectionEmailMutation.mutateAsync({
            pdfBlob: blob,
            service,
            inspection: values
          });
          emailSent = true;
        } catch (emailError) {
          console.error('⚠️ Error enviando email (continuando con el proceso):', emailError);
          toast.error('PDF generado correctamente, pero no se pudo enviar por email');
        }
      } else {
        console.log('⚠️ Cliente sin email válido, saltando envío por email');
        toast.info('PDF generado correctamente. Cliente sin email válido para envío.');
      }
      
      // Limpiar fotos del localStorage
      [...values.photosBeforeService, ...values.photosClientVehicle, ...values.photosEquipmentUsed]
        .forEach(photoName => {
          localStorage.removeItem(`photo-${photoName}`);
        });
      
      return { values, emailSent };
    },
    onSuccess: (result) => {
      const { emailSent } = result;
      
      if (emailSent) {
        toast.success('PDF de inspección generado y enviado exitosamente');
      } else {
        toast.success('PDF de inspección generado exitosamente');
      }
      
      // SIEMPRE actualizar el estado del servicio, independientemente del email
      setTimeout(() => {
        if (serviceId) {
          console.log('🔄 Iniciando actualización de estado del servicio...');
          updateServiceStatusMutation.mutate(serviceId);
        }
      }, 2000);
    },
    onError: (error: Error) => {
      console.error('💥 PDF generation failed:', error);
      toast.error(`Error al generar el PDF: ${error.message}`);
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

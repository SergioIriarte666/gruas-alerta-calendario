
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOperatorService } from '@/hooks/useOperatorService';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { createPDFGenerator } from '@/utils/enhancedPdfGenerator';

export const useServiceInspection = () => {
  const { id: serviceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  console.log('🎯 Service Inspection Hook - Service ID from URL:', serviceId);
  
  const { data: service, isLoading, error, refetch } = useOperatorService(serviceId || '');
  
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfStep, setPdfStep] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string>();

  console.log('📊 Service Inspection State:', {
    serviceId,
    hasService: !!service,
    serviceFolio: service?.folio,
    isLoading,
    error: error?.message
  });

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
      
      [...values.photosBeforeService, ...values.photosClientVehicle, ...values.photosEquipmentUsed]
        .forEach(photoName => {
          localStorage.removeItem(`photo-${photoName}`);
        });
      
      return values;
    },
    onSuccess: () => {
      toast.success('PDF de inspección generado exitosamente');
      
      setTimeout(() => {
        if (serviceId) {
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
    handleManualDownload,
    handleRetry,
    navigate
  };
};

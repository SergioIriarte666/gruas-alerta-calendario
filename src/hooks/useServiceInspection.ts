
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOperatorService } from '@/hooks/useOperatorService';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { createPDFGenerator } from '@/utils/enhancedPdfGenerator';

export const useServiceInspection = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  console.log('🔧 useServiceInspection - Service ID:', id);
  
  const { data: service, isLoading, error } = useOperatorService(id!);
  
  console.log('🔧 useServiceInspection - Query state:', {
    serviceId: id,
    hasService: !!service,
    isLoading,
    error: error?.message || 'none'
  });
  
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfStep, setPdfStep] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string>();

  const updateServiceStatusMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase
        .from('services')
        .update({ status: 'in_progress' })
        .eq('id', serviceId);

      if (error) throw new Error('Error al actualizar el estado del servicio');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operatorServices'] });
      queryClient.invalidateQueries({ queryKey: ['operatorService', id] });
      
      toast.success('Servicio iniciado con éxito');
      navigate('/operator');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const processInspectionMutation = useMutation({
    mutationFn: async (values: InspectionFormValues) => {
      if (!service) {
        throw new Error('Faltan datos del servicio.');
      }
      
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
      
      // Intentar descarga automática
      const filename = `Inspeccion-${service.folio}-${new Date().toISOString().split('T')[0]}.pdf`;
      const downloadSuccess = await pdfGenerator.downloadPDF(blob, filename, downloadUrl);
      
      if (!downloadSuccess) {
        toast.warning('La descarga automática falló. Usa el botón de descarga manual.');
      }
      
      // Limpiar fotos temporales del localStorage después de la generación exitosa
      [...values.photosBeforeService, ...values.photosClientVehicle, ...values.photosEquipmentUsed]
        .forEach(photoName => {
          localStorage.removeItem(`photo-${photoName}`);
        });
      
      return values;
    },
    onSuccess: () => {
      toast.success('PDF de inspección generado exitosamente');
      
      // Pequeño delay antes de iniciar el servicio para que el usuario vea el PDF
      setTimeout(() => {
        if (id) {
          updateServiceStatusMutation.mutate(id);
        }
      }, 2000);
    },
    onError: (error: Error) => {
      console.error('Error generando PDF:', error);
      toast.error(`Error al generar el PDF: ${error.message}`);
      setIsGeneratingPDF(false);
      setPdfProgress(0);
    },
    onSettled: () => {
      // Reset del estado de generación después de 5 segundos
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
    if (pdfDownloadUrl) {
      const link = document.createElement('a');
      link.href = pdfDownloadUrl;
      link.download = `Inspeccion-${service?.folio}-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      toast.success('Descarga iniciada');
    }
  };

  return {
    id,
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
    navigate
  };
};

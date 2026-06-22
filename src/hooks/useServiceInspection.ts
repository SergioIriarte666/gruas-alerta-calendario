import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useOperatorService } from '@/hooks/useOperatorService';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { useInspectionPDF } from '@/hooks/inspection/useInspectionPDF';
import { useInspectionEmail } from '@/hooks/inspection/useInspectionEmail';
import { useServiceStatusUpdate } from '@/hooks/inspection/useServiceStatusUpdate';
import { operatorServiceKeys, operatorServicesKeys } from '@/hooks/operatorServicesQueryKeys';
import { uploadInspectionPdf } from '@/utils/inspectionPdfUpload';
import { ensurePhotosUploaded, persistInspection } from '@/utils/inspectionRecord';
import { reportFrontendError } from '@/utils/reportFrontendError';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useServiceInspection');

export const useServiceInspection = () => {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const serviceId = params.id || params.serviceId;

  logger.debug('Service ID:', serviceId);

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

  logger.debug('State:', {
    serviceId,
    hasService: !!service,
    serviceFolio: service?.folio,
    serviceStatus: service?.status,
    isLoading,
    error: error?.message
  });

  // Pipeline atómico: cada paso solo avanza si el anterior tuvo éxito, y el
  // estado del servicio (inspection_completed/completed) es CONSECUENCIA de
  // haber guardado la inspección, nunca un paso independiente.
  const processInspectionMutation = useMutation({
    mutationFn: async ({ values, phase }: { values: InspectionFormValues; phase: 'initial' | 'final' }) => {
      if (!service || !serviceId) {
        throw new Error('No hay datos del servicio disponibles.');
      }

      const operatorId = service.operator?.id;
      if (!operatorId) {
        throw new Error('El servicio no tiene un operador asignado; no se puede registrar la inspección.');
      }

      logger.debug('1/5 Subiendo fotos a Storage...', service.folio, phase);
      const uploadedPhotos = await ensurePhotosUploaded(values.photographicSet, serviceId);
      const valuesWithPhotos: InspectionFormValues = { ...values, photographicSet: uploadedPhotos };

      logger.debug('2/5 Generando PDF...');
      const { blob } = await generatePDF(service, valuesWithPhotos, phase === 'final');

      logger.debug('3/5 Subiendo PDF a Storage...');
      const pdfFolio = phase === 'initial' ? `${service.folio}-retiro` : service.folio;
      const uploadResult = await uploadInspectionPdf(blob, serviceId, pdfFolio);

      logger.debug('4/5 Guardando inspección en base de datos...');
      await persistInspection(serviceId, operatorId, valuesWithPhotos, uploadedPhotos, uploadResult.signedUrl, phase);

      logger.debug('5/5 Actualizando estado del servicio...');
      await updateServiceStatusMutation.mutateAsync({
        id: serviceId,
        targetStatus: phase === 'initial' ? 'inspection_completed' : 'completed',
      });

      let emailSent = false;
      if (service.client?.email && service.client.email.includes('@')) {
        try {
          await sendInspectionEmailMutation.mutateAsync({
            pdfBlob: blob,
            service,
            inspection: valuesWithPhotos
          });
          emailSent = true;
        } catch (emailError) {
          logger.error('Error en email:', emailError);
          toast.error('Inspección guardada correctamente, pero no se pudo enviar el correo');
        }
      }

      return { values: valuesWithPhotos, emailSent, phase, signedUrl: uploadResult.signedUrl };
    },
    onSuccess: async (result) => {
      const { values, emailSent, phase, signedUrl } = result;

      logger.debug('Procesamiento completado para fase:', phase);

      const successLabel = phase === 'initial' ? 'Inspección inicial' : 'Servicio';
      toast.success(emailSent
        ? `${successLabel} guardada y enviada por correo exitosamente`
        : `${successLabel} guardada exitosamente`);

      // ── Notificación por WhatsApp (best-effort, no bloquea el flujo) ──
      try {
        const clientPhone = service?.client?.phone || '';
        const contactPhone = (service as any)?.contactPhone || '';
        if (clientPhone || contactPhone) {
          await supabase.functions.invoke(
            phase === 'initial' ? 'send-whatsapp-retiro' : 'send-whatsapp-inspection',
            {
              body: {
                folio: service?.folio,
                serviceId,
                clientName: service?.client?.name || '',
                clientPhone,
                contactPhone,
                contactPerson: (service as any)?.contactPerson || '',
                pdfUrl: signedUrl,
                serviceDate: service?.serviceDate,
                operatorName: service?.operator?.name || '',
              },
            }
          );
        }
      } catch (waErr) {
        logger.error('Error enviando WhatsApp:', waErr);
      }

      if (phase === 'final') {
        values.photographicSet?.forEach(photo => {
          localStorage.removeItem(`photo-${photo.fileName}`);
        });
        localStorage.removeItem(`inspection_${serviceId}`);
        localStorage.removeItem(`inspection_metadata_${serviceId}`);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: operatorServiceKeys.detail(serviceId) }),
        queryClient.invalidateQueries({ queryKey: operatorServicesKeys.all }),
        refetch()
      ]);

      setTimeout(() => {
        navigate('/operator');
      }, 1500);
    },
    onError: (error: Error) => {
      logger.error('Error en procesamiento:', error);
      toast.error(`Error al procesar la inspección: ${error.message}`);
      reportFrontendError({
        componentName: 'useServiceInspection',
        errorMessage: error.message,
        errorStack: error.stack,
        url: window.location.href,
      }).catch(() => {});
    },
    onSettled: () => {
      cleanupPDF();
    }
  });

  const handleRetry = async () => {
    logger.debug('Retrying service fetch...');
    await refetch();
    await queryClient.invalidateQueries({ queryKey: operatorServicesKeys.all });
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

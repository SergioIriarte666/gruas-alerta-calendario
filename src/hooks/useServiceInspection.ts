import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useOperatorService } from '@/hooks/useOperatorService';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { useInspectionPDF } from '@/hooks/inspection/useInspectionPDF';
import { useInspectionEmail } from '@/hooks/inspection/useInspectionEmail';
import { useServiceStatusUpdate } from '@/hooks/inspection/useServiceStatusUpdate';
import { uploadInspectionPdf, savePdfUrlToInspection } from '@/utils/inspectionPdfUpload';
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

  const processInspectionMutation = useMutation({
    mutationFn: async ({ values, phase }: { values: InspectionFormValues; phase: 'initial' | 'final' }) => {
      if (!service || !serviceId) {
        throw new Error('No hay datos del servicio disponibles.');
      }

      logger.debug('Iniciando procesamiento para:', service.folio, 'Fase:', phase);

      const { blob } = await generatePDF(service, values, phase === 'final');

      let emailSent = false;
      if (service.client?.email && service.client.email.includes('@')) {
        try {
          logger.debug('Enviando email de inspección...');
          await sendInspectionEmailMutation.mutateAsync({
            pdfBlob: blob,
            service,
            inspection: values
          });
          emailSent = true;
          logger.debug('Email de inspección enviado exitosamente');
        } catch (emailError) {
          logger.error('Error en email:', emailError);
          toast.error('PDF generado correctamente, pero no se pudo enviar por email');
        }
      } else {
        logger.debug('Cliente sin email válido');
        toast.info('PDF generado correctamente. Cliente sin email válido para envío.');
      }

      return { values, emailSent, phase, blob };
    },
    onSuccess: async (result) => {
      const { emailSent, phase } = result;

      logger.debug('Procesamiento completado para fase:', phase);

      if (phase === 'initial') {
        if (emailSent) {
          toast.success('PDF de retiro generado y enviado exitosamente');
        } else {
          toast.success('PDF de retiro generado exitosamente');
        }

        // ── Subir PDF de retiro a Storage y notificar por WhatsApp ────────
        try {
          const uploadResult = await uploadInspectionPdf(
            result.blob,
            serviceId,
            `${service.folio}-retiro`,
          );

          if (uploadResult) {
            await savePdfUrlToInspection(serviceId, uploadResult.signedUrl, 'initial');

            const clientPhone = service.client?.phone || '';
            const contactPhone = (service as any).contactPhone || '';

            if (clientPhone || contactPhone) {
              await supabase.functions.invoke('send-whatsapp-retiro', {
                body: {
                  folio: service.folio,
                  serviceId,
                  clientName: service.client?.name || '',
                  clientPhone,
                  contactPhone,
                  contactPerson: (service as any).contactPerson || '',
                  pdfUrl: uploadResult.signedUrl,
                  serviceDate: service.serviceDate,
                  operatorName: service.operator?.name || '',
                },
              });
            }
          }
        } catch (uploadErr) {
          logger.error('Error subiendo PDF de retiro o enviando WhatsApp:', uploadErr);
        }
        // ─────────────────────────────────────────────────────────────────

        if (serviceId) {
          logger.debug('Actualizando estado a inspection_completed...');
          try {
            await updateServiceStatusMutation.mutateAsync({
              id: serviceId,
              targetStatus: 'inspection_completed'
            });
            logger.debug('Estado actualizado a inspection_completed');

            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['operatorService', serviceId] }),
              queryClient.invalidateQueries({ queryKey: ['operatorServices'] }),
              queryClient.invalidateQueries({ queryKey: ['operator-services'] }),
              refetch()
            ]);

            toast.success('Inspección inicial completada. Regresando al menú principal...');

            setTimeout(() => {
              logger.debug('Navegando al dashboard...');
              navigate('/operator');
            }, 1500);

          } catch (statusError) {
            logger.error('Error al actualizar estado:', statusError);
            toast.error(`Error al actualizar estado: ${statusError.message}`);
          }
        }
      } else {
        if (emailSent) {
          toast.success('PDF de entrega generado y enviado exitosamente');
        } else {
          toast.success('PDF de entrega generado exitosamente');
        }

        // ── Subir PDF a Storage y notificar por WhatsApp ──────────────────
        try {
          const uploadResult = await uploadInspectionPdf(result.blob, serviceId, service.folio);
          if (uploadResult) {
            await savePdfUrlToInspection(serviceId, uploadResult.signedUrl);

            const clientPhone = service.client?.phone || '';
            const contactPhone = (service as any).contactPhone || '';

            if (clientPhone || contactPhone) {
              await supabase.functions.invoke('send-whatsapp-inspection', {
                body: {
                  folio: service.folio,
                  serviceId,
                  clientName: service.client?.name || '',
                  clientPhone,
                  contactPhone,
                  contactPerson: (service as any).contactPerson || '',
                  pdfUrl: uploadResult.signedUrl,
                  serviceDate: service.serviceDate,
                  operatorName: service.operator?.name || '',
                },
              });
            }
          }
        } catch (uploadErr) {
          logger.error('Error subiendo PDF o enviando WhatsApp:', uploadErr);
        }
        // ─────────────────────────────────────────────────────────────────

        logger.debug('Limpiando fotos después de completar el servicio...');
        result.values.photographicSet?.forEach(photo => {
          localStorage.removeItem(`photo-${photo.fileName}`);
        });

        localStorage.removeItem(`inspection_${serviceId}`);
        localStorage.removeItem(`inspection_metadata_${serviceId}`);

        if (serviceId) {
          logger.debug('Actualizando estado a completed...');
          try {
            await updateServiceStatusMutation.mutateAsync({
              id: serviceId,
              targetStatus: 'completed'
            });
            logger.debug('Estado actualizado a completed');

            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['operatorServices'] }),
              queryClient.invalidateQueries({ queryKey: ['operator-services'] }),
              queryClient.invalidateQueries({ queryKey: ['operatorService', serviceId] })
            ]);

            setTimeout(() => {
              logger.debug('Navegando al dashboard...');
              navigate('/operator');
            }, 1500);
          } catch (statusError) {
            logger.error('Error crítico al actualizar estado:', statusError);
            toast.error(`Error crítico: ${statusError.message}`);
          }
        } else {
          logger.error('No hay serviceId para actualizar');
          toast.error('Error: No se pudo identificar el servicio');
        }
      }
    },
    onError: (error: Error) => {
      logger.error('Error en procesamiento:', error);
      toast.error(`Error al procesar la inspección: ${error.message}`);
    },
    onSettled: () => {
      cleanupPDF();
    }
  });

  const handleRetry = async () => {
    logger.debug('Retrying service fetch...');
    await refetch();
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

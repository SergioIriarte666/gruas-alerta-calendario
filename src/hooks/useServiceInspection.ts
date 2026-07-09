import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useOperatorService } from '@/hooks/useOperatorService';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { useInspectionPDF } from '@/hooks/inspection/useInspectionPDF';
import { useInspectionEmail } from '@/hooks/inspection/useInspectionEmail';
import { useServiceStatusUpdate } from '@/hooks/inspection/useServiceStatusUpdate';
import { operatorServiceKeys, operatorServicesKeys } from '@/hooks/operatorServicesQueryKeys';
import { reportFrontendError } from '@/utils/reportFrontendError';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { submitInspectionPipeline } from '@/utils/inspectionSubmission';
import { queuePendingInspection, updateCachedOperatorService } from '@/utils/operatorOffline';
import { isInSituService } from '@/utils/inspectionPhase';
import { PhotoStorage } from '@/utils/photoStorage';
import type { Service } from '@/types';

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
    revealPDF,
    handleManualDownload,
    cleanupPDF,
    beginPdfGeneration,
    updatePdfGeneration,
    finishPdfGeneration,
  } = useInspectionPDF();
  const { sendInspectionEmailMutation } = useInspectionEmail();
  const { updateServiceStatusMutation } = useServiceStatusUpdate(serviceId);
  const [completedInspection, setCompletedInspection] = useState<{
    blob?: Blob;
    values: InspectionFormValues;
    phase: 'initial' | 'final';
    signedUrl?: string;
    emailSent: boolean;
    whatsappSent: boolean;
    queuedOffline?: boolean;
  } | null>(null);

  const reportNotificationError = (channel: 'email' | 'whatsapp', error: unknown) => {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    reportFrontendError({
      componentName: `useServiceInspection.${channel}`,
      errorMessage: normalizedError.message,
      errorStack: normalizedError.stack,
      url: window.location.href,
    }).catch(() => {});
  };

  const sendWhatsApp = async (signedUrl: string, phase: 'initial' | 'final') => {
    const clientPhone = service?.client?.phone || '';
    const contactPhone = (service as any)?.contactPhone || '';
    if (!clientPhone && !contactPhone) return false;

    const { error } = await supabase.functions.invoke(
      phase === 'initial' ? 'send-whatsapp-inspection' : 'send-whatsapp-retiro',
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

    if (error) throw error;
    return true;
  };

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

      const operatorId = service.operator?.id;
      if (!operatorId) {
        throw new Error('El servicio no tiene un operador asignado; no se puede registrar la inspección.');
      }

      if (!navigator.onLine) {
        const queued = await queuePendingInspection({
          serviceId,
          userId: service.operator?.id || null,
          phase,
          serviceSnapshot: service,
          values,
        });

        return {
          queuedOffline: true,
          values,
          emailSent: false,
          phase,
          queueId: queued.id,
        } as const;
      }

      beginPdfGeneration();

      const { blob, signedUrl, valuesWithPhotos } = await submitInspectionPipeline({
        service,
        serviceId,
        values,
        phase,
        onPdfProgress: updatePdfGeneration,
      });

      finishPdfGeneration();

      // El envío de email codifica el PDF completo a base64 en memoria (el paso más
      // pesado de todo el flujo). El servicio y el registro de inspección ya quedaron
      // persistidos arriba: no bloquear la pantalla de éxito con este paso — se dispara
      // después, en onSuccess, una vez que el operador ya ve la confirmación de guardado.
      return { blob, values: valuesWithPhotos, phase, signedUrl, queuedOffline: false } as const;
    },
    onSuccess: async (result) => {
      const { blob, values, phase, signedUrl, queuedOffline } = result;

      logger.debug('Procesamiento completado para fase:', phase);

      const successLabel = phase === 'initial' ? 'Inspección inicial' : 'Servicio';
      if (queuedOffline) {
        const optimisticStatus: 'inspection_completed' | 'completed' =
          phase === 'final' || isInSituService(service)
            ? 'completed'
            : 'inspection_completed';
        const patch = { status: optimisticStatus } as Partial<Service>;
        queryClient.setQueryData(operatorServiceKeys.detail(serviceId), (current: Service | null | undefined) =>
          current ? { ...current, ...patch } : current,
        );
        queryClient.setQueriesData(
          { queryKey: operatorServicesKeys.all },
          (current: Service[] | undefined) =>
            current?.map((item) => item.id === serviceId ? { ...item, ...patch } : item) ?? current,
        );
        updateCachedOperatorService(serviceId, patch).catch((error) => {
          logger.warn('Could not update cached operator service status', error);
        });

        toast.success(`${successLabel} guardada en este dispositivo. Se sincronizará automáticamente al volver la conexión.`);
        setCompletedInspection({
          values,
          phase,
          emailSent: false,
          whatsappSent: false,
          queuedOffline: true,
        });
      } else {
        toast.success(`${successLabel} guardada exitosamente`);

        // Mostrar la pantalla de éxito ANTES de cualquier paso pesado adicional: si el
        // envío de email o WhatsApp fallara o la app se recargara, el operador ya vio
        // la confirmación y el registro ya está persistido en la base de datos.
        revealPDF(blob!);
        setCompletedInspection({ blob, values, phase, signedUrl, emailSent: false, whatsappSent: false, queuedOffline: false });

        if (service.client?.email && service.client.email.includes('@')) {
          try {
            await sendInspectionEmailMutation.mutateAsync({
              pdfBlob: blob!,
              service,
              inspection: values,
              phase,
            });
            setCompletedInspection(current => current ? { ...current, emailSent: true } : current);
          } catch (emailError) {
            logger.error('Error en email:', emailError);
            toast.error('Inspección guardada correctamente, pero no se pudo enviar el correo');
            reportNotificationError('email', emailError);
          }
        }

        try {
          const whatsappSent = await sendWhatsApp(signedUrl!, phase);
          setCompletedInspection(current => current ? { ...current, whatsappSent } : current);
        } catch (waErr) {
          logger.error('Error enviando WhatsApp:', waErr);
          reportNotificationError('whatsapp', waErr);
        }
      }

      if (phase === 'final' && !queuedOffline) {
        // Las fotos comprimidas viven en IndexedDB (ver photoStorage.ts), no en
        // localStorage: limpiar ahí, o los blobs de inspecciones ya completadas
        // se acumulan indefinidamente en el dispositivo.
        for (const photo of values.photographicSet || []) {
          PhotoStorage.remove(photo.fileName).catch((error) => {
            logger.warn(`No se pudo limpiar la foto ${photo.fileName} de IndexedDB`, error);
          });
        }
        localStorage.removeItem(`inspection_${serviceId}`);
        localStorage.removeItem(`inspection_metadata_${serviceId}`);
      }

      if (queuedOffline) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: operatorServiceKeys.detail(serviceId) }),
          queryClient.invalidateQueries({ queryKey: operatorServicesKeys.all }),
        ]);
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: operatorServiceKeys.detail(serviceId) }),
          queryClient.invalidateQueries({ queryKey: operatorServicesKeys.all }),
          refetch(),
        ]);
      }

    },
    onError: (error: Error) => {
      finishPdfGeneration();
      logger.error('Error en procesamiento:', error);
      toast.error(`Error al procesar la inspección: ${error.message}`);
      reportFrontendError({
        componentName: 'useServiceInspection',
        errorMessage: error.message,
        errorStack: error.stack,
        url: window.location.href,
      }).catch(() => {});
      cleanupPDF();
    }
  });

  const handleSendEmail = async () => {
    if (!completedInspection || !service || !completedInspection.blob) return;
    try {
      await sendInspectionEmailMutation.mutateAsync({
        pdfBlob: completedInspection.blob,
        service,
        inspection: completedInspection.values,
        phase: completedInspection.phase,
      });
      setCompletedInspection(current => current ? { ...current, emailSent: true } : current);
    } catch (error) {
      reportNotificationError('email', error);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!completedInspection || !completedInspection.signedUrl) return;
    try {
      const whatsappSent = await sendWhatsApp(completedInspection.signedUrl, completedInspection.phase);
      if (!whatsappSent) {
        toast.error('El cliente no tiene un teléfono registrado');
        return;
      }
      setCompletedInspection(current => current ? { ...current, whatsappSent: true } : current);
      toast.success('Inspección enviada por WhatsApp');
    } catch (error) {
      logger.error('Error enviando WhatsApp:', error);
      toast.error('No se pudo enviar la inspección por WhatsApp');
      reportNotificationError('whatsapp', error);
    }
  };

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
    completedInspection,
    processInspectionMutation,
    updateServiceStatusMutation,
    sendInspectionEmailMutation,
    handleManualDownload: () => handleManualDownload(service),
    handleSendEmail,
    handleSendWhatsApp,
    handleRetry,
    navigate
  };
};

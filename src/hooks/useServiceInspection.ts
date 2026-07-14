import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useOperatorService } from '@/hooks/useOperatorService';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { useInspectionPDF } from '@/hooks/inspection/useInspectionPDF';
import { useServiceStatusUpdate } from '@/hooks/inspection/useServiceStatusUpdate';
import { operatorServiceKeys, operatorServicesKeys } from '@/hooks/operatorServicesQueryKeys';
import { reportFrontendError } from '@/utils/reportFrontendError';
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
        toast.success(`${successLabel} guardada - las notificaciones se enviarán automáticamente`);

        revealPDF(blob!);
        setCompletedInspection({ blob, values, phase, signedUrl, emailSent: false, whatsappSent: false, queuedOffline: false });
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
    handleManualDownload: () => handleManualDownload(service),
    handleRetry,
    navigate
  };
};

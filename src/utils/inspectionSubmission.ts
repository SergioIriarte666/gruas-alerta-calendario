import { createPDFGenerator } from '@/utils/enhancedPdfGenerator';
import type { InspectionFormValues } from '@/schemas/inspectionSchema';
import type { Service } from '@/types';
import {
  clearFinalInspectionFields,
  deleteInspectionRow,
  ensurePhotosUploaded,
  fetchInitialPhotosForPdf,
  persistInspection,
  recordInspectionStorageOrphan,
} from '@/utils/inspectionRecord';
import { deleteInspectionPdf, PDF_BUCKET, uploadInspectionPdf } from '@/utils/inspectionPdfUpload';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('inspectionSubmission');

export interface InspectionSubmissionResult {
  blob: Blob;
  signedUrl: string;
  valuesWithPhotos: InspectionFormValues;
}

const updateServiceStatusDirect = async (
  serviceId: string,
  targetStatus: 'inspection_completed' | 'completed',
): Promise<void> => {
  const { error } = await supabase
    .from('services')
    .update({ status: targetStatus })
    .eq('id', serviceId);

  if (error) {
    throw new Error(`No se pudo actualizar el estado del servicio: ${error.message}`);
  }
};

const cleanupPdfAfterFailure = async (path: string, serviceId: string) => {
  try {
    await deleteInspectionPdf(path);
    await recordInspectionStorageOrphan({
      serviceId,
      storagePath: path,
      bucketId: PDF_BUCKET,
      cleanupAttempted: true,
      cleanupSucceeded: true,
    });
  } catch (cleanupError) {
    await recordInspectionStorageOrphan({
      serviceId,
      storagePath: path,
      bucketId: PDF_BUCKET,
      cleanupAttempted: true,
      cleanupSucceeded: false,
      errorMessage: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
    });
    throw cleanupError;
  }
};

export const submitInspectionPipeline = async ({
  service,
  serviceId,
  values,
  phase,
  onPdfProgress,
}: {
  service: Service;
  serviceId: string;
  values: InspectionFormValues;
  phase: 'initial' | 'final';
  onPdfProgress?: (progress: number, step: string) => void;
}): Promise<InspectionSubmissionResult> => {
  const operatorId = service.operator?.id;
  if (!operatorId) {
    throw new Error('El servicio no tiene un operador asignado; no se puede registrar la inspección.');
  }

  const uploadedPhotos = await ensurePhotosUploaded(values.photographicSet, serviceId);
  const valuesWithPhotos: InspectionFormValues = { ...values, photographicSet: uploadedPhotos };

  const initialPhotos = phase === 'final'
    ? await fetchInitialPhotosForPdf(serviceId).catch((error) => {
        logger.warn('No se pudieron cargar fotos iniciales para el PDF final', error);
        return [];
      })
    : undefined;

  const pdfGenerator = createPDFGenerator((progress, step) => {
    onPdfProgress?.(progress, step);
  });
  const { blob } = await pdfGenerator.generateWithProgress({
    service,
    inspection: valuesWithPhotos,
    isFinal: phase === 'final',
    initialPhotos,
  });

  const uploadResult = await uploadInspectionPdf(
    blob,
    serviceId,
    service.folio,
    phase === 'initial' ? 'inicial' : 'entrega',
  );

  let persistedInspection: Awaited<ReturnType<typeof persistInspection>> | null = null;

  try {
    persistedInspection = await persistInspection(
      serviceId,
      operatorId,
      valuesWithPhotos,
      uploadedPhotos,
      uploadResult.path,
      phase,
    );
  } catch (persistError) {
    await cleanupPdfAfterFailure(uploadResult.path, serviceId);
    throw persistError;
  }

  try {
    await updateServiceStatusDirect(
      serviceId,
      phase === 'initial' ? 'inspection_completed' : 'completed',
    );
  } catch (statusError) {
    if (persistedInspection) {
      if (persistedInspection.wasInserted || phase === 'initial') {
        await deleteInspectionRow(persistedInspection.id);
      } else {
        await clearFinalInspectionFields(persistedInspection.id);
      }
    }

    await cleanupPdfAfterFailure(uploadResult.path, serviceId);
    throw statusError;
  }

  return {
    blob,
    signedUrl: uploadResult.signedUrl,
    valuesWithPhotos,
  };
};

import { createPDFGenerator } from '@/utils/enhancedPdfGenerator';
import type { InspectionFormValues } from '@/schemas/inspectionSchema';
import type { Service } from '@/types';
import { isInSituService } from '@/utils/inspectionPhase';
import {
  clearFinalInspectionFields,
  deleteInspectionRow,
  ensurePhotosUploaded,
  fetchInitialPhotosForPdf,
  persistInspection,
  recordInspectionStorageOrphan,
} from '@/utils/inspectionRecord';
import { deleteInspectionPdf, PDF_BUCKET, uploadInspectionPdf } from '@/utils/inspectionPdfUpload';
import { buildEquipmentStatus, fetchActiveInspectionEquipment } from '@/services/inspectionEquipmentCatalog';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('inspectionSubmission');
const photosLogger = createLogger('InspectionPhotos');

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

/** Estado al que debe quedar el servicio cuando la fase termina bien. */
export const targetStatusForPhase = (
  service: Service,
  phase: 'initial' | 'final',
): 'inspection_completed' | 'completed' =>
  // Servicios in-situ: una sola fase, pasan directo a 'completed' en lugar de
  // quedar colgados en 'inspection_completed'.
  phase === 'final' || isInSituService(service) ? 'completed' : 'inspection_completed';

/**
 * Cadena interrumpida: el PDF de la fase ya está subido y registrado, pero el
 * servicio nunca avanzó de estado.
 *
 * Es exactamente lo que pasó en terreno el 25/07: el WebView quedó zombi a
 * mitad de la entrega y el servicio se quedó en 'inspection_completed' con
 * evidencia ya guardada. Recapturar la entrega completa sería absurdo (y el
 * guardia de "ya existe una inspección" ni siquiera lo permite): lo que falta es
 * el último paso, y este lo retoma sin duplicar nada.
 *
 * Devuelve true si había algo pendiente que completar.
 */
export const resumeInterruptedSubmission = async ({
  service,
  serviceId,
  phase,
}: {
  service: Service;
  serviceId: string;
  phase: 'initial' | 'final';
}): Promise<boolean> => {
  const { data, error } = await supabase
    .from('inspections')
    .select('pdf_url, pdf_retiro_url')
    .eq('service_id', serviceId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo revisar la evidencia ya guardada: ${error.message}`);
  }

  const phasePdf = phase === 'initial' ? data?.pdf_url : data?.pdf_retiro_url;
  if (!phasePdf) return false;

  const targetStatus = targetStatusForPhase(service, phase);

  const { data: currentService, error: serviceError } = await supabase
    .from('services')
    .select('status')
    .eq('id', serviceId)
    .maybeSingle();

  if (serviceError) {
    throw new Error(`No se pudo revisar el estado del servicio: ${serviceError.message}`);
  }

  if (currentService?.status === targetStatus) {
    return false;
  }

  logger.warn('Cadena de entrega interrumpida: se retoma el cierre del servicio', {
    serviceId,
    phase,
    statusActual: currentService?.status,
    targetStatus,
  });

  await updateServiceStatusDirect(serviceId, targetStatus);
  return true;
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

  // El estado explícito se deriva aquí, del catálogo vigente, y no de un valor
  // guardado en el formulario: así el acta y la columna equipment_status
  // enumeran siempre TODOS los ítems evaluados, incluidos los ausentes.
  const activeEquipment = await fetchActiveInspectionEquipment();
  const equipmentStatus = buildEquipmentStatus(activeEquipment, values.equipment);

  const valuesWithPhotos: InspectionFormValues = {
    ...values,
    equipmentStatus,
    photographicSet: uploadedPhotos,
  };

  const initialPhotos = phase === 'final'
    ? await fetchInitialPhotosForPdf(serviceId).catch((error) => {
        logger.warn('No se pudieron cargar fotos iniciales para el PDF final', error);
        return [];
      })
    : undefined;

  const totalPhotoCount = uploadedPhotos.length + (initialPhotos?.length || 0);
  photosLogger.debug(`Iniciando armado de PDF (${phase}): ${totalPhotoCount} foto(s) a embeber`);
  const pdfStartedAt = Date.now();

  const pdfGenerator = createPDFGenerator((progress, step) => {
    onPdfProgress?.(progress, step);
  });
  const { blob } = await pdfGenerator.generateWithProgress({
    service,
    inspection: valuesWithPhotos,
    isFinal: phase === 'final',
    initialPhotos,
  });

  photosLogger.debug(
    `PDF armado en ${Date.now() - pdfStartedAt}ms: ${Math.round(blob.size / 1024)} KB`,
  );

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
    await updateServiceStatusDirect(serviceId, targetStatusForPhase(service, phase));
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

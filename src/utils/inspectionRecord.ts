import { supabase } from '@/integrations/supabase/client';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { PhotoStorage } from '@/utils/photoStorage';
import { uploadInspectionPhoto, getInspectionPhotoSignedUrl, PHOTO_BUCKET } from '@/utils/photoUpload';
import { deleteInspectionPdf, getInspectionPdfSignedUrl, PDF_BUCKET } from '@/utils/inspectionPdfUpload';
import { extractStoragePath } from '@/utils/storagePath';
import { businessClock } from '@/utils/businessClock';
import { normalizeRut } from '@/utils/rutFormatter';
import { normalizePersonNameOrNull } from '@/utils/personName';
import { createLogger } from '@/lib/logger';
import { getArchivedInspectionFiles } from '@/utils/archivedInspectionFiles';

const logger = createLogger('Inspection');

type PhotographicSetItem = NonNullable<InspectionFormValues['photographicSet']>[number];

export interface InitialInspectionEvidence {
  pdfUrl: string | null;
  photos: string[];
  storageTier: 'hot' | 'cold' | 'deleted';
  deletedAt: string | null;
  initialState: Pick<InspectionFormValues, 'equipment' | 'kilometraje' | 'combustible' | 'llaves' | 'documentacion'>;
}

export interface ExistingInspectionConflict {
  id: string;
  createdAt: string;
  operatorName: string | null;
  pdfPath: string;
}

export interface PersistInspectionResult {
  id: string;
  wasInserted: boolean;
}

/**
 * La entrega no puede depender de sessionStorage (efímero, por pestaña) para mostrar la
 * evidencia de la fase inicial: la base de datos es la única fuente confiable cuando la
 * pre-servicio y el retiro ocurren en sesiones o dispositivos distintos.
 *
 * `inspections` guarda PATHS de Storage, no signed URLs (un vehículo puede estar en custodia
 * semanas o meses, mucho más que el TTL de 7 días de una signed URL). Las URLs se firman
 * recién aquí, al momento de mostrar la evidencia. Por compatibilidad con filas antiguas que
 * aún tengan una signed URL persistida, se extrae el path antes de volver a firmar.
 */
export const fetchInitialInspectionEvidence = async (
  serviceId: string,
): Promise<InitialInspectionEvidence | null> => {
  const { data, error } = await supabase
    .from('inspections')
    .select('pdf_url, photos_before_service, equipment_checklist, initial_vehicle_state, storage_tier, deleted_at')
    .eq('service_id', serviceId)
    .maybeSingle();

  if (error) {
    logger.error('Error consultando evidencia de inspección inicial:', error);
    throw new Error(`Error al consultar inspección inicial: ${error.message}`);
  }

  if (!data) {
    return null;
  }
  const storageTier: InitialInspectionEvidence['storageTier'] =
    data.storage_tier === 'cold' || data.storage_tier === 'deleted' ? data.storage_tier : 'hot';

  let pdfUrl: string | null = null;
  let photos: string[] = [];
  if (storageTier === 'cold') {
    const archived = await getArchivedInspectionFiles({ serviceId });
    pdfUrl = archived.pdfUrl || null;
    photos = (archived.photos?.beforeService || []).filter((url): url is string => !!url);
  } else if (storageTier !== 'deleted') {
    const pdfPath = data.pdf_url ? extractStoragePath(data.pdf_url, PDF_BUCKET) : null;
    const photoPaths = (data.photos_before_service || [])
      .map((photo) => extractStoragePath(photo, PHOTO_BUCKET))
      .filter((path): path is string => !!path);
    [pdfUrl, photos] = await Promise.all([
      pdfPath ? getInspectionPdfSignedUrl(pdfPath) : Promise.resolve(null),
      Promise.all(photoPaths.map((path) => getInspectionPhotoSignedUrl(path))),
    ]);
  }

  const storedState = data.initial_vehicle_state && typeof data.initial_vehicle_state === 'object'
    ? data.initial_vehicle_state as Record<string, unknown>
    : {};

  return {
    pdfUrl,
    photos,
    storageTier,
    deletedAt: data.deleted_at,
    initialState: {
      equipment: Array.isArray(storedState.equipment)
        ? storedState.equipment.filter((item): item is string => typeof item === 'string')
        : data.equipment_checklist || [],
      kilometraje: typeof storedState.kilometraje === 'string' ? storedState.kilometraje : '',
      combustible: ['0', '1/4', '1/2', '3/4', 'full'].includes(String(storedState.combustible))
        ? storedState.combustible as InspectionFormValues['combustible']
        : undefined,
      llaves: storedState.llaves === 'si' || storedState.llaves === 'no' ? storedState.llaves : undefined,
      documentacion: storedState.documentacion === 'si' || storedState.documentacion === 'no'
        ? storedState.documentacion
        : undefined,
    },
  };
};

export const fetchExistingInspectionConflict = async (
  serviceId: string,
  phase: 'initial' | 'final',
): Promise<ExistingInspectionConflict | null> => {
  const { data, error } = await supabase
    .from('inspections')
    .select('id, created_at, operator_id, pdf_url, pdf_retiro_url, operators(name)')
    .eq('service_id', serviceId)
    .maybeSingle();

  if (error) {
    logger.error('Error consultando inspección existente:', error);
    throw new Error(`Error al verificar inspección existente: ${error.message}`);
  }

  const pdfPath = phase === 'initial' ? data?.pdf_url : data?.pdf_retiro_url;
  if (!data || !pdfPath) return null;

  const operatorRelation = (data as { operators?: { name?: string | null } | null }).operators;
  return {
    id: data.id,
    createdAt: data.created_at,
    operatorName: operatorRelation?.name || null,
    pdfPath,
  };
};

export const overwriteExistingInspectionPhase = async (
  conflict: ExistingInspectionConflict,
  phase: 'initial' | 'final',
): Promise<void> => {
  if (phase === 'initial') {
    const { data: current, error: selectError } = await supabase
      .from('inspections')
      .select('pdf_url, pdf_retiro_url')
      .eq('id', conflict.id)
      .single();

    if (selectError) {
      logger.error('Error cargando inspección para sobrescritura:', selectError);
      throw new Error(`No se pudo cargar la inspección existente: ${selectError.message}`);
    }

    const { error: deleteError } = await supabase
      .from('inspections')
      .delete()
      .eq('id', conflict.id);

    if (deleteError) {
      logger.error('Error eliminando inspección existente:', deleteError);
      throw new Error(`No se pudo eliminar la inspección existente: ${deleteError.message}`);
    }

    const pdfPaths = [current?.pdf_url, current?.pdf_retiro_url].filter((path): path is string => !!path);
    await Promise.all(pdfPaths.map((path) => deleteInspectionPdf(path)));
    return;
  }

  const { error: updateError } = await supabase
    .from('inspections')
    .update({
      pdf_retiro_url: null,
      pdf_retiro_uploaded_at: null,
      photos_client_vehicle: [],
    })
    .eq('id', conflict.id);

  if (updateError) {
    logger.error('Error limpiando entrega existente:', updateError);
    throw new Error(`No se pudo limpiar la entrega existente: ${updateError.message}`);
  }

  await deleteInspectionPdf(conflict.pdfPath);
};

/**
 * Garantiza que todas las fotos del set fotográfico estén en Supabase Storage.
 * Lanza si falta una foto en caché local o si la subida falla — nunca devuelve
 * fotos "perdidas" silenciosamente, porque son la prueba del estado de entrega.
 *
 * Sube las fotos una por una (no Promise.all): con 12+ fotos, subir todas en paralelo
 * multiplica la memoria y el ancho de banda usados en terreno simultáneamente.
 */
export const ensurePhotosUploaded = async (
  photographicSet: PhotographicSetItem[] | undefined,
  serviceId: string,
): Promise<(PhotographicSetItem & { storageUrl: string })[]> => {
  const photos = photographicSet || [];
  const uploaded: (PhotographicSetItem & { storageUrl: string })[] = [];

  for (const photo of photos) {
    if (photo.storageUrl) {
      uploaded.push({ ...photo, storageUrl: photo.storageUrl });
      continue;
    }

    const cached = await PhotoStorage.load(photo.fileName);
    if (!cached) {
      throw new Error(`Falta la foto ${photo.fileName} en el dispositivo; no se puede subir a Storage.`);
    }

    const storageUrl = await uploadInspectionPhoto(photo.fileName, cached.blob, serviceId);
    uploaded.push({ ...photo, storageUrl });
  }

  return uploaded;
};

/**
 * Guarda la evidencia de la fase con DOBLE LLAVE: el id del servicio y el folio
 * que la pantalla está mostrando. El 25/07 un flujo que decía TEST-TRACK-01
 * escribió el PDF de entrega, el RUT y el nombre del receptor sobre el servicio
 * REAL 3262047-1. La escritura directa a `inspections` está bloqueada por
 * trigger para el rol operador: este es el único camino.
 */
export const persistInspection = async (
  serviceId: string,
  folioConfirmation: string,
  operatorId: string,
  values: InspectionFormValues,
  uploadedPhotos: (PhotographicSetItem & { storageUrl: string })[],
  pdfPath: string,
  phase: 'initial' | 'final',
): Promise<PersistInspectionResult> => {
  if (phase === 'final' && uploadedPhotos.length === 0) {
    throw new Error('La entrega requiere al menos una fotografía antes de guardar.');
  }

  // Cada fase escribe SU firmante y solo el suyo. La entrega no manda
  // client_name/client_rut ni por accidente: son la identidad de quien entregó
  // el vehículo en el retiro y pisarla borra una prueba (folio 3266120-1).
  const signerIdentity = phase === 'initial'
    ? {
        client_name: normalizePersonNameOrNull(values.clientName),
        client_rut: values.clientRut?.trim() ? normalizeRut(values.clientRut) : null,
      }
    : {
        receiver_name: normalizePersonNameOrNull(values.receptionPersonName),
        receiver_rut: values.receptionPersonRut?.trim() ? normalizeRut(values.receptionPersonRut) : null,
      };

  const payload = {
    // equipment_checklist = solo los presentes (compatibilidad con consumidores
    // existentes). equipment_status = el catálogo completo con true/false, que
    // es lo único capaz de distinguir "revisado y ausente" de "nunca evaluado".
    equipment_checklist: values.equipment || [],
    ...(values.equipmentStatus ? { equipment_status: values.equipmentStatus } : {}),
    vehicle_observations: values.vehicleObservations || null,
    operator_signature: values.operatorSignature || '',
    ...signerIdentity,
    ...(phase === 'initial' ? {
      initial_vehicle_state: {
        equipment: values.equipment || [],
        kilometraje: values.kilometraje || '',
        combustible: values.combustible || null,
        llaves: values.llaves || null,
        documentacion: values.documentacion || null,
      },
    } : {}),
    // storageUrl es el PATH del objeto en Storage (ver photoUpload.ts), no una
    // signed URL: se firma on-demand al mostrar la evidencia, nunca se persiste
    // con TTL.
    photos: uploadedPhotos.map(photo => photo.storageUrl),
    pdf_path: pdfPath,
  };

  const { data, error } = await supabase.rpc('save_inspection_evidence', {
    p_service_id: serviceId,
    p_folio_confirmation: folioConfirmation,
    p_phase: phase,
    p_operator_id: operatorId,
    p_payload: payload,
  });

  if (error) {
    logger.error('Error guardando la evidencia de inspección:', error);
    throw new Error(`Error al guardar inspección: ${error.message}`);
  }

  const result = (data ?? {}) as { id?: string; was_inserted?: boolean };
  if (!result.id) {
    throw new Error(`La evidencia de ${phase === 'initial' ? 'inspección inicial' : 'entrega'} no quedó persistida completamente.`);
  }

  // Verificación de lectura: la fila queda releída para confirmar que el PDF y
  // TODAS las fotos quedaron guardados, no solo que la escritura no dio error.
  const { data: persisted, error: verifyError } = await supabase
    .from('inspections')
    .select('photos_before_service, photos_client_vehicle, pdf_url, pdf_retiro_url')
    .eq('id', result.id)
    .maybeSingle();

  if (verifyError) {
    logger.error('Error verificando la evidencia persistida:', verifyError);
    throw new Error(`Error al verificar inspección: ${verifyError.message}`);
  }

  const persistedPhotos = phase === 'initial' ? persisted?.photos_before_service : persisted?.photos_client_vehicle;
  const persistedPdf = phase === 'initial' ? persisted?.pdf_url : persisted?.pdf_retiro_url;
  if (!persistedPdf || !persistedPhotos || persistedPhotos.length !== uploadedPhotos.length) {
    throw new Error(`La evidencia de ${phase === 'initial' ? 'inspección inicial' : 'entrega'} no quedó persistida completamente.`);
  }

  logger.debug('Inspección persistida correctamente para servicio:', serviceId);
  return { id: result.id, wasInserted: result.was_inserted === true };
};

export const deleteInspectionRow = async (inspectionId: string): Promise<void> => {
  const { error } = await supabase
    .from('inspections')
    .delete()
    .eq('id', inspectionId);

  if (error) {
    logger.error('Error eliminando row de inspección:', { inspectionId, error });
    throw new Error(`No se pudo eliminar la inspección ${inspectionId}: ${error.message}`);
  }
};

export const clearFinalInspectionFields = async (inspectionId: string): Promise<void> => {
  const { error } = await supabase
    .from('inspections')
    .update({
      pdf_retiro_url: null,
      pdf_retiro_uploaded_at: null,
      photos_client_vehicle: [],
    })
    .eq('id', inspectionId);

  if (error) {
    logger.error('Error limpiando campos de entrega:', { inspectionId, error });
    throw new Error(`No se pudo limpiar la entrega ${inspectionId}: ${error.message}`);
  }
};

export const recordInspectionStorageOrphan = async (params: {
  serviceId: string | null;
  storagePath: string;
  bucketId: string;
  cleanupAttempted: boolean;
  cleanupSucceeded: boolean;
  errorMessage?: string;
}): Promise<void> => {
  const { error } = await supabase
    .from('inspection_storage_orphans')
    .insert({
      service_id: params.serviceId,
      storage_path: params.storagePath,
      bucket_id: params.bucketId,
      cleanup_attempted: params.cleanupAttempted,
      cleanup_succeeded: params.cleanupSucceeded,
      error_message: params.errorMessage || null,
      resolved_at: params.cleanupSucceeded ? businessClock.nowISO() : null,
    });

  if (error) {
    logger.warn('No se pudo registrar auditoría de limpieza de Storage:', error);
  }
};

const PDF_PHOTO_CATEGORIES = ['izquierdo', 'derecho', 'frontal', 'trasero', 'interior', 'motor'] as const;
type PdfPhotoCategory = typeof PDF_PHOTO_CATEGORIES[number];

const categoryFromPath = (path: string, index: number): PdfPhotoCategory => {
  const base = (path.split('/').pop() || '').toLowerCase();
  const token = base.replace('set_fotografico_', '').split('-')[0];
  return (PDF_PHOTO_CATEGORIES as readonly string[]).includes(token)
    ? (token as PdfPhotoCategory)
    : PDF_PHOTO_CATEGORIES[index % PDF_PHOTO_CATEGORIES.length];
};

const urlToBlob = async (url: string): Promise<Blob> => {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`No se pudo descargar la foto inicial (${resp.status})`);
  return await resp.blob();
};

/**
 * Carga las fotos de la inspección INICIAL (photos_before_service) como Blobs, listas para
 * embeber en el PDF de entrega. Devuelve [] si no hay (nunca lanza hacia arriba: la entrega no
 * debe bloquearse si las iniciales no cargan; el PDF inicial sigue existiendo aparte).
 *
 * Descarga las fotos una por una (no Promise.all): mantener 6+ fotos como Blobs en memoria
 * simultáneamente durante la entrega ya causó presión de memoria en iOS.
 */
export const fetchInitialPhotosForPdf = async (
  serviceId: string,
): Promise<Array<{ fileName: string; category: PdfPhotoCategory; blob: Blob }>> => {
  const { data, error } = await supabase
    .from('inspections')
    .select('photos_before_service, storage_tier')
    .eq('service_id', serviceId)
    .maybeSingle();
  if (error) {
    if (error) logger.error('Error consultando fotos iniciales para PDF:', error);
    return [];
  }

  let signedPhotos: Array<{ url: string; fileName: string }> = [];
  if (data?.storage_tier === 'cold') {
    try {
      const archived = await getArchivedInspectionFiles({ serviceId });
      signedPhotos = (archived.photos?.beforeService || [])
        .filter((url): url is string => !!url)
        .map((url, index) => ({ url, fileName: `inicial-${index}` }));
    } catch (cause) {
      logger.warn('No se pudieron recuperar fotos iniciales desde R2:', cause);
      return [];
    }
  } else {
    const paths = (data?.photos_before_service || [])
      .map((p) => extractStoragePath(p, PHOTO_BUCKET))
      .filter((p): p is string => !!p);
    signedPhotos = await Promise.all(paths.map(async (path) => ({
      url: await getInspectionPhotoSignedUrl(path),
      fileName: path.split('/').pop() || path,
    })));
  }

  const results: Array<{ fileName: string; category: PdfPhotoCategory; blob: Blob }> = [];
  for (let index = 0; index < signedPhotos.length; index++) {
    const { url, fileName } = signedPhotos[index];
    try {
      const blob = await urlToBlob(url);
      results.push({ fileName, category: categoryFromPath(fileName, index), blob });
    } catch (e) {
      logger.warn(`No se pudo cargar foto inicial ${fileName} para el PDF:`, e);
    }
  }
  return results;
};

import { supabase } from '@/integrations/supabase/client';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { PhotoStorage } from '@/utils/photoStorage';
import { uploadInspectionPhoto, getInspectionPhotoSignedUrl, PHOTO_BUCKET } from '@/utils/photoUpload';
import { getInspectionPdfSignedUrl, PDF_BUCKET } from '@/utils/inspectionPdfUpload';
import { extractStoragePath } from '@/utils/storagePath';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Inspection');

type PhotographicSetItem = NonNullable<InspectionFormValues['photographicSet']>[number];

export interface InitialInspectionEvidence {
  pdfUrl: string | null;
  photos: string[];
  initialState: Pick<InspectionFormValues, 'equipment' | 'kilometraje' | 'combustible' | 'llaves' | 'documentacion'>;
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
    .select('pdf_url, photos_before_service, equipment_checklist, initial_vehicle_state')
    .eq('service_id', serviceId)
    .maybeSingle();

  if (error) {
    logger.error('Error consultando evidencia de inspección inicial:', error);
    throw new Error(`Error al consultar inspección inicial: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const pdfPath = data.pdf_url ? extractStoragePath(data.pdf_url, PDF_BUCKET) : null;
  const photoPaths = (data.photos_before_service || [])
    .map((photo) => extractStoragePath(photo, PHOTO_BUCKET))
    .filter((path): path is string => !!path);

  const [pdfUrl, photos] = await Promise.all([
    pdfPath ? getInspectionPdfSignedUrl(pdfPath) : Promise.resolve(null),
    Promise.all(photoPaths.map((path) => getInspectionPhotoSignedUrl(path))),
  ]);

  const storedState = data.initial_vehicle_state && typeof data.initial_vehicle_state === 'object'
    ? data.initial_vehicle_state as Record<string, unknown>
    : {};

  return {
    pdfUrl,
    photos,
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

/**
 * Garantiza que todas las fotos del set fotográfico estén en Supabase Storage.
 * Lanza si falta una foto en caché local o si la subida falla — nunca devuelve
 * fotos "perdidas" silenciosamente, porque son la prueba del estado de entrega.
 */
export const ensurePhotosUploaded = async (
  photographicSet: PhotographicSetItem[] | undefined,
  serviceId: string,
): Promise<(PhotographicSetItem & { storageUrl: string })[]> => {
  const photos = photographicSet || [];

  return Promise.all(
    photos.map(async (photo) => {
      if (photo.storageUrl) {
        return { ...photo, storageUrl: photo.storageUrl };
      }

      const cached = PhotoStorage.load(photo.fileName);
      if (!cached) {
        throw new Error(`Falta la foto ${photo.fileName} en el dispositivo; no se puede subir a Storage.`);
      }

      const storageUrl = await uploadInspectionPhoto(photo.fileName, cached.dataUrl, serviceId);
      return { ...photo, storageUrl };
    })
  );
};

export const persistInspection = async (
  serviceId: string,
  operatorId: string,
  values: InspectionFormValues,
  uploadedPhotos: (PhotographicSetItem & { storageUrl: string })[],
  pdfPath: string,
  phase: 'initial' | 'final',
): Promise<void> => {
  const pdfFields = phase === 'initial'
    ? { pdf_url: pdfPath, pdf_uploaded_at: businessClock.nowISO() }
    : { pdf_retiro_url: pdfPath, pdf_retiro_uploaded_at: businessClock.nowISO() };

  // uploadedPhotos[].storageUrl es el PATH del objeto en Storage (ver photoUpload.ts), no una
  // signed URL: se firma on-demand al mostrar la evidencia, nunca se persiste con TTL.
  const photoFields = phase === 'initial'
    ? { photos_before_service: uploadedPhotos.map(photo => photo.storageUrl) }
    : { photos_client_vehicle: uploadedPhotos.map(photo => photo.storageUrl) };

  const payload = {
    service_id: serviceId,
    operator_id: operatorId,
    equipment_checklist: values.equipment || [],
    vehicle_observations: values.vehicleObservations || null,
    operator_signature: values.operatorSignature,
    client_name: values.clientName || null,
    client_rut: values.clientRut || null,
    ...(phase === 'initial' ? {
      initial_vehicle_state: {
        equipment: values.equipment || [],
        kilometraje: values.kilometraje || '',
        combustible: values.combustible || null,
        llaves: values.llaves || null,
        documentacion: values.documentacion || null,
      },
    } : {}),
    ...photoFields,
    ...pdfFields,
  };

  const { data: existing, error: selectError } = await supabase
    .from('inspections')
    .select('id')
    .eq('service_id', serviceId)
    .maybeSingle();

  if (selectError) {
    logger.error('Error consultando inspección existente:', selectError);
    throw new Error(`Error al consultar inspección: ${selectError.message}`);
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('inspections')
      .update(payload)
      .eq('id', existing.id);

    if (updateError) {
      logger.error('Error actualizando inspección:', updateError);
      throw new Error(`Error al actualizar inspección: ${updateError.message}`);
    }
  } else {
    const { error: insertError } = await supabase
      .from('inspections')
      .insert(payload);

    if (insertError) {
      logger.error('Error insertando inspección:', insertError);
      throw new Error(`Error al guardar inspección: ${insertError.message}`);
    }
  }

  logger.debug('Inspección persistida correctamente para servicio:', serviceId);
};

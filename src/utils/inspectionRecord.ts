import { supabase } from '@/integrations/supabase/client';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { PhotoStorage } from '@/utils/photoStorage';
import { uploadInspectionPhoto } from '@/utils/photoUpload';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Inspection');

type PhotographicSetItem = NonNullable<InspectionFormValues['photographicSet']>[number];

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
  pdfUrl: string,
  phase: 'initial' | 'final',
): Promise<void> => {
  const pdfFields = phase === 'initial'
    ? { pdf_retiro_url: pdfUrl, pdf_retiro_uploaded_at: businessClock.nowISO() }
    : { pdf_url: pdfUrl, pdf_uploaded_at: businessClock.nowISO() };

  const payload = {
    service_id: serviceId,
    operator_id: operatorId,
    equipment_checklist: values.equipment || [],
    vehicle_observations: values.vehicleObservations || null,
    operator_signature: values.operatorSignature,
    client_name: values.clientName || null,
    client_rut: values.clientRut || null,
    photos_client_vehicle: uploadedPhotos.map(photo => photo.storageUrl),
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

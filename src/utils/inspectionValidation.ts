import { InspectionFormValues } from '@/schemas/inspectionSchema';

interface InspectionFlags {
  requiresDetail?: boolean;
  requiresPhotoSet?: boolean;
  isInSitu?: boolean;
}

export const validateFormBeforeSubmit = (
  values: InspectionFormValues,
  phase: 'initial' | 'final' = 'initial',
  flags: InspectionFlags = {}
): string[] => {
  const errors: string[] = [];
  const { requiresDetail = true, requiresPhotoSet = true, isInSitu = false } = flags;

  if (phase === 'initial') {
    if (!values.operatorSignature?.trim()) {
      errors.push('La firma del operador es obligatoria');
    }

    // Servicios in-situ: una sola fase. La firma y el nombre del cliente
    // son obligatorios (única evidencia del cliente recibiendo el servicio).
    if (isInSitu) {
      if (!values.clientSignature?.trim()) {
        errors.push('La firma del cliente es obligatoria');
      }
      if (!values.clientName?.trim()) {
        errors.push('El nombre del cliente es obligatorio');
      }
    }

    if (requiresDetail) {
      if (!values.equipment || values.equipment.length === 0) {
        errors.push('Debe seleccionar al menos un elemento del inventario');
      }
      if (!values.kilometraje?.trim()) {
        errors.push('El kilometraje es obligatorio');
      }
      if (!values.combustible?.trim()) {
        errors.push('El nivel de combustible es obligatorio');
      }
    }

    if (requiresPhotoSet) {
      const totalPhotos = values.photographicSet?.length || 0;
      if (totalPhotos === 0) {
        errors.push('Debe tomar al menos una fotografía para el set fotográfico');
      }
    }
  }

  if (phase === 'final') {
    // Defensive: respetar el flag (hoy solo llegan a 'final' los traslados
    // con requires_photo_set=true).
    if (requiresPhotoSet) {
      if (!values.photographicSet || values.photographicSet.length === 0) {
        errors.push('Debe tomar al menos una fotografía de la entrega');
      }
    }
    if (!values.vehicleReceptionSignature?.trim()) {
      errors.push('La firma de recepción del vehículo es obligatoria');
    }
    if (!values.receptionPersonName?.trim()) {
      errors.push('El nombre de quien recibe el vehículo es obligatorio');
    }
  }

  return errors;
};

import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { validateRut } from '@/utils/csvValidations';

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

    // Identidad de quien ENTREGA el vehículo: nombre y RUT quedan impresos bajo
    // su firma en el acta. Sin ellos el documento no identifica al firmante.
    if (!values.clientName?.trim()) {
      errors.push('El nombre de quien entrega el vehículo es obligatorio');
    }
    if (!values.clientRut?.trim()) {
      errors.push('El RUT de quien entrega el vehículo es obligatorio');
    } else if (!validateRut(values.clientRut.trim())) {
      errors.push('El RUT de quien entrega el vehículo es inválido. Use el formato 12.345.678-9');
    }

    // Servicios in-situ: una sola fase. La firma del cliente es obligatoria
    // (única evidencia del cliente recibiendo el servicio).
    if (isInSitu && !values.clientSignature?.trim()) {
      errors.push('La firma del cliente es obligatoria');
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
    if (!values.receptionPersonRut?.trim()) {
      errors.push('El RUT de quien recibe el vehículo es obligatorio');
    } else if (!validateRut(values.receptionPersonRut.trim())) {
      errors.push('El RUT de quien recibe el vehículo es inválido. Use el formato 12.345.678-9');
    }
  }

  return errors;
};

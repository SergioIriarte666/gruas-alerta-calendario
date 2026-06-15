
import { InspectionFormValues } from '@/schemas/inspectionSchema';

interface InspectionFlags {
  requiresDetail?: boolean;
  requiresPhotoSet?: boolean;
}

export const validateFormBeforeSubmit = (
  values: InspectionFormValues,
  phase: 'initial' | 'final' = 'initial',
  flags: InspectionFlags = {}
): string[] => {
  const errors: string[] = [];
  const { requiresDetail = true, requiresPhotoSet = true } = flags;

  if (phase === 'initial') {
    if (!values.operatorSignature?.trim()) {
      errors.push('La firma del operador es obligatoria');
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
    if (!values.vehicleReceptionSignature?.trim()) {
      errors.push('La firma de recepción del vehículo es obligatoria');
    }

    if (!values.receptionPersonName?.trim()) {
      errors.push('El nombre de quien recibe el vehículo es obligatorio');
    }
  }

  return errors;
};

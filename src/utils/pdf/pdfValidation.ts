
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Service } from '@/types';

interface ValidateInspectionFlags {
  requiresDetail?: boolean;
}

export const validateInspectionData = (
  data: {
    service: Service;
    inspection: InspectionFormValues;
    regenerationFooter?: string;
  },
  isFinal = false,
  flags: ValidateInspectionFlags = {},
): string[] => {
  const errors: string[] = [];
  // Regeneración administrativa: la firma original puede no haber existido
  // nunca (recuperación desde solo fotos). No exigirla en ese caso.
  const isAdminRegeneration = !!data.regenerationFooter;

  // Si quien llama no especifica el flag, derivarlo del tipo de servicio
  // (default true para mantener retrocompatibilidad).
  const requiresDetail =
    flags.requiresDetail ?? data.service?.serviceType?.requiresDetail ?? true;

  if (!data.service) {
    errors.push('Datos del servicio no disponibles');
  }

  if (!data.inspection) {
    errors.push('Datos de inspección no disponibles');
  }

  if (!isAdminRegeneration && !isFinal && !data.inspection.operatorSignature) {
    errors.push('Firma del operador es requerida');
  }

  if (!isAdminRegeneration && isFinal && !data.inspection.vehicleReceptionSignature) {
    errors.push('Firma de recepción es requerida');
  }

  // Solo exigir inventario cuando el tipo de servicio lo requiere.
  if (requiresDetail) {
    if (!data.inspection.equipment || data.inspection.equipment.length === 0) {
      errors.push('Debe seleccionar al menos un elemento del inventario');
    }
  }

  return errors;
};

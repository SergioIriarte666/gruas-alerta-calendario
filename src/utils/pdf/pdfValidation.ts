
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Service } from '@/types';

export const validateInspectionData = (data: {
  service: Service;
  inspection: InspectionFormValues;
}): string[] => {
  const errors: string[] = [];
  
  if (!data.service) {
    errors.push('Datos del servicio no disponibles');
  }
  
  if (!data.inspection) {
    errors.push('Datos de inspección no disponibles');
  }
  
  if (!data.inspection.operatorSignature) {
    errors.push('Firma del operador es requerida');
  }
  
  if (!data.inspection.equipment || data.inspection.equipment.length === 0) {
    errors.push('Debe seleccionar al menos un elemento del inventario');
  }
  
  return errors;
};

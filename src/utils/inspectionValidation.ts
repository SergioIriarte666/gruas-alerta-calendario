
import { InspectionFormValues } from '@/schemas/inspectionSchema';

export const validateFormBeforeSubmit = (values: InspectionFormValues): string[] => {
  const errors: string[] = [];
  
  if (!values.operatorSignature?.trim()) {
    errors.push('La firma del operador es obligatoria');
  }
  
  if (!values.equipment || values.equipment.length === 0) {
    errors.push('Debe seleccionar al menos un elemento del inventario');
  }
  
  const totalPhotos = values.photographicSet?.length || 0;
  
  if (totalPhotos === 0) {
    errors.push('Debe tomar al menos una fotografía para el set fotográfico');
  }
  
  return errors;
};


import { InspectionFormValues } from '@/schemas/inspectionSchema';

export const validateFormBeforeSubmit = (values: InspectionFormValues, phase: 'initial' | 'final' = 'initial'): string[] => {
  const errors: string[] = [];
  
  // Validaciones para la fase inicial
  if (phase === 'initial') {
    if (!values.operatorSignature?.trim()) {
      errors.push('La firma del operador es obligatoria');
    }
    
    if (!values.equipment || values.equipment.length === 0) {
      errors.push('Debe seleccionar al menos un elemento del inventario');
    }

    if (!values.kilometraje?.trim()) {
      errors.push('El kilometraje es obligatorio');
    }

    if (!values.combustible?.trim()) {
      errors.push('El nivel de combustible es obligatorio');
    }
    
    const totalPhotos = values.photographicSet?.length || 0;
    
    if (totalPhotos === 0) {
      errors.push('Debe tomar al menos una fotografía para el set fotográfico');
    }
  }
  
  // Validaciones para la fase final
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

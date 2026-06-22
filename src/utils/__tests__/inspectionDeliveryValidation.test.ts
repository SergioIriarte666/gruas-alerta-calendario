import { describe, expect, it } from 'vitest';
import { validateFormBeforeSubmit } from '@/utils/inspectionValidation';
import { InspectionFormValues } from '@/schemas/inspectionSchema';

const finalValues = (overrides: Partial<InspectionFormValues> = {}): InspectionFormValues => ({
  equipment: ['gata'],
  kilometraje: '120000',
  combustible: '1/2',
  llaves: 'si',
  documentacion: 'si',
  operatorSignature: '',
  clientSignature: '',
  clientName: 'Cliente Prueba',
  vehicleReceptionSignature: 'data:image/png;base64,firma',
  receptionPersonName: 'Receptor Prueba',
  photographicSet: [{ fileName: 'entrega.jpg', category: 'frontal' }],
  ...overrides,
});

describe('validación de entrega ligera', () => {
  it('permite finalizar sin firma del operador cuando hay foto y firma del receptor', () => {
    expect(validateFormBeforeSubmit(finalValues(), 'final')).toEqual([]);
  });

  it('exige al menos una foto de entrega', () => {
    expect(validateFormBeforeSubmit(finalValues({ photographicSet: [] }), 'final'))
      .toContain('Debe tomar al menos una fotografía de la entrega');
  });
});

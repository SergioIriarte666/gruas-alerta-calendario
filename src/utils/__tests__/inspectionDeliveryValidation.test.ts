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

  it('servicio in-situ exige firma del cliente y nombre del cliente', () => {
    const inSituValues = (overrides: Partial<InspectionFormValues> = {}): InspectionFormValues => ({
      equipment: [],
      kilometraje: '',
      combustible: '',
      llaves: 'no',
      documentacion: 'no',
      operatorSignature: 'data:image/png;base64,firmaop',
      clientSignature: '',
      clientName: '',
      vehicleReceptionSignature: '',
      receptionPersonName: '',
      photographicSet: [],
      ...overrides,
    });

    const errors = validateFormBeforeSubmit(inSituValues(), 'initial', {
      requiresDetail: false,
      requiresPhotoSet: false,
      isInSitu: true,
    });
    expect(errors).toContain('La firma del cliente es obligatoria');
    expect(errors).toContain('El nombre del cliente es obligatorio');
  });

  it('servicio in-situ con firma y nombre del cliente pasa sin foto', () => {
    const inSituValues: InspectionFormValues = {
      equipment: [],
      kilometraje: '',
      combustible: '',
      llaves: 'no',
      documentacion: 'no',
      operatorSignature: 'data:image/png;base64,firmaop',
      clientSignature: 'data:image/png;base64,firmacli',
      clientName: 'Juan Pérez',
      vehicleReceptionSignature: '',
      receptionPersonName: '',
      photographicSet: [],
    };
    const errors = validateFormBeforeSubmit(inSituValues, 'initial', {
      requiresDetail: false,
      requiresPhotoSet: false,
      isInSitu: true,
    });
    expect(errors).toEqual([]);
  });
});

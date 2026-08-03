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
  receptionPersonRut: '12.345.678-9',
  photographicSet: [{ fileName: 'entrega.jpg', category: 'frontal' }],
  ...overrides,
});

const initialValues = (overrides: Partial<InspectionFormValues> = {}): InspectionFormValues => ({
  equipment: [],
  kilometraje: '',
  combustible: undefined,
  llaves: 'no',
  documentacion: 'no',
  operatorSignature: 'data:image/png;base64,firmaop',
  clientSignature: '',
  clientName: '',
  clientRut: '',
  vehicleReceptionSignature: '',
  receptionPersonName: '',
  photographicSet: [],
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
    const errors = validateFormBeforeSubmit(initialValues(), 'initial', {
      requiresDetail: false,
      requiresPhotoSet: false,
      isInSitu: true,
    });
    expect(errors).toContain('La firma del cliente es obligatoria');
    expect(errors).toContain('El nombre de quien entrega el vehículo es obligatorio');
  });

  it('servicio in-situ con firma e identidad del firmante pasa sin foto', () => {
    const errors = validateFormBeforeSubmit(
      initialValues({
        clientSignature: 'data:image/png;base64,firmacli',
        clientName: 'Juan Pérez',
        clientRut: '12.345.678-9',
      }),
      'initial',
      { requiresDetail: false, requiresPhotoSet: false, isInSitu: true },
    );
    expect(errors).toEqual([]);
  });
});

/**
 * El acta identifica a DOS personas distintas: la que entrega el vehículo en el
 * retiro y la que lo recibe en la entrega. Cada fase exige la suya y nunca la
 * de la otra, que ya está persistida y no está en pantalla.
 */
describe('identidad del firmante por fase', () => {
  it('el retiro exige nombre y RUT de quien entrega', () => {
    const errors = validateFormBeforeSubmit(initialValues(), 'initial', {
      requiresDetail: false,
      requiresPhotoSet: false,
    });
    expect(errors).toContain('El nombre de quien entrega el vehículo es obligatorio');
    expect(errors).toContain('El RUT de quien entrega el vehículo es obligatorio');
  });

  it('el retiro rechaza un RUT mal formado', () => {
    const errors = validateFormBeforeSubmit(
      initialValues({ clientName: 'Alberto Pino', clientRut: '289060091' }),
      'initial',
      { requiresDetail: false, requiresPhotoSet: false },
    );
    expect(errors).toContain(
      'El RUT de quien entrega el vehículo es inválido. Use el formato 12.345.678-9',
    );
  });

  it('el retiro no pide la identidad del receptor', () => {
    const errors = validateFormBeforeSubmit(
      initialValues({ clientName: 'Alberto Pino', clientRut: '28.906.009-K' }),
      'initial',
      { requiresDetail: false, requiresPhotoSet: false },
    );
    expect(errors).toEqual([]);
  });

  it('la entrega exige nombre y RUT de quien recibe', () => {
    const errors = validateFormBeforeSubmit(
      finalValues({ receptionPersonName: '', receptionPersonRut: '' }),
      'final',
    );
    expect(errors).toContain('El nombre de quien recibe el vehículo es obligatorio');
    expect(errors).toContain('El RUT de quien recibe el vehículo es obligatorio');
  });

  it('la entrega rechaza un RUT mal formado', () => {
    const errors = validateFormBeforeSubmit(
      finalValues({ receptionPersonRut: '123456789' }),
      'final',
    );
    expect(errors).toContain(
      'El RUT de quien recibe el vehículo es inválido. Use el formato 12.345.678-9',
    );
  });

  it('la entrega no exige la identidad del retiro', () => {
    const errors = validateFormBeforeSubmit(
      finalValues({ clientName: '', clientRut: '' }),
      'final',
    );
    expect(errors).toEqual([]);
  });
});

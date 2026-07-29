import { describe, expect, it } from 'vitest';
import { serviceFormSchema } from '@/schemas/serviceSchema';

const validService = {
  folio: 'TEST_GPS',
  isManualFolio: true,
  requestDate: '2026-07-29',
  serviceDate: '2026-07-29',
  clientId: 'client-id',
  serviceTypeId: 'service-type-id',
  value: 0,
  status: 'in_progress' as const,
  origin: 'Salfa Freire',
  originLat: -27.359943716,
  originLng: -70.3494648,
  destination: 'Custodia G5N',
  destinationLat: -27.3464396,
  destinationLng: -70.6313583,
};

describe('serviceFormSchema location snapshots', () => {
  it('accepts confirmed origin and destination coordinates', () => {
    expect(serviceFormSchema.safeParse(validService).success).toBe(true);
  });

  it('rejects changing a destination label without confirming its coordinates', () => {
    const result = serviceFormSchema.safeParse({
      ...validService,
      destination: 'Otro destino',
      destinationLat: null,
      destinationLng: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['destination'],
            message: 'Selecciona y confirma el destino en el mapa',
          }),
        ]),
      );
    }
  });

  it('rejects coordinates outside Chile or with latitude and longitude inverted', () => {
    const result = serviceFormSchema.safeParse({
      ...validService,
      destinationLat: -70.6313583,
      destinationLng: -27.3464396,
    });

    expect(result.success).toBe(false);
  });
});

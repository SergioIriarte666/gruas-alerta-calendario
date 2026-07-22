import { describe, expect, it } from 'vitest';
import { buildOperatorWidgetPayload } from '@/native/operatorWidget';
import type { Service } from '@/types';

const service = (overrides: Partial<Service>): Service => ({
  id: 'service-default',
  folio: 'SRV-001',
  requestDate: '2026-07-20',
  serviceDate: '2026-07-24',
  client: {} as Service['client'],
  vehicleBrand: 'Volvo',
  vehicleModel: 'FH',
  licensePlate: 'ABCD12',
  origin: 'Base Norte',
  destination: 'Taller Central',
  serviceType: {} as Service['serviceType'],
  value: 0,
  crane: null,
  operator: null,
  operatorCommission: 0,
  status: 'pending',
  createdAt: '2026-07-20T10:00:00.000Z',
  updatedAt: '2026-07-20T10:00:00.000Z',
  ...overrides,
});

describe('operatorWidget', () => {
  it('elige el próximo pendiente por fecha y hora y el servicio activo', () => {
    const payload = buildOperatorWidgetPayload([
      service({ id: 'later', folio: 'SRV-003', serviceDate: '2026-07-25', startTime: '08:00' }),
      service({ id: 'active', folio: 'SRV-002', status: 'in_progress' }),
      service({ id: 'next', folio: 'SRV-004', serviceDate: '2026-07-24', startTime: '07:30' }),
    ], '2026-07-22T12:00:00.000Z');

    expect(payload.nextService).toMatchObject({
      id: 'next',
      folio: 'SRV-004',
      deepLink: 'tmsoperador://operator',
    });
    expect(payload.activeService).toMatchObject({
      id: 'active',
      folio: 'SRV-002',
      deepLink: 'tmsoperador://operator/active',
    });
    expect(payload.updatedAt).toBe('2026-07-22T12:00:00.000Z');
  });

  it('genera estados vacíos sin exponer datos de servicios terminados', () => {
    const payload = buildOperatorWidgetPayload([
      service({ status: 'completed' }),
    ]);

    expect(payload.nextService).toBeNull();
    expect(payload.activeService).toBeNull();
  });
});

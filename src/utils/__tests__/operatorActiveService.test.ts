import { describe, expect, it } from 'vitest';
import type { Service } from '@/types';
import {
  isActiveOperatorService,
  selectActiveOperatorService,
  selectTrackingService,
} from '@/utils/operatorActiveService';

const service = (overrides: Partial<Service> & Pick<Service, 'id' | 'status'>): Service =>
  ({
    folio: overrides.id,
    serviceDate: '2026-07-26',
    origin: 'Origen',
    destination: 'Destino',
    ...overrides,
  } as Service);

describe('operatorActiveService', () => {
  it('elige el servicio en curso aunque haya un pendiente de mañana primero', () => {
    // Reproduce la prueba en terreno: SRV-6858 (pendiente, mañana) encabezaba la
    // tarjeta "siguiente parada" y se llevaba los eventos del traslado real.
    const services = [
      service({ id: 'SRV-6858', status: 'pending', serviceDate: '2026-07-26' }),
      service({ id: 'TEST-TRACK-01', status: 'in_progress', serviceDate: '2026-07-25' }),
    ];

    expect(selectActiveOperatorService(services)?.id).toBe('TEST-TRACK-01');
    expect(selectTrackingService(services)?.id).toBe('TEST-TRACK-01');
  });

  it('sin servicio en curso no hay servicio activo', () => {
    const services = [
      service({ id: 'SRV-6858', status: 'pending' }),
      service({ id: 'SRV-6000', status: 'completed' }),
    ];

    expect(selectActiveOperatorService(services)).toBeNull();
  });

  it('considera activo el servicio pendiente de entrega', () => {
    const services = [service({ id: 'SRV-6857', status: 'inspection_completed' })];

    expect(selectActiveOperatorService(services)?.id).toBe('SRV-6857');
    expect(isActiveOperatorService(services[0])).toBe(true);
  });

  it('prioriza in_progress sobre inspection_completed', () => {
    const services = [
      service({ id: 'SRV-6857', status: 'inspection_completed' }),
      service({ id: 'SRV-6859', status: 'in_progress' }),
    ];

    expect(selectActiveOperatorService(services)?.id).toBe('SRV-6859');
  });

  it('la transmisión cae al pendiente más próximo cuando no hay servicio en curso', () => {
    const services = [
      service({ id: 'SRV-6900', status: 'pending', serviceDate: '2026-07-30' }),
      service({ id: 'SRV-6858', status: 'pending', serviceDate: '2026-07-26' }),
    ];

    expect(selectTrackingService(services)?.id).toBe('SRV-6858');
    expect(selectActiveOperatorService(services)).toBeNull();
  });
});

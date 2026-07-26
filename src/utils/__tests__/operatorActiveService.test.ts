import { describe, expect, it } from 'vitest';
import type { Service } from '@/types';
import {
  isActiveOperatorService,
  resolveOperatorServiceSelection,
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

  it('con dos servicios en jornada no adivina ninguno hasta que el operador elija', () => {
    // La jornada exacta del 25/07: TEST-TRACK-01 en curso + SRV-6858 asignado
    // para la mañana siguiente.
    const services = [
      service({ id: 'SRV-6858', status: 'pending', serviceDate: '2026-07-26' }),
      service({ id: 'TEST-TRACK-01', status: 'in_progress', serviceDate: '2026-07-25' }),
    ];

    const sinElegir = resolveOperatorServiceSelection(services, null);
    expect(sinElegir.requiresSelection).toBe(true);
    expect(sinElegir.activeService).toBeNull();
    expect(sinElegir.trackingService).toBeNull();
    expect(sinElegir.candidates.map((item) => item.id)).toEqual(['TEST-TRACK-01', 'SRV-6858']);

    const elegido = resolveOperatorServiceSelection(services, 'TEST-TRACK-01');
    expect(elegido.requiresSelection).toBe(false);
    expect(elegido.activeService?.id).toBe('TEST-TRACK-01');
    expect(elegido.trackingService?.id).toBe('TEST-TRACK-01');
  });

  it('elegir el pendiente permite transmitir sin habilitar detenciones', () => {
    const services = [
      service({ id: 'SRV-6858', status: 'pending' }),
      service({ id: 'TEST-TRACK-01', status: 'in_progress' }),
    ];

    const elegido = resolveOperatorServiceSelection(services, 'SRV-6858');
    expect(elegido.trackingService?.id).toBe('SRV-6858');
    expect(elegido.activeService).toBeNull();
  });

  it('con un solo servicio en vuelo no pide elegir', () => {
    const services = [
      service({ id: 'TEST-TRACK-01', status: 'in_progress' }),
      service({ id: 'SRV-6000', status: 'completed' }),
    ];

    const resuelto = resolveOperatorServiceSelection(services, null);
    expect(resuelto.requiresSelection).toBe(false);
    expect(resuelto.activeService?.id).toBe('TEST-TRACK-01');
  });

  it('una selección de un servicio que ya salió de la jornada no se respeta', () => {
    const services = [service({ id: 'TEST-TRACK-01', status: 'in_progress' })];

    const resuelto = resolveOperatorServiceSelection(services, 'SRV-6000');
    expect(resuelto.candidates.map((item) => item.id)).toEqual(['TEST-TRACK-01']);
    expect(resuelto.trackingService?.id).toBe('TEST-TRACK-01');
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

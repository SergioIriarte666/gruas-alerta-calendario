import { describe, expect, it } from 'vitest';
import {
  describeTrackingShareFailure,
  isFinalServiceStatus,
  resolveTrackingShareBlock,
} from '@/utils/serviceTrackingLifecycle';
import type { Service } from '@/types';

const service = (over: Partial<Service> = {}) => ({
  status: 'in_progress',
  originLat: -26.56,
  originLng: -70.32,
  destinationLat: -33.02,
  destinationLng: -71.55,
  ...over,
}) as Service;

describe('resolveTrackingShareBlock', () => {
  it('con todo en orden no bloquea', () => {
    expect(resolveTrackingShareBlock(service())).toBeNull();
  });

  it('un servicio cerrado no tiene seguimiento que compartir', () => {
    expect(resolveTrackingShareBlock(service({ status: 'completed' }))).toBe('service_closed');
    expect(resolveTrackingShareBlock(service({ status: 'invoiced' }))).toBe('service_closed');
  });

  it('sin coordenadas de destino bloquea antes de tocar el botón', () => {
    expect(resolveTrackingShareBlock(service({ destinationLat: null }))).toBe('missing_destination');
    expect(resolveTrackingShareBlock(service({ destinationLng: null }))).toBe('missing_destination');
  });

  it('el origen incompleto es el mismo callejón sin salida', () => {
    expect(resolveTrackingShareBlock(service({ originLat: null }))).toBe('missing_origin');
  });

  it('undefined es "no sé", no "falta": ahí decide el servidor', () => {
    // Un registro de la caché offline anterior a que el select pidiera las
    // coordenadas no trae la clave. Bloquear ahí apagaría el botón de un
    // servicio perfectamente compartible.
    expect(resolveTrackingShareBlock(service({ destinationLat: undefined }))).toBeNull();
    expect(resolveTrackingShareBlock(service({ originLng: undefined }))).toBeNull();
  });

  it('sin servicio no hay bloqueo que resolver: eso lo decide el llamador', () => {
    expect(resolveTrackingShareBlock(null)).toBeNull();
  });
});

describe('describeTrackingShareFailure', () => {
  it('un dato inválido del servicio NO se vende como problema de conexión', () => {
    // El 31/07 salió "Confirma el destino exacto… — Revisa tu conexión e
    // inténtalo de nuevo" y el operador reintentó diez veces en ruta.
    const description = describeTrackingShareFailure('22023');
    expect(description).toContain('Servicios');
    expect(description).not.toContain('conexión');
  });

  it('sin código conocido se asume la red, que es lo reintentable', () => {
    expect(describeTrackingShareFailure(null)).toContain('conexión');
    expect(describeTrackingShareFailure('08006')).toContain('conexión');
  });

  it('un permiso denegado se nombra como tal', () => {
    expect(describeTrackingShareFailure('42501')).toContain('permiso');
  });
});

describe('isFinalServiceStatus', () => {
  it('cubre los cinco estados finales y ninguno más', () => {
    expect(isFinalServiceStatus('completed')).toBe(true);
    expect(isFinalServiceStatus('partially_invoiced')).toBe(true);
    expect(isFinalServiceStatus('in_progress')).toBe(false);
    expect(isFinalServiceStatus('pending')).toBe(false);
    expect(isFinalServiceStatus(null)).toBe(false);
  });
});

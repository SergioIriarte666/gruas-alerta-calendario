import { describe, expect, it } from 'vitest';
import { resolveTransmissionStopGate } from '@/utils/transmissionStopGate';

describe('resolveTransmissionStopGate', () => {
  it('con link vigente y PIN configurado exige PIN', () => {
    // El caso que falló el 26/07 a las 21:3x: servicio 3262047-1 con el link
    // entregado y abierto por el cliente, y el operador con PIN configurado.
    expect(resolveTransmissionStopGate({ hasActiveLink: true, hasPin: true })).toBe('pin');
  });

  it('con link vigente pero sin PIN cae a doble confirmación', () => {
    // Diseño intencional: no se puede exigir lo que no existe sin dejar al
    // operador atrapado en terreno.
    expect(resolveTransmissionStopGate({ hasActiveLink: true, hasPin: false })).toBe('confirm');
  });

  it('sin link vigente basta la doble confirmación aunque haya PIN', () => {
    expect(resolveTransmissionStopGate({ hasActiveLink: false, hasPin: true })).toBe('confirm');
  });

  it('sin link ni PIN, doble confirmación', () => {
    expect(resolveTransmissionStopGate({ hasActiveLink: false, hasPin: false })).toBe('confirm');
  });
});

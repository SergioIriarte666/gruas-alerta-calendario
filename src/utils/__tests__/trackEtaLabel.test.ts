import { describe, expect, it } from 'vitest';
import {
  ETA_LABEL_TO_DESTINATION,
  ETA_LABEL_TO_ORIGIN,
  resolveEtaLabel,
  type EtaLabelInput,
} from '@/utils/trackEtaLabel';

const base: EtaLabelInput = {
  journeyStage: 'en_route',
  state: 'active',
  etaTarget: 'origin',
  hasEta: true,
  etaUnavailable: false,
  hasPosition: true,
  hasTargetCoords: true,
  isStopped: false,
  hasStops: false,
  hasNextStop: false,
};

describe('resolveEtaLabel', () => {
  it('antes de la carga: "Tu grúa llega en" apuntando al ORIGEN', () => {
    const result = resolveEtaLabel({ ...base, journeyStage: 'en_route', etaTarget: 'origin' });
    expect(result).toEqual({ kind: 'eta', label: ETA_LABEL_TO_ORIGIN, target: 'origin' });
  });

  it('con la carga a bordo: "Entrega estimada en" apuntando al DESTINO', () => {
    // SRV-6858: el número era del destino y el rótulo decía "TU GRÚA LLEGA EN".
    // Rótulo y objetivo se deciden juntos, en un solo lugar.
    const result = resolveEtaLabel({ ...base, journeyStage: 'towing', etaTarget: 'destination' });
    expect(result).toEqual({ kind: 'eta', label: ETA_LABEL_TO_DESTINATION, target: 'destination' });
  });

  it('el objetivo lo manda el servidor, no la etapa', () => {
    // Una respuesta antigua sin eta_target no debe inventar "destino" por tener
    // la etapa avanzada: el rótulo se queda en el conservador.
    const result = resolveEtaLabel({ ...base, journeyStage: 'towing', etaTarget: undefined });
    expect(result).toEqual({ kind: 'eta', label: ETA_LABEL_TO_ORIGIN, target: 'origin' });
  });

  it('el rótulo y el objetivo nunca se cruzan', () => {
    const origin = resolveEtaLabel({ ...base, etaTarget: 'origin' });
    const destination = resolveEtaLabel({ ...base, etaTarget: 'destination' });
    expect(origin).toMatchObject({ label: ETA_LABEL_TO_ORIGIN, target: 'origin' });
    expect(destination).toMatchObject({ label: ETA_LABEL_TO_DESTINATION, target: 'destination' });
    expect(origin).not.toMatchObject({ label: ETA_LABEL_TO_DESTINATION });
    expect(destination).not.toMatchObject({ label: ETA_LABEL_TO_ORIGIN });
  });

  it('sin destino geocodificable: "va en camino", sin número', () => {
    const result = resolveEtaLabel({
      ...base,
      journeyStage: 'towing',
      etaTarget: 'destination',
      hasEta: false,
      hasTargetCoords: false,
    });
    expect(result).toEqual({ kind: 'in_transit_unknown_destination' });
  });

  it('zona no ruteable con destino conocido: distancia en línea recta al DESTINO', () => {
    const result = resolveEtaLabel({
      ...base,
      journeyStage: 'towing',
      etaTarget: 'destination',
      hasEta: false,
      etaUnavailable: true,
      hasTargetCoords: true,
    });
    expect(result).toEqual({ kind: 'straight_line', target: 'destination' });
  });

  it('zona no ruteable antes de la carga: distancia al ORIGEN', () => {
    const result = resolveEtaLabel({
      ...base,
      etaTarget: 'origin',
      hasEta: false,
      etaUnavailable: true,
    });
    expect(result).toEqual({ kind: 'straight_line', target: 'origin' });
  });

  it('detención activa: ETA suspendido, por encima de cualquier otra regla', () => {
    const result = resolveEtaLabel({
      ...base,
      isStopped: true,
      journeyStage: 'towing',
      etaTarget: 'destination',
      hasEta: true,
    });
    expect(result).toEqual({ kind: 'stopped' });
  });

  it('en el lugar: sin número, aunque quede un ETA cacheado al origen', () => {
    const result = resolveEtaLabel({ ...base, journeyStage: 'on_site', hasEta: true });
    expect(result).toEqual({ kind: 'on_site' });
  });

  it('recorrido programado sin servicio iniciado: sin guía', () => {
    const result = resolveEtaLabel({
      ...base,
      hasStops: true,
      hasNextStop: true,
      routeArmed: false,
    });
    expect(result).toEqual({ kind: 'not_started' });
  });

  it('multidestino con parada objetivo: rótulo por parada', () => {
    const result = resolveEtaLabel({
      ...base,
      etaTarget: 'stop',
      hasStops: true,
      hasNextStop: true,
      routeArmed: true,
    });
    expect(result).toMatchObject({ kind: 'eta', target: 'stop' });
  });

  it('multidestino completado solo si el estado no es waiting', () => {
    const shared = { ...base, hasStops: true, journeyStage: 'arrived', hasEta: false, hasNextStop: false };
    expect(resolveEtaLabel({ ...shared, state: 'active' })).toEqual({ kind: 'arrived' });
    // En waiting la página está en fase inicial aunque la etapa diga otra cosa.
    expect(resolveEtaLabel({ ...shared, state: 'waiting' })).not.toEqual({ kind: 'arrived' });
  });

  it('sin posición: esqueleto; con posición y sin ETA: calculando', () => {
    expect(resolveEtaLabel({ ...base, hasEta: false, hasPosition: false })).toEqual({ kind: 'waiting' });
    expect(resolveEtaLabel({ ...base, hasEta: false, hasPosition: true })).toEqual({ kind: 'calculating' });
  });
});

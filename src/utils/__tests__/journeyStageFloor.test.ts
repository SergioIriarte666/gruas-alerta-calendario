import { describe, expect, it } from 'vitest';
import {
  resolveEffectiveStage,
  serviceStatusAllowsJourneyProgress,
  stageFloorForStatus,
} from '../../../supabase/functions/_shared/journeyStage';

/**
 * La lógica vive en supabase/functions/_shared para que la comparta la edge
 * function service-tracking (Deno) y la cubran estos tests. Módulo puro: no
 * importa nada de Deno ni del cliente.
 */
describe('piso de etapa por estado del servicio', () => {
  it('inspection_completed (carga a bordo) fija el piso en towing', () => {
    expect(stageFloorForStatus('inspection_completed')).toBe('towing');
  });

  it('in_progress solo garantiza que el servicio arrancó', () => {
    expect(stageFloorForStatus('in_progress')).toBe('en_route');
  });

  it('un servicio asignado pero no iniciado no tiene piso', () => {
    expect(stageFloorForStatus('pending')).toBeNull();
    expect(stageFloorForStatus(null)).toBeNull();
  });
});

describe('avance de la línea de tiempo por estado', () => {
  it('pending no puede consumir hitos de geocerca ni del viaje anterior', () => {
    expect(serviceStatusAllowsJourneyProgress('pending')).toBe(false);
  });

  it('solo avanza después de iniciar o completar la inspección de carga', () => {
    expect(serviceStatusAllowsJourneyProgress('in_progress')).toBe(true);
    expect(serviceStatusAllowsJourneyProgress('inspection_completed')).toBe(true);
    expect(serviceStatusAllowsJourneyProgress('completed')).toBe(false);
  });
});

describe('resolveEffectiveStage', () => {
  it('link nuevo a mitad de viaje: nace en towing pese al geocerco', () => {
    // 26/07: link creado a las 14:18 tras revocarse el anterior. Sin historial
    // de geocerco la etapa salía "en_route" y el ETA apuntaba al ORIGEN — el
    // cliente leyó "Tu grúa llega en 20 min · 32 km" (la distancia de VUELTA a
    // Copiapó) con su vehículo cargado rumbo a Viña.
    expect(resolveEffectiveStage('en_route', 'inspection_completed', null)).toBe('towing');
  });

  it('el máximo persistido sigue mandando cuando es mayor que el piso', () => {
    expect(resolveEffectiveStage('en_route', 'inspection_completed', 'arrived')).toBe('arrived');
    expect(resolveEffectiveStage('en_route', 'in_progress', 'on_site')).toBe('on_site');
  });

  it('el geocerco puede superar al piso, nunca bajarlo', () => {
    expect(resolveEffectiveStage('arrived', 'in_progress', null)).toBe('arrived');
    expect(resolveEffectiveStage('assigned', 'inspection_completed', null)).toBe('towing');
  });

  it('sin piso ni persistencia, manda el geocerco', () => {
    expect(resolveEffectiveStage('on_site', 'pending', null)).toBe('on_site');
    expect(resolveEffectiveStage('en_route', 'pending', null)).toBe('en_route');
  });

  it('la etapa nunca retrocede al volver a pasar por el origen', () => {
    // Fix 4: la grúa vuelve al radio del origen ya cargada; el geocerco dice
    // on_site pero la línea de tiempo del cliente ya iba en towing.
    expect(resolveEffectiveStage('on_site', 'inspection_completed', 'towing')).toBe('towing');
  });
});

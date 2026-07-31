import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { shouldEnforceLocation, useServiceFormValidation } from '../useServiceFormValidation';

const base = {
  fieldRequired: false,
  fieldDirty: false,
  isEditing: true,
  persistedStatus: 'completed' as string | null,
  formStatus: 'completed' as string | null,
  hasActiveTrackingLink: false,
};

describe('shouldEnforceLocation', () => {
  // El caso que motivó todo: una administrativa abre un servicio ya cerrado
  // sólo para escribir el número de OC. Ese servicio nunca tuvo pin y no lo
  // necesita: nadie va a rutearlo. El botón Guardar tiene que estar vivo.
  it('no bloquea un servicio completado cuya ubicación nadie tocó', () => {
    expect(shouldEnforceLocation(base)).toBe(false);
  });

  it.each(['cancelled', 'invoiced', 'partially_invoiced', 'inspection_completed'])(
    'tampoco bloquea en estado %s',
    (status) => {
      expect(
        shouldEnforceLocation({ ...base, persistedStatus: status, formStatus: status }),
      ).toBe(false);
    },
  );

  it('bloquea el alta cuando el tipo de servicio exige el campo', () => {
    expect(
      shouldEnforceLocation({ ...base, isEditing: false, fieldRequired: true, persistedStatus: null }),
    ).toBe(true);
  });

  // Un alta nace en `pending`, así que la regla 3 ya la cubre aunque el tipo de
  // servicio no exija el campo: crear un servicio sin pin sigue bloqueado.
  it('bloquea el alta en pending aunque el tipo no exija el campo', () => {
    expect(
      shouldEnforceLocation({
        ...base,
        isEditing: false,
        fieldRequired: false,
        persistedStatus: null,
        formStatus: 'pending',
      }),
    ).toBe(true);
  });

  // Registrar a mano un servicio pasado ya cerrado no necesita coordenadas.
  it('no bloquea un alta que nace cerrada y sin campo requerido', () => {
    expect(
      shouldEnforceLocation({
        ...base,
        isEditing: false,
        fieldRequired: false,
        persistedStatus: null,
        formStatus: 'completed',
      }),
    ).toBe(false);
  });

  // Si el usuario metió mano en el campo, se le exige terminar el trabajo:
  // una ubicación a medio escribir es peor que la que ya estaba.
  it('bloquea cuando el usuario editó el campo en esta sesión', () => {
    expect(shouldEnforceLocation({ ...base, fieldDirty: true })).toBe(true);
  });

  it.each(['pending', 'in_progress'])('bloquea en estado %s (el tracking consume las coordenadas)', (status) => {
    expect(shouldEnforceLocation({ ...base, persistedStatus: status })).toBe(true);
  });

  // Reabrir un servicio cerrado lo devuelve al circuito de seguimiento.
  it('bloquea si el formulario devuelve el servicio a pending', () => {
    expect(
      shouldEnforceLocation({ ...base, persistedStatus: 'completed', formStatus: 'pending' }),
    ).toBe(true);
  });

  // El trigger validate_service_location_snapshot rechaza el UPDATE igual:
  // más vale frenar acá que mostrar el error de Postgres después.
  it('bloquea si hay link de seguimiento activo', () => {
    expect(shouldEnforceLocation({ ...base, hasActiveTrackingLink: true })).toBe(true);
  });
});

// ── Etiqueta y coordenada desacopladas ───────────────────────────────────────
// El 99% de los servicios son auxilios en ruta: el vehículo falla donde falla y
// la mejor referencia posible ("camino a Mantoverde, km 12, poste 45") no es
// geocodificable. Escribirla no puede frenar el guardado.
describe('useServiceFormValidation: falta de coordenada', () => {
  const serviceType = {
    id: 'st-1',
    name: 'Auxilio en Ruta',
    originRequired: true,
    destinationRequired: false,
  } as unknown as Parameters<typeof useServiceFormValidation>[0]['selectedServiceType'];

  const formData = {
    serviceType: 'st-1',
    crane: '',
    operators: [],
    origin: 'CAMINO A MANTOVERDE, ~KM 12, POSTE 45',
    originLat: null,
    originLng: null,
    destination: '',
    destinationLat: null,
    destinationLng: null,
    vehicleBrand: '',
    vehicleModel: '',
    licensePlate: '',
    purchaseOrder: '',
    status: 'pending',
  };

  const renderValidation = (
    enforcement: Parameters<typeof useServiceFormValidation>[0]['locationEnforcement'],
  ) =>
    renderHook(() =>
      useServiceFormValidation({
        formData,
        selectedServiceType: serviceType,
        locationEnforcement: enforcement,
      }),
    ).result.current;

  it('avisa pero no bloquea un alta en pending sin coordenada', () => {
    const { blockingErrors, advisories } = renderValidation({
      isEditing: false,
      persistedStatus: null,
      originDirty: true,
    });

    expect(blockingErrors.filter((error) => error.field === 'origin')).toEqual([]);
    expect(advisories.some((error) => error.field === 'origin')).toBe(true);
  });

  // Única excepción: validate_service_location_snapshot rechaza el UPDATE de un
  // servicio con seguimiento vivo que se quede sin coordenadas.
  it('bloquea solo cuando hay link de seguimiento activo', () => {
    const { blockingErrors } = renderValidation({
      isEditing: true,
      persistedStatus: 'in_progress',
      originDirty: true,
      hasActiveTrackingLink: true,
    });

    expect(blockingErrors.some((error) => error.field === 'origin')).toBe(true);
  });
});

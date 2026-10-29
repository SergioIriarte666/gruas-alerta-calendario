import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { shouldSkipSingleVehicleRequirements, useServiceFormValidation } from '../useServiceFormValidation';
import type { ServiceType } from '@/types';

// Tipo con TODOS los requisitos de vehículo único encendidos (como quedó
// Grupaje Lowboy en la base antes de la mitigación).
const strictType = (over: Partial<ServiceType> = {}): ServiceType => ({
  id: 't',
  name: 'Grupaje Lowboy',
  isActive: true,
  vehicleInfoOptional: false,
  purchaseOrderRequired: false,
  originRequired: false,
  destinationRequired: false,
  craneRequired: false,
  operatorRequired: false,
  vehicleBrandRequired: true,
  vehicleModelRequired: true,
  licensePlateRequired: true,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const emptyVehicleForm = {
  serviceType: 't',
  crane: '',
  operators: [],
  origin: '',
  originLat: null,
  originLng: null,
  destination: '',
  destinationLat: null,
  destinationLng: null,
  vehicleBrand: '',
  vehicleModel: '',
  licensePlate: '',
  purchaseOrder: '',
  status: 'completed',
};

const vehicleFields = new Set(['vehicleBrand', 'vehicleModel', 'licensePlate']);

describe('shouldSkipSingleVehicleRequirements', () => {
  it('ignora el vehículo único en tipos multi-vehículo y en padres/hijos de viaje', () => {
    expect(shouldSkipSingleVehicleRequirements({ supportsMultiVehicle: true })).toBe(true);
    expect(shouldSkipSingleVehicleRequirements({ isMultiVehicle: true })).toBe(true);
    expect(shouldSkipSingleVehicleRequirements({ isTripParent: true })).toBe(true);
    expect(shouldSkipSingleVehicleRequirements({ isTripChild: true })).toBe(true);
    expect(shouldSkipSingleVehicleRequirements({})).toBe(false);
  });
});

describe('useServiceFormValidation con viajes multi-vehículo', () => {
  it('editar el padre no exige marca/modelo/patente aunque el tipo los marque requeridos', () => {
    const { result } = renderHook(() =>
      useServiceFormValidation({
        formData: { ...emptyVehicleForm, isTripParent: true },
        selectedServiceType: strictType(),
        locationEnforcement: { isEditing: true, persistedStatus: 'completed' },
      }),
    );
    expect(result.current.blockingErrors.filter(e => vehicleFields.has(e.field))).toEqual([]);
  });

  it('el flag supports_multi_vehicle del tipo basta para ignorar el vehículo único', () => {
    const { result } = renderHook(() =>
      useServiceFormValidation({
        formData: { ...emptyVehicleForm, isMultiVehicle: true, tripVehicles: [] },
        selectedServiceType: strictType({ supportsMultiVehicle: true }),
      }),
    );
    expect(result.current.blockingErrors.filter(e => vehicleFields.has(e.field))).toEqual([]);
    // La lista de vehículos sí se valida.
    expect(result.current.blockingErrors.map(e => e.field)).toContain('tripVehicles');
  });

  it('un tipo normal sigue exigiendo marca, modelo y patente', () => {
    const { result } = renderHook(() =>
      useServiceFormValidation({
        formData: emptyVehicleForm,
        selectedServiceType: strictType({ name: 'Traslado' }),
      }),
    );
    expect(result.current.blockingErrors.map(e => e.field).sort()).toEqual(['licensePlate', 'vehicleBrand', 'vehicleModel']);
  });
});

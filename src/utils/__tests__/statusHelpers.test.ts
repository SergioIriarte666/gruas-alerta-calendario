import { describe, expect, it } from 'vitest';
import { formatVehicleInfo, getServiceTypeDisplayName } from '../statusHelpers';

describe('formatVehicleInfo', () => {
  it('mantiene la informacion del vehiculo cuando existen datos validos', () => {
    const service = {
      vehicle_brand: 'Great Wall',
      vehicle_model: 'Poer',
      license_plate: 'TDH-80',
      service_type_name: 'Traslado',
    };

    expect(formatVehicleInfo(service)).toBe('Great Wall Poer (TDH-80)');
  });

  it('muestra el tipo de servicio cuando no existen datos del vehiculo', () => {
    const service = {
      vehicle_brand: '',
      vehicle_model: '',
      license_plate: '',
      service_type_name: 'Arriendo de Grúa Horquilla',
    };

    expect(formatVehicleInfo(service)).toBe('Arriendo de Grúa Horquilla');
  });

  it('muestra el tipo de servicio cuando los datos del vehiculo son valores no validos', () => {
    const service = {
      vehicle_brand: 'N/A',
      vehicle_model: 'N/A',
      license_plate: 'N/A',
      service_type: {
        name: 'Servicio de Custodia',
      },
    };

    expect(formatVehicleInfo(service)).toBe('Servicio de Custodia');
  });
});

describe('getServiceTypeDisplayName', () => {
  it('resuelve el tipo de servicio desde distintas estructuras de datos', () => {
    expect(
      getServiceTypeDisplayName({
        serviceType: { name: 'Rescate en Ruta' },
      })
    ).toBe('Rescate en Ruta');

    expect(
      getServiceTypeDisplayName({
        service_types: { name: 'Traslado Especial' },
      })
    ).toBe('Traslado Especial');
  });
});

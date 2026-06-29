import { describe, expect, it } from 'vitest';

import {
  REFERENCE_FUEL_SOURCE,
  mapReferenceStationFuelPrices,
} from '@/hooks/useFuelPrices';

describe('mapReferenceStationFuelPrices', () => {
  it('maps the reference station autoservicio prices to internal fuel types', () => {
    const mapped = mapReferenceStationFuelPrices({
      data: {
        id: 133,
        direccion: 'Ruta 5 Norte Km 838, Costado Nortes N° 2 S/N Ruta 5 Oriente',
        region: 'Atacama',
        comuna: 'Copiapó',
        combustibles: [
          {
            nombre_corto: '93',
            nombre_largo: 'Gasolina 93',
            precio: '1572.000',
            precio_fecha: '2026-06-25 08:00:39',
            tipo_atencion: 2,
          },
          {
            nombre_corto: '95',
            nombre_largo: 'Gasolina 95',
            precio: '1605.000',
            precio_fecha: '2026-06-25 08:00:39',
            tipo_atencion: 2,
          },
          {
            nombre_corto: 'DI',
            nombre_largo: 'Petroleo Diesel',
            precio: '1402.000',
            precio_fecha: '2026-06-25 08:00:39',
            tipo_atencion: 2,
          },
          {
            nombre_corto: 'A93',
            nombre_largo: 'Gasolina 93',
            precio: '1552.000',
            precio_fecha: '2026-06-25 08:00:39',
            tipo_atencion: 1,
          },
        ],
      },
    });

    expect(mapped).toEqual([
      {
        fuel_type: 'gasolina_93',
        price_per_liter: 1572,
        price_date: '2026-06-25',
        region: 'Atacama',
        source: REFERENCE_FUEL_SOURCE,
      },
      {
        fuel_type: 'gasolina_95',
        price_per_liter: 1605,
        price_date: '2026-06-25',
        region: 'Atacama',
        source: REFERENCE_FUEL_SOURCE,
      },
      {
        fuel_type: 'diesel',
        price_per_liter: 1402,
        price_date: '2026-06-25',
        region: 'Atacama',
        source: REFERENCE_FUEL_SOURCE,
      },
    ]);
  });
});

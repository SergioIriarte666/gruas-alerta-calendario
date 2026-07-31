import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FavoriteLocation } from '@/hooks/useFavoriteLocations';

const invoke = vi.fn();
const autocomplete = vi.fn();
const getPlaceDetails = vi.fn();
const searchPlaceForOrigin = vi.fn();
const geocodeAddressFallback = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

vi.mock('@/hooks/useGoogleMaps', () => ({
  useGoogleMaps: () => ({ autocomplete, getPlaceDetails }),
}));

vi.mock('@/services/originResolutionService', () => ({
  searchPlaceForOrigin: (...args: unknown[]) => searchPlaceForOrigin(...args),
  geocodeAddressFallback: (...args: unknown[]) => geocodeAddressFallback(...args),
}));

const mantoverde: FavoriteLocation = {
  id: 'mantoverde-id',
  name: 'Minera Mantoverde Portería',
  aliases: ['mantoverde', 'porteria mantoverde', '575FCMMC+QQ'],
  address: null,
  category: 'faena_minera',
  latitude: -26.5655608,
  longitude: -70.3280836,
  routing_access_latitude: null,
  routing_access_longitude: null,
  usage_count: 3,
};

vi.mock('@/hooks/useFavoriteLocations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useFavoriteLocations')>();
  return { ...actual, useFavoriteLocations: () => ({ data: [mantoverde] }) };
});

const { useLocationInputResolver, isResolutionFailure } = await import(
  '@/hooks/useLocationInputResolver'
);

const renderResolver = () => renderHook(() => useLocationInputResolver()).result.current.resolve;

const invokeAction = (call: unknown[]) => (call[1] as { body: { action: string } }).body.action;

describe('useLocationInputResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    autocomplete.mockResolvedValue([]);
    searchPlaceForOrigin.mockResolvedValue(null);
    geocodeAddressFallback.mockResolvedValue({ lat: null, lng: null, formattedAddress: null });
    invoke.mockResolvedValue({ data: null, error: null });
  });

  it('resuelve un alias del catálogo sin tocar la red', async () => {
    const result = await renderResolver()('porteria mantoverde');

    expect(result).toEqual({
      lat: -26.5655608,
      lng: -70.3280836,
      label: 'Minera Mantoverde Portería',
      catalogId: 'mantoverde-id',
      source: 'catalog',
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(autocomplete).not.toHaveBeenCalled();
  });

  it('resuelve un plus code guardado como alias sin geocodificar', async () => {
    const result = await renderResolver()('575fcmmc+qq');

    expect(result).toMatchObject({ catalogId: 'mantoverde-id', source: 'catalog' });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('resuelve un plus code desconocido por geocode y nunca lo deja como etiqueta', async () => {
    invoke.mockImplementation((_fn: string, options: { body: { action: string } }) => {
      if (options.body.action === 'geocode') {
        return Promise.resolve({
          // Geocoding devuelve el propio plus code como nombre del resultado.
          data: { results: [{ name: '575FCMMC+QQ', coordinates: [-70.3280625, -26.5655625] }] },
          error: null,
        });
      }
      return Promise.resolve({
        data: { address: 'C-227, Chañaral, Atacama, Chile', plusCode: '575FCMMC+QQ' },
        error: null,
      });
    });

    const result = await renderResolver()('9FR5CMMC+QQ');

    expect(result).toMatchObject({ lat: -26.5655625, lng: -70.3280625, source: 'plus_code' });
    expect((result as { label: string }).label).toBe('C-227, Chañaral');
    expect(invoke.mock.calls.map(invokeAction)).toEqual(['geocode', 'reverse_geocode']);
  });

  it('cae a "Punto en mapa" cuando el reverse geocode solo devuelve un plus code', async () => {
    invoke.mockResolvedValue({ data: { address: '575FCMMC+QQ Chañaral', plusCode: '575FCMMC+QQ' }, error: null });

    const result = await renderResolver()('-26.5655608, -70.3280836');

    expect(result).toMatchObject({ source: 'coords' });
    expect((result as { label: string }).label).toBe('Punto en mapa (-26.565561, -70.328084)');
  });

  it('resuelve un link corto por resolve_link y etiqueta con reverse geocode', async () => {
    invoke.mockImplementation((_fn: string, options: { body: { action: string } }) => {
      if (options.body.action === 'resolve_link') {
        return Promise.resolve({ data: { lat: -26.5655608, lng: -70.3280836 }, error: null });
      }
      return Promise.resolve({ data: { address: 'C-227, Chañaral, Atacama, Chile' }, error: null });
    });

    const result = await renderResolver()('https://maps.app.goo.gl/UDmo86HT5qZMwqMQ9');

    expect(result).toMatchObject({
      lat: -26.5655608,
      lng: -70.3280836,
      label: 'C-227, Chañaral',
      source: 'client_link',
    });
  });

  it('para texto libre respeta el orden autocomplete -> text_search -> geocode', async () => {
    geocodeAddressFallback.mockResolvedValue({
      lat: -27.3663,
      lng: -70.3323,
      formattedAddress: 'Ruta C-397, Copiapó, Chile',
    });

    const result = await renderResolver()('Ruta C-397');

    expect(autocomplete).toHaveBeenCalledTimes(1);
    expect(searchPlaceForOrigin).toHaveBeenCalledTimes(1);
    // Geocoding es el ultimo escalon de la cascada de texto: se registra como
    // 'places' porque el enum persistido distingue la VIA, no el proveedor.
    expect(result).toMatchObject({ lat: -27.3663, lng: -70.3323, source: 'places' });
  });

  it('ignora las sugerencias que el autocomplete resolvió por geocoding', async () => {
    // useGoogleMaps ya cae a Geocoding solo: ese resultado debe pasar antes por
    // text_search, que sabe descartar calles homónimas.
    autocomplete.mockResolvedValue([
      {
        placeId: null,
        text: 'Calle Mantos, Copiapó',
        mainText: 'Calle Mantos',
        secondaryText: 'Copiapó',
        source: 'geocode',
        coordinates: [-70.33, -27.36],
      },
    ]);
    searchPlaceForOrigin.mockResolvedValue({
      lat: -26.8129475,
      lng: -69.2698737,
      formattedAddress: 'Mina La Coipa - Mantos de Oro',
    });

    const result = await renderResolver()('Mantos de Oro');

    expect(getPlaceDetails).not.toHaveBeenCalled();
    expect(result).toMatchObject({ lat: -26.8129475, lng: -69.2698737, source: 'places' });
  });

  it('informa el fallo cuando la cascada completa no encuentra nada', async () => {
    const result = await renderResolver()('xyzz123 no existe');

    expect(isResolutionFailure(result)).toBe(true);
    expect(result).toEqual({ error: 'not_found' });
  });
});

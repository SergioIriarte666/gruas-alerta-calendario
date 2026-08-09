import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OriginLocationField,
  type OriginResolvedCoords,
} from '@/components/services/OriginLocationField';

const AEROPUERTO = {
  id: '72e6236b-a259-470e-8b67-c71db2752b3c',
  name: 'Aeropuerto Desierto de Atacama, Caldera, Copiapo',
  aliases: [],
  address: null,
  latitude: -27.2643287,
  longitude: -70.7740555,
  category: 'recurrente',
  routing_access_latitude: null,
  routing_access_longitude: null,
};

const autocomplete = vi.fn(async () => []);
const getPlaceDetails = vi.fn(async () => null);
// Lo que Google devuelve para el query a medio escribir "ae": un lugar real
// que no tiene nada que ver. Este es el valor que competia con la seleccion.
const resolve = vi.fn(async () => ({
  lat: 55.05,
  lng: -3.6,
  label: 'Ae',
  catalogId: null,
  source: 'places' as const,
}));

vi.mock('@/hooks/useFavoriteLocations', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useFavoriteLocations')>(
    '@/hooks/useFavoriteLocations',
  );
  return {
    ...actual,
    useFavoriteLocations: () => ({ data: [AEROPUERTO] }),
    useUpdateFavoriteLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCreateFavoriteLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

vi.mock('@/hooks/useGoogleMaps', () => ({
  useGoogleMaps: () => ({ autocomplete, getPlaceDetails }),
}));

vi.mock('@/hooks/useLocationInputResolver', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useLocationInputResolver')>(
    '@/hooks/useLocationInputResolver',
  );
  return { ...actual, useLocationInputResolver: () => ({ resolve }) };
});

vi.mock('@/components/services/OriginPinMap', () => ({
  OriginPinMap: () => <div data-testid="pin-map" />,
}));

vi.mock('@/components/shared/LocationPickerDialog', () => ({
  LocationPickerDialog: () => null,
}));

/** Padre controlado, con updates funcionales como el formulario real. */
const Harness = () => {
  const [value, setValue] = useState('');
  const [coords, setCoords] = useState<OriginResolvedCoords>({
    lat: null,
    lng: null,
    catalogId: null,
    source: null,
  });

  return (
    <OriginLocationField
      id="destination"
      value={value}
      onChange={setValue}
      coords={coords}
      onCoordsChange={setCoords}
      department="Copiapo"
      placeholder="Direccion o enlace de Google Maps del destino"
    />
  );
};

const getInput = () =>
  screen.getByPlaceholderText('Direccion o enlace de Google Maps del destino');

const typeQuery = async (text: string) => {
  render(<Harness />);
  const input = getInput();
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  return input;
};

describe('OriginLocationField · selección del catálogo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('el PRIMER clic completa el texto del input y fija las coordenadas', async () => {
    const input = await typeQuery('ae');
    const option = await screen.findByText(AEROPUERTO.name);

    // Secuencia real: el pointerdown saca el foco del input (programando la
    // resolucion por blur del texto a medio escribir) antes del onSelect.
    fireEvent.pointerDown(option, { pointerType: 'mouse', button: 0 });
    fireEvent.blur(input);
    fireEvent.pointerUp(option, { pointerType: 'mouse', button: 0 });
    fireEvent.click(option);

    await waitFor(() => {
      expect(screen.getByText(/-27\.264329, -70\.774056/)).toBeInTheDocument();
    });
    expect(input).toHaveValue(AEROPUERTO.name);

    // La resolucion del query viejo no debe pisar la seleccion despues.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 700));
    });
    expect(input).toHaveValue(AEROPUERTO.name);
    expect(resolve).not.toHaveBeenCalled();
  });

  // El caso real reportado: un clic pausado (mousedown y mouseup separados por
  // mas de BLUR_RESOLVE_DELAY_MS). El blur del pointerdown alcanza a disparar
  // la resolucion del texto a medio escribir antes de que corra el onSelect.
  it('un clic pausado tampoco deja que la resolucion del query viejo gane', async () => {
    const input = await typeQuery('ae');
    const option = await screen.findByText(AEROPUERTO.name);

    fireEvent.pointerDown(option, { pointerType: 'mouse', button: 0 });
    fireEvent.blur(input);

    // El usuario mantiene el boton apretado mas de 200 ms.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    fireEvent.pointerUp(option, { pointerType: 'mouse', button: 0 });
    fireEvent.click(option);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    expect(input).toHaveValue(AEROPUERTO.name);
    expect(screen.getByText(/-27\.264329, -70\.774056/)).toBeInTheDocument();
  });

  it('flecha abajo + Enter dan el mismo resultado que el clic', async () => {
    const input = await typeQuery('ae');
    await screen.findByText(AEROPUERTO.name);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/-27\.264329, -70\.774056/)).toBeInTheDocument();
    });
    expect(input).toHaveValue(AEROPUERTO.name);
  });

  it('el primer clic también completa un resultado de Google', async () => {
    autocomplete.mockResolvedValueOnce([
      {
        placeId: 'ChIJ-mina',
        source: 'places',
        text: 'Minera Mantoverde, Chañaral',
        mainText: 'Minera Mantoverde',
        secondaryText: 'Chañaral',
      },
    ] as never);
    getPlaceDetails.mockResolvedValueOnce({
      lat: -26.5,
      lng: -70.5,
      formattedAddress: 'Minera Mantoverde, Chañaral, Atacama, Chile',
    } as never);

    const input = await typeQuery('mantoverde');
    const option = await screen.findByText('Minera Mantoverde');

    fireEvent.pointerDown(option, { pointerType: 'mouse', button: 0 });
    fireEvent.blur(input);
    fireEvent.pointerUp(option, { pointerType: 'mouse', button: 0 });
    fireEvent.click(option);

    await waitFor(() => {
      expect(screen.getByText(/-26\.500000, -70\.500000/)).toBeInTheDocument();
    });
    expect(input).toHaveValue('Minera Mantoverde, Chañaral');

    await act(async () => {
      await new Promise((r) => setTimeout(r, 700));
    });
    expect(input).toHaveValue('Minera Mantoverde, Chañaral');
  });

  it('teclear y seleccionar antes del debounce no revierte el texto', async () => {
    const input = await typeQuery('a');
    fireEvent.change(input, { target: { value: 'ae' } });

    const option = await screen.findByText(AEROPUERTO.name);
    fireEvent.pointerDown(option, { pointerType: 'mouse', button: 0 });
    fireEvent.blur(input);
    fireEvent.click(option);

    // Mas alla del debounce de Places (300 ms) y del blur (200 ms).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 800));
    });

    expect(input).toHaveValue(AEROPUERTO.name);
    expect(resolve).not.toHaveBeenCalled();
  });
});

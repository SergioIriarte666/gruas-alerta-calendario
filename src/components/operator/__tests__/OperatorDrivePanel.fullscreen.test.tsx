import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperatorLocationPoint } from '@/types/operatorLocation';

const mapboxState = vi.hoisted(() => ({
  maps: [] as Array<{
    remove: ReturnType<typeof vi.fn>;
  }>,
  markers: [] as Array<{
    setLngLat: ReturnType<typeof vi.fn>;
  }>,
  emitLoad: true,
  alreadyLoaded: false,
}));

const previewPoint: OperatorLocationPoint = {
  latitude: -27.366,
  longitude: -70.332,
  accuracyMeters: 8,
  speedMps: 0,
  headingDegrees: null,
  altitudeMeters: null,
  recordedAt: '2026-07-27T20:01:00.000Z',
};

vi.mock('@/services/operatorLocationService', () => ({
  checkLocationPermission: vi.fn(async () => 'granted'),
  getCurrentLocationPoint: vi.fn(async () => previewPoint),
}));

vi.mock('@/lib/loadMapbox', () => {
  class FakeMap {
    remove = vi.fn();
    addControl = vi.fn();
    resize = vi.fn();
    triggerRepaint = vi.fn();
    easeTo = vi.fn();
    getZoom = vi.fn(() => 15.5);
    loaded = vi.fn(() => mapboxState.alreadyLoaded);
    isStyleLoaded = vi.fn(() => mapboxState.alreadyLoaded);

    constructor() {
      mapboxState.maps.push(this);
    }

    on(event: string, callback: () => void) {
      if (event === 'load' && mapboxState.emitLoad) queueMicrotask(callback);
      return this;
    }
  }

  class FakeMarker {
    setLngLat = vi.fn(() => this);

    constructor() {
      mapboxState.markers.push(this);
    }

    addTo() {
      return this;
    }

    remove() {}
  }

  return {
    loadMapbox: vi.fn(async () => ({
      default: {
        accessToken: '',
        Map: FakeMap,
        Marker: FakeMarker,
        AttributionControl: class {},
      },
    })),
  };
});

const point: OperatorLocationPoint = {
  latitude: -27.37,
  longitude: -70.33,
  accuracyMeters: 5,
  speedMps: 10,
  headingDegrees: 45,
  altitudeMeters: null,
  recordedAt: '2026-07-27T20:00:00.000Z',
};

describe('OperatorDrivePanel fullscreen map', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MAPBOX_PUBLIC_TOKEN', 'test-token');
    mapboxState.maps.length = 0;
    mapboxState.markers.length = 0;
    mapboxState.emitLoad = true;
    mapboxState.alreadyLoaded = false;
  });

  it('creates the fullscreen WebGL map at viewport size instead of resizing the compact canvas', async () => {
    const { OperatorDrivePanel } = await import('@/components/operator/OperatorDrivePanel');

    render(<OperatorDrivePanel isTracking point={point} />);

    const expandButton = await screen.findByRole('button', {
      name: 'Abrir mapa en pantalla completa',
    });
    expect(mapboxState.maps).toHaveLength(1);
    const compactMap = mapboxState.maps[0];

    fireEvent.click(expandButton);

    const dialog = await screen.findByRole('dialog', {
      name: 'Mapa ampliado de mi posición',
    });
    expect(document.body).toContainElement(dialog);
    await waitFor(() => expect(mapboxState.maps).toHaveLength(2));
    expect(compactMap.remove).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar mapa ampliado' }));

    await waitFor(() => expect(mapboxState.maps).toHaveLength(3));
    expect(mapboxState.maps[1].remove).toHaveBeenCalledOnce();
  });

  it('shows the current device position even when transmission is inactive', async () => {
    const { OperatorDrivePanel } = await import('@/components/operator/OperatorDrivePanel');

    render(<OperatorDrivePanel isTracking={false} point={null} />);

    await waitFor(() => expect(mapboxState.markers).toHaveLength(1));
    expect(mapboxState.markers[0].setLngLat).toHaveBeenCalledWith([
      previewPoint.longitude,
      previewPoint.latitude,
    ]);
  });

  it('becomes ready when WKWebView already loaded the cached map style', async () => {
    mapboxState.emitLoad = false;
    mapboxState.alreadyLoaded = true;
    const { OperatorDrivePanel } = await import('@/components/operator/OperatorDrivePanel');

    render(<OperatorDrivePanel isTracking point={point} />);

    expect(await screen.findByRole('button', {
      name: 'Abrir mapa en pantalla completa',
    })).toBeInTheDocument();
  });
});

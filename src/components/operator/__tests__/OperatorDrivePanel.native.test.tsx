import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperatorLocationPoint } from '@/types/operatorLocation';

const nativeState = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({
    data: { session: { access_token: 'operator-session-token' } },
  })),
  mapOptions: [] as Array<Record<string, unknown>>,
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: nativeState.getSession,
    },
  },
}));

vi.mock('@/services/operatorLocationService', () => ({
  checkLocationPermission: vi.fn(async () => 'granted'),
  getCurrentLocationPoint: vi.fn(async () => null),
}));

vi.mock('@/lib/loadMapbox', () => {
  class FakeMap {
    addControl = vi.fn();
    resize = vi.fn();
    triggerRepaint = vi.fn();
    easeTo = vi.fn();
    getZoom = vi.fn(() => 15.5);
    loaded = vi.fn(() => false);
    isStyleLoaded = vi.fn(() => false);
    remove = vi.fn();

    constructor(options: Record<string, unknown>) {
      nativeState.mapOptions.push(options);
    }

    on(event: string, callback: () => void) {
      if (event === 'load') queueMicrotask(callback);
      return this;
    }
  }

  class FakeMarker {
    setLngLat = vi.fn(() => this);

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
  latitude: -27.346194,
  longitude: -70.631239,
  accuracyMeters: 3,
  speedMps: 0,
  headingDegrees: null,
  altitudeMeters: 180,
  recordedAt: '2026-07-27T22:59:32.000Z',
};

describe('OperatorDrivePanel native map', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MAPBOX_PUBLIC_TOKEN', 'restricted-web-token');
    vi.stubEnv('VITE_MAPBOX_MOBILE_TOKEN', '');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-key');
    nativeState.mapOptions.length = 0;
    nativeState.getSession.mockClear();
  });

  it('keeps Mapbox interactive and proxies its protected resources', async () => {
    const { OperatorDrivePanel } = await import('@/components/operator/OperatorDrivePanel');
    const { container } = render(<OperatorDrivePanel isTracking point={point} />);

    await waitFor(() => expect(nativeState.mapOptions).toHaveLength(1));
    expect(nativeState.getSession).toHaveBeenCalledOnce();

    const transformRequest = nativeState.mapOptions[0].transformRequest as (
      url: string,
      resourceType: string,
    ) => { url: string; headers?: Record<string, string> };
    expect(transformRequest).toBeTypeOf('function');

    const transformed = transformRequest(
      'https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=restricted-web-token',
      'Style',
    );
    expect(transformed.url).toContain(
      'https://example.supabase.co/functions/v1/mapbox-proxy?resource_url=',
    );
    expect(decodeURIComponent(transformed.url)).not.toContain('restricted-web-token');
    expect(transformed.headers).toEqual({
      apikey: 'publishable-key',
      Authorization: 'Bearer operator-session-token',
    });

    const transformedTile = transformRequest(
      'https://a.tiles.mapbox.com/v4/mapbox.mapbox-streets-v8/15/9954/19150.vector.pbf?access_token=server-token',
      'Tile',
    );
    expect(transformedTile.url).toContain('/functions/v1/mapbox-proxy?resource_url=');
    expect(decodeURIComponent(transformedTile.url)).not.toContain('server-token');

    expect(container.querySelector('.operator-drive-map__native-image')).toBeNull();
    expect(await screen.findByRole('button', {
      name: 'Abrir mapa en pantalla completa',
    })).toBeInTheDocument();
  });
});

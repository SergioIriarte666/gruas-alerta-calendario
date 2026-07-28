import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperatorLocationPoint } from '@/types/operatorLocation';

const authState = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({
    data: { session: { access_token: 'operator-session-token' } },
  })),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: authState.getSession,
    },
  },
}));

vi.mock('@/services/operatorLocationService', () => ({
  checkLocationPermission: vi.fn(async () => 'granted'),
  getCurrentLocationPoint: vi.fn(async () => null),
}));

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
    vi.stubEnv('VITE_MAPBOX_MOBILE_TOKEN', '');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-key');
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => new Blob(['png'], { type: 'image/png' }),
    } as Response)));
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:native-map'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('requests a point-centered image and waits for iOS to decode it', async () => {
    const { OperatorDrivePanel } = await import('@/components/operator/OperatorDrivePanel');
    const { container } = render(<OperatorDrivePanel isTracking point={point} />);

    const mapImage = await waitFor(() => {
      const image = container.querySelector<HTMLImageElement>(
        '.operator-drive-map__native-image',
      );
      expect(image).not.toBeNull();
      return image!;
    });

    expect(screen.getByText('Cargando mapa')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledOnce();

    const [, request] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(request?.body))).toEqual({
      action: 'static_point_map',
      coordinates: [-70.631, -27.346],
    });

    fireEvent.load(mapImage);

    expect(await screen.findByRole('button', {
      name: 'Abrir mapa en pantalla completa',
    })).toBeInTheDocument();
    expect(screen.queryByText('Cargando mapa')).not.toBeInTheDocument();
  });
});

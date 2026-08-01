import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Service } from '@/types';

/**
 * El botón de compartir de la tarjeta de transmisión.
 *
 * Lo que se protege aquí es la asimetría que reportó el operador: SIN servicio
 * el botón se veía normal y el toque no hacía absolutamente nada —sin toast, sin
 * estado deshabilitado—, así que no podía distinguir "falló la app" de "no hay
 * nada que compartir". Y, del otro lado, que el camino bueno (servicio en
 * `pending` → share sheet nativo) siguiera intacto.
 */

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  share: vi.fn(),
  toastInfo: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  resumeTracking: vi.fn(async () => {}),
  currentService: null as Service | null,
}));

vi.mock('sonner', () => ({
  toast: {
    info: state.toastInfo,
    error: state.toastError,
    success: state.toastSuccess,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: state.rpc },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock('@/services/operatorLocationService', () => ({
  checkLocationPermission: vi.fn(async () => 'granted'),
}));

vi.mock('@/native/operatorRelaunch', () => ({
  isRelaunchProtected: () => true,
  readRelaunchStatus: vi.fn(async () => null),
}));

vi.mock('@/utils/keepAwake', () => ({
  KEEP_AWAKE_DENIED_MESSAGE: 'denegado',
  keepAwakeSafely: vi.fn(async () => 'granted'),
  subscribeKeepAwake: () => () => {},
}));

// El panel del mapa arrastra Mapbox entero y no participa de este flujo.
vi.mock('@/components/operator/OperatorDrivePanel', () => ({
  OperatorDrivePanel: () => null,
}));

// La transmisión y la selección de servicio ya no las resuelve el componente:
// las lee del provider que vive sobre el router (OperatorTransmissionProvider).
vi.mock('@/contexts/OperatorTransmissionContext', () => ({
  useOperatorTransmission: () => ({
    isTracking: false,
    isBusy: false,
    lastPoint: null,
    lastSyncAt: null,
    pendingCount: 0,
    errorMessage: null,
    trackingDisabled: false,
    manualStop: false,
    resumeTracking: state.resumeTracking,
    stopTransmission: vi.fn(),
    startTransmissionAutomatically: vi.fn(),
    trackingService: state.currentService,
    activeService: null,
    candidates: [],
    requiresSelection: false,
    selectService: vi.fn(),
  }),
}));

vi.mock('@/hooks/operator/useServiceStopEvent', () => ({
  useServiceStopEvent: () => ({
    stopEvent: null,
    minutesStopped: 0,
    isBusy: false,
    declareStop: vi.fn(),
    resume: vi.fn(),
  }),
}));

vi.mock('@/hooks/operator/useAutoTransmissionOnMovement', () => ({
  useAutoTransmissionOnMovement: () => ({ isRollingWithoutTransmitting: false }),
}));

const pendingService = {
  id: 'srv-1',
  folio: 'SRV-6900',
  status: 'pending',
  licensePlate: 'ABCD12',
  client: { name: 'Cliente Demo' },
} as unknown as Service;

const renderControl = async (currentService: Service | null) => {
  state.currentService = currentService;
  const { TransmissionControl } = await import('@/components/operator/TransmissionControl');
  return render(
    <MemoryRouter>
      <TransmissionControl operatorId="op-1" />
    </MemoryRouter>,
  );
};

const shareButton = () => screen.getByRole('button', { name: /compartir|sin servicio asignado/i });

describe('TransmissionControl · botón de compartir', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.rpc.mockImplementation(async (fn: string) => {
      if (fn === 'get_operator_service_tracking_token') return { data: 'tok-123', error: null };
      if (fn === 'service_has_active_tracking_link') return { data: false, error: null };
      return { data: null, error: null };
    });
  });

  it('sin servicio asignado: deshabilitado, rotulado, y el toque explica por qué', async () => {
    await renderControl(null);

    const button = shareButton();
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName('Sin servicio asignado para compartir');
    expect(button.className).toContain('opacity-40');

    // El toque cae en la envoltura, porque el botón deshabilitado no recibe
    // eventos. Sin ella esto sería el silencio que reportó el operador.
    fireEvent.click(button.parentElement as HTMLElement);

    expect(state.toastInfo).toHaveBeenCalledWith('No tienes servicios asignados para compartir');
    // Nunca se pide un token sin servicio.
    expect(state.rpc).not.toHaveBeenCalledWith('get_operator_service_tracking_token', expect.anything());
  });

  it('con un servicio en pending: abre el share sheet con folio y link /track/<token>', async () => {
    state.share.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: state.share, configurable: true });

    await renderControl(pendingService);

    // El token se pre-carga al montar: compartir tiene que ser síncrono dentro
    // del gesto.
    await waitFor(() =>
      expect(state.rpc).toHaveBeenCalledWith('get_operator_service_tracking_token', {
        p_service_id: 'srv-1',
      }),
    );

    const button = shareButton();
    expect(button).toBeEnabled();
    expect(button).toHaveAccessibleName('Compartir seguimiento con el cliente');

    fireEvent.click(button);

    await waitFor(() =>
      expect(state.share).toHaveBeenCalledWith({
        title: 'Seguimiento SRV-6900',
        url: 'https://app.gruas5norte.cl/track/tok-123',
      }),
    );
    await waitFor(() =>
      expect(state.rpc).toHaveBeenCalledWith('mark_service_tracking_link_shared', {
        p_service_id: 'srv-1',
      }),
    );
    expect(state.toastError).not.toHaveBeenCalled();
  });

  it('si la generación del token falla, el error real llega al operador', async () => {
    // Sin navigator.share y con la RPC caída: se recorre el camino de respaldo.
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    state.rpc.mockImplementation(async (fn: string) => {
      if (fn === 'get_operator_service_tracking_token') {
        return { data: null, error: { message: 'JWT expired' } };
      }
      return { data: false, error: null };
    });

    await renderControl(pendingService);

    fireEvent.click(shareButton());

    await waitFor(() =>
      expect(state.toastError).toHaveBeenCalledWith('JWT expired', expect.objectContaining({
        description: expect.stringContaining('conexión'),
      })),
    );
  });
});

import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useClientNotifications } from '../useClientNotifications';

const mocks = vi.hoisted(() => {
  const state: {
    callback: ((payload: any) => void) | null;
    config: Record<string, any> | null;
  } = {
    callback: null,
    config: null,
  };

  const mockInvalidateQueries = vi.fn();
  const mockInvoke = vi.fn().mockResolvedValue({});
  const mockRemoveChannel = vi.fn();
  const mockSubscribe = vi.fn();
  const mockChannel = {
    on: vi.fn((event: string, config: Record<string, any>, callback: (payload: any) => void) => {
      state.config = config;
      state.callback = callback;
      return mockChannel;
    }),
    subscribe: mockSubscribe,
  };
  const mockChannelFactory = vi.fn(() => mockChannel);
  const mockUseUser = vi.fn();
  const mockToastInfo = vi.fn();

  return {
    state,
    mockInvalidateQueries,
    mockInvoke,
    mockRemoveChannel,
    mockSubscribe,
    mockChannel,
    mockChannelFactory,
    mockUseUser,
    mockToastInfo,
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.mockInvalidateQueries,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: mocks.mockChannelFactory,
    removeChannel: mocks.mockRemoveChannel,
    functions: {
      invoke: mocks.mockInvoke,
    },
  },
}));

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => mocks.mockUseUser(),
}));

vi.mock('sonner', () => ({
  toast: {
    info: mocks.mockToastInfo,
  },
}));

describe('useClientNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.callback = null;
    mocks.state.config = null;
  });

  it('no se suscribe si el usuario no es client', () => {
    mocks.mockUseUser.mockReturnValue({
      user: { role: 'admin', client_id: 'c1' },
    });

    renderHook(() => useClientNotifications());

    expect(mocks.mockChannelFactory).not.toHaveBeenCalled();
  });

  it('no se suscribe si el usuario no tiene client_id', () => {
    mocks.mockUseUser.mockReturnValue({
      user: { role: 'client', client_id: undefined },
    });

    renderHook(() => useClientNotifications());

    expect(mocks.mockChannelFactory).not.toHaveBeenCalled();
  });

  it('se suscribe con el filtro correcto', () => {
    mocks.mockUseUser.mockReturnValue({
      user: { role: 'client', client_id: 'cid-123', id: 'uid-1' },
    });

    renderHook(() => useClientNotifications());

    expect(mocks.mockChannelFactory).toHaveBeenCalledWith('client-services-cid-123');
    expect(mocks.mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        filter: 'client_id=eq.cid-123',
      }),
      expect.any(Function)
    );
  });

  it('invalida la cache cuando cambia el estado', () => {
    mocks.mockUseUser.mockReturnValue({
      user: { role: 'client', client_id: 'cid-123', id: 'uid-1' },
    });

    renderHook(() => useClientNotifications());

    act(() => {
      mocks.state.callback?.({
        old: { status: 'pending' },
        new: { status: 'in_progress', folio: 'F-001', id: 'svc-1' },
      });
    });

    expect(mocks.mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['clientServices', 'cid-123'],
    });
    expect(mocks.mockToastInfo).toHaveBeenCalledWith('Servicio F-001', {
      description: 'Tu grua esta en camino',
    });
  });

  it('no invalida ni notifica si el status no cambia', () => {
    mocks.mockUseUser.mockReturnValue({
      user: { role: 'client', client_id: 'cid-123', id: 'uid-1' },
    });

    renderHook(() => useClientNotifications());

    act(() => {
      mocks.state.callback?.({
        old: { status: 'pending' },
        new: { status: 'pending', folio: 'F-001', id: 'svc-1' },
      });
    });

    expect(mocks.mockInvalidateQueries).not.toHaveBeenCalled();
    expect(mocks.mockToastInfo).not.toHaveBeenCalled();
  });

  it('limpia el canal al desmontar', () => {
    mocks.mockUseUser.mockReturnValue({
      user: { role: 'client', client_id: 'cid-123', id: 'uid-1' },
    });

    const { unmount } = renderHook(() => useClientNotifications());
    unmount();

    expect(mocks.mockRemoveChannel).toHaveBeenCalledWith(mocks.mockChannel);
  });
});

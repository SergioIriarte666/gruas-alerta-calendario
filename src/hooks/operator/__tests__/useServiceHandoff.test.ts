import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { rpcMock, fromMock, getUserMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
    auth: { getUser: getUserMock },
  },
}));

import { useConfirmServiceHandoff, usePendingServiceHandoff } from '../useServiceHandoff';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
};

describe('useConfirmServiceHandoff', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    getUserMock.mockReset();
  });

  // Doble llave id + folio: el folio que la pantalla del operador muestra viaja
  // junto al id. Si la pantalla quedó desfasada, el servidor rechaza en vez de
  // confirmar el traspaso del servicio equivocado.
  it('manda el folio de pantalla junto al id', async () => {
    rpcMock.mockResolvedValue({ data: 'handoff-1', error: null });

    const { result } = renderHook(() => useConfirmServiceHandoff(), { wrapper });

    await result.current.mutateAsync({
      serviceId: 'service-1',
      folio: '3262047-1',
      photoPaths: ['service-1/handoff-a.jpg', 'service-1/handoff-b.jpg'],
      notes: 'rayón previo',
    });

    expect(rpcMock).toHaveBeenCalledWith('confirm_service_handoff', {
      p_service_id: 'service-1',
      p_folio: '3262047-1',
      p_photo_paths: ['service-1/handoff-a.jpg', 'service-1/handoff-b.jpg'],
      p_notes: 'rayón previo',
    });
  });

  it('propaga el rechazo del servidor en vez de darlo por confirmado', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Debes adjuntar entre 2 y 4 fotos del estado de la carga (recibidas: 1)' },
    });

    const { result } = renderHook(() => useConfirmServiceHandoff(), { wrapper });

    await expect(
      result.current.mutateAsync({
        serviceId: 'service-1',
        folio: '3262047-1',
        photoPaths: ['service-1/handoff-a.jpg'],
      })
    ).rejects.toThrow(/entre 2 y 4 fotos/);
  });
});

describe('usePendingServiceHandoff', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    getUserMock.mockReset();
  });

  // El traspaso pendiente es del operador ENTRANTE. El saliente ve el registro
  // en el expediente pero no tiene nada que confirmar, así que la consulta filtra
  // por su operator_id y no solo por el servicio.
  it('consulta solo los traspasos sin confirmar dirigidos al operador actual', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-b' } } });

    const filters: Record<string, unknown> = {};
    const handoffQuery = {
      select: () => handoffQuery,
      eq: (column: string, value: unknown) => { filters[column] = value; return handoffQuery; },
      is: (column: string, value: unknown) => { filters[column] = value; return handoffQuery; },
      maybeSingle: async () => ({ data: null, error: null }),
    };

    fromMock.mockImplementation((table: string) => {
      if (table === 'operators') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { id: 'operator-b' }, error: null }) }),
          }),
        };
      }
      return handoffQuery;
    });

    const { result } = renderHook(() => usePendingServiceHandoff('service-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(filters.service_id).toBe('service-1');
    expect(filters.incoming_operator_id).toBe('operator-b');
    expect(filters.confirmed_at).toBeNull();
  });
});

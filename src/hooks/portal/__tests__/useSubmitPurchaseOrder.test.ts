import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSubmitPurchaseOrder } from '../useSubmitPurchaseOrder';

const mocks = vi.hoisted(() => {
  const mockInvalidateQueries = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockUseUser = vi.fn();
  const mockEq = vi.fn();
  const mockUpdate = vi.fn();
  const mockFrom = vi.fn();

  return {
    mockInvalidateQueries,
    mockToastSuccess,
    mockToastError,
    mockUseUser,
    mockEq,
    mockUpdate,
    mockFrom,
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.mockInvalidateQueries,
  }),
  useMutation: ({ mutationFn, onSuccess, onError }: any) => ({
    mutateAsync: async (variables: any) => {
      try {
        const result = await mutationFn(variables);
        await onSuccess?.(result, variables, undefined);
        return result;
      } catch (error) {
        await onError?.(error, variables, undefined);
        throw error;
      }
    },
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.mockFrom,
  },
}));

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => mocks.mockUseUser(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.mockToastSuccess,
    error: mocks.mockToastError,
  },
}));

describe('useSubmitPurchaseOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mockUseUser.mockReturnValue({
      user: { client_id: 'client-123' },
    });

    mocks.mockEq.mockResolvedValue({ error: null });
    mocks.mockUpdate.mockReturnValue({
      eq: mocks.mockEq,
    });
    mocks.mockFrom.mockReturnValue({
      update: mocks.mockUpdate,
    });
  });

  it('escribe purchase_order_number y cambia status a pending', async () => {
    const { result } = renderHook(() => useSubmitPurchaseOrder());

    await act(async () => {
      await result.current.mutateAsync({
        serviceId: 'svc-1',
        purchaseOrderNumber: 'OC-2024-001',
      });
    });

    expect(mocks.mockFrom).toHaveBeenCalledWith('services');
    expect(mocks.mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        purchase_order_number: 'OC-2024-001',
        status: 'pending',
      })
    );
  });

  it('incluye quote_number cuando se proporciona', async () => {
    const { result } = renderHook(() => useSubmitPurchaseOrder());

    await act(async () => {
      await result.current.mutateAsync({
        serviceId: 'svc-1',
        purchaseOrderNumber: 'OC-2024-001',
        quoteNumber: 'COT-24-001',
      });
    });

    expect(mocks.mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        purchase_order_number: 'OC-2024-001',
        status: 'pending',
        quote_number: 'COT-24-001',
      })
    );
  });

  it('no incluye quote_number si esta vacio', async () => {
    const { result } = renderHook(() => useSubmitPurchaseOrder());

    await act(async () => {
      await result.current.mutateAsync({
        serviceId: 'svc-1',
        purchaseOrderNumber: 'OC-2024-001',
      });
    });

    const payload = mocks.mockUpdate.mock.calls[0][0];
    expect(payload).not.toHaveProperty('quote_number');
  });

  it('invalida cache clientServices en onSuccess', async () => {
    const { result } = renderHook(() => useSubmitPurchaseOrder());

    await act(async () => {
      await result.current.mutateAsync({
        serviceId: 'svc-1',
        purchaseOrderNumber: 'OC-2024-001',
      });
    });

    expect(mocks.mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['clientServices', 'client-123'],
    });
  });

  it('muestra toast de exito en onSuccess', async () => {
    const { result } = renderHook(() => useSubmitPurchaseOrder());

    await act(async () => {
      await result.current.mutateAsync({
        serviceId: 'svc-1',
        purchaseOrderNumber: 'OC-2024-001',
      });
    });

    expect(mocks.mockToastSuccess).toHaveBeenCalled();
  });

  it('muestra toast de error en onError', async () => {
    mocks.mockEq.mockResolvedValue({
      error: { message: 'Database error' },
    });

    const { result } = renderHook(() => useSubmitPurchaseOrder());

    await expect(
      result.current.mutateAsync({
        serviceId: 'svc-1',
        purchaseOrderNumber: 'OC-2024-001',
      })
    ).rejects.toEqual({ message: 'Database error' });

    expect(mocks.mockToastError).toHaveBeenCalled();
    expect(mocks.mockInvalidateQueries).not.toHaveBeenCalled();
  });
});

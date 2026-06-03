import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSubmitPurchaseOrder } from '../useSubmitPurchaseOrder';

const mocks = vi.hoisted(() => {
  const mockInvalidateQueries = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockUseUser = vi.fn();
  const mockUseClientBranding = vi.fn();
  const mockEq = vi.fn();
  const mockUpdate = vi.fn();
  const mockFrom = vi.fn();
  const mockInvoke = vi.fn();

  return {
    mockInvalidateQueries,
    mockToastSuccess,
    mockToastError,
    mockUseUser,
    mockUseClientBranding,
    mockEq,
    mockUpdate,
    mockFrom,
    mockInvoke,
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
    functions: {
      invoke: mocks.mockInvoke,
    },
  },
}));

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => mocks.mockUseUser(),
}));

vi.mock('@/hooks/portal/useClientBranding', () => ({
  useClientBranding: () => mocks.mockUseClientBranding(),
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
    mocks.mockUseClientBranding.mockReturnValue({
      data: { companyName: 'Cliente Branding' },
    });

    mocks.mockEq.mockResolvedValue({ error: null });
    mocks.mockUpdate.mockReturnValue({
      eq: mocks.mockEq,
    });
    mocks.mockFrom.mockReturnValue({
      update: mocks.mockUpdate,
    });
    mocks.mockInvoke.mockResolvedValue({ data: null, error: null });
  });

  it('escribe purchase_order_number y cambia status a pending', async () => {
    const { result } = renderHook(() => useSubmitPurchaseOrder());

    await act(async () => {
      await result.current.mutateAsync({
        serviceId: 'svc-1',
        purchaseOrderNumber: 'OC-2024-001',
        serviceFolio: 'SRV-001',
        serviceValue: 600000,
        clientCompanyName: 'Arrendadora S.A.',
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
        serviceFolio: 'SRV-001',
        serviceValue: 600000,
        clientCompanyName: 'Arrendadora S.A.',
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
        serviceFolio: 'SRV-001',
        serviceValue: 600000,
        clientCompanyName: 'Arrendadora S.A.',
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
        serviceFolio: 'SRV-001',
        serviceValue: 600000,
        clientCompanyName: 'Arrendadora S.A.',
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
        serviceFolio: 'SRV-001',
        serviceValue: 600000,
        clientCompanyName: 'Arrendadora S.A.',
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
        serviceFolio: 'SRV-001',
        serviceValue: 600000,
        clientCompanyName: 'Arrendadora S.A.',
      })
    ).rejects.toEqual({ message: 'Database error' });

    expect(mocks.mockToastError).toHaveBeenCalled();
    expect(mocks.mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('envia notificacion de WhatsApp al admin con el payload esperado', async () => {
    const { result } = renderHook(() => useSubmitPurchaseOrder());

    await act(async () => {
      await result.current.mutateAsync({
        serviceId: 'svc-1',
        purchaseOrderNumber: 'OC-2024-001',
        quoteNumber: 'COT-24-001',
        serviceFolio: 'SRV-6412',
        serviceValue: 600000,
        clientCompanyName: 'Arrendadora S.A.',
      });
    });

    expect(mocks.mockInvoke).toHaveBeenCalledWith('send-whatsapp-admin', {
      body: {
        event: 'admin_orden_compra',
        data: {
          proveedor: 'Arrendadora S.A.',
          monto: '$600.000',
          descripcion: 'OC OC-2024-001 · Cotizacion COT-24-001 · Servicio SRV-6412',
        },
      },
    });
  });

  it('no bloquea el exito si falla la notificacion de WhatsApp', async () => {
    mocks.mockInvoke.mockRejectedValueOnce(new Error('WhatsApp failed'));

    const { result } = renderHook(() => useSubmitPurchaseOrder());

    await act(async () => {
      await result.current.mutateAsync({
        serviceId: 'svc-1',
        purchaseOrderNumber: 'OC-2024-001',
        serviceFolio: 'SRV-001',
        serviceValue: 600000,
        clientCompanyName: 'Arrendadora S.A.',
      });
    });

    expect(mocks.mockUpdate).toHaveBeenCalled();
    expect(mocks.mockToastSuccess).toHaveBeenCalled();
    expect(mocks.mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['clientServices', 'client-123'],
    });
  });
});

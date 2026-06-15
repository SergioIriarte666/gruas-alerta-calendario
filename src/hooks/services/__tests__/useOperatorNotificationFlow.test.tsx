import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOperatorNotificationFlow } from '../useOperatorNotificationFlow';
import { Service } from '@/types';

const mocks = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockUseUser: vi.fn(),
  mockLogUserActivity: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastInfo: vi.fn(),
  mockToastWarning: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mocks.mockInvoke,
    },
  },
}));

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => mocks.mockUseUser(),
}));

vi.mock('@/utils/activityLog', () => ({
  logUserActivity: mocks.mockLogUserActivity,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.mockToastSuccess,
    info: mocks.mockToastInfo,
    warning: mocks.mockToastWarning,
  },
}));

const serviceFixture: Service = {
  id: 'service-1',
  folio: 'SRV-1001',
  requestDate: '2026-06-15',
  serviceDate: '2026-06-15',
  client: {
    id: 'client-1',
    name: 'Cliente Demo',
    rut: '11.111.111-1',
    phone: '+56911111111',
    email: 'cliente@test.cl',
    address: 'Direccion 123',
    department: 'Operaciones',
    isActive: true,
    createdAt: '2026-06-15T00:00:00.000Z',
    updatedAt: '2026-06-15T00:00:00.000Z',
  },
  purchaseOrder: '',
  quoteNumber: '',
  vehicleBrand: 'Toyota',
  vehicleModel: 'Hilux',
  licensePlate: 'ABCD11',
  origin: 'Origen',
  destination: 'Destino',
  serviceType: {
    id: 'type-1',
    name: 'Grua',
    description: '',
    basePrice: 1000,
    isActive: true,
    vehicleInfoOptional: false,
    purchaseOrderRequired: false,
    originRequired: true,
    destinationRequired: true,
    craneRequired: true,
    operatorRequired: true,
    vehicleBrandRequired: false,
    vehicleModelRequired: false,
    licensePlateRequired: false,
    createdAt: '2026-06-15T00:00:00.000Z',
    updatedAt: '2026-06-15T00:00:00.000Z',
  },
  value: 150000,
  crane: null,
  operator: {
    id: 'operator-1',
    name: 'Operador Demo',
    rut: '22.222.222-2',
    phone: '+56922222222',
    licenseNumber: 'LIC-1',
    isActive: true,
    createdAt: '2026-06-15T00:00:00.000Z',
    updatedAt: '2026-06-15T00:00:00.000Z',
    examExpiry: '',
    operatorType: 'crane_operator',
  },
  operatorCommission: 0,
  status: 'pending',
  observations: '',
  hasExcess: false,
  clientCoveredAmount: null,
  excessAmount: 0,
  thirdPartyClientId: null,
  contactPerson: 'Contacto Demo',
  contactPhone: '+56933333333',
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z',
};

describe('useOperatorNotificationFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUseUser.mockReturnValue({
      user: { id: 'user-1' },
    });
    mocks.mockInvoke.mockResolvedValue({
      data: { success: true, messageId: 'wamid.1' },
      error: null,
    });
  });

  it('abre el flujo de confirmacion despues de inicializarse con un servicio creado', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useOperatorNotificationFlow({ onComplete }));

    act(() => {
      result.current.openNotificationPrompt(serviceFixture, 'operator-1');
    });

    expect(result.current.confirmOpen).toBe(true);
    expect(result.current.retryOpen).toBe(false);
    expect(mocks.mockInvoke).not.toHaveBeenCalled();
  });

  it('envia WhatsApp solo cuando se confirma con "Sí"', async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useOperatorNotificationFlow({ onComplete }));

    act(() => {
      result.current.openNotificationPrompt(serviceFixture, 'operator-1');
    });

    await act(async () => {
      await result.current.confirmNotification();
    });

    expect(mocks.mockInvoke).toHaveBeenCalledWith('send-whatsapp-operator', {
      body: expect.objectContaining({
        operatorId: 'operator-1',
        serviceId: serviceFixture.id,
        folio: serviceFixture.folio,
      }),
    });
    expect(mocks.mockLogUserActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'service_operator_whatsapp_sent',
      }),
    );
    expect(onComplete).toHaveBeenCalledWith(serviceFixture);
  });

  it('registra la opcion de no notificar y no envia WhatsApp al elegir "No"', async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useOperatorNotificationFlow({ onComplete }));

    act(() => {
      result.current.openNotificationPrompt(serviceFixture, 'operator-1');
    });

    await act(async () => {
      await result.current.declineNotification();
    });

    expect(mocks.mockInvoke).not.toHaveBeenCalled();
    expect(mocks.mockLogUserActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'service_operator_whatsapp_declined',
      }),
    );
    expect(onComplete).toHaveBeenCalledWith(serviceFixture);
  });

  it('abre el flujo de reintento si falla el envio y permite reintentar', async () => {
    const onComplete = vi.fn();
    mocks.mockInvoke
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Fallo de red' },
      })
      .mockResolvedValueOnce({
        data: { success: true, messageId: 'wamid.2' },
        error: null,
      });

    const { result } = renderHook(() => useOperatorNotificationFlow({ onComplete }));

    act(() => {
      result.current.openNotificationPrompt(serviceFixture, 'operator-1');
    });

    await act(async () => {
      await result.current.confirmNotification();
    });

    expect(result.current.retryOpen).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.retryNotification();
    });

    expect(mocks.mockInvoke).toHaveBeenCalledTimes(2);
    expect(mocks.mockInvoke).toHaveBeenLastCalledWith('send-whatsapp-operator', {
      body: expect.objectContaining({
        operatorId: 'operator-1',
        force: true,
      }),
    });
    expect(onComplete).toHaveBeenCalledWith(serviceFixture);
  });
});

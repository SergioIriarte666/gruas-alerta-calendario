import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLinkInvoiceToCost } from '../useCosts';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: ({ mutationFn }: any) => ({
    mutateAsync: mutationFn,
    mutate: mutationFn,
    isPending: false,
    error: null,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/hooks/useUniversalSync', () => ({
  useUniversalSync: () => ({ invalidateAll: vi.fn() }),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

const BASE_INVOICE_DATA = {
  folio: '00123',
  issueDate: '2025-03-10',
  dueDate: '2025-04-10',
  amount: 150000,
  netAmount: 126050,
  taxAmount: 23950,
  description: 'Mantención motor grúa',
  currency: 'CLP',
  status: 'pending' as const,
};

function buildMocks({
  invoiceInsertResult = { data: { id: 'inv-1' }, error: null },
  costsUpdateResult = { error: null },
  costsSelectResult = { data: { supplier_payment_id: null }, error: null },
  supplierPaymentsUpdateResult = { error: null },
}: {
  invoiceInsertResult?: any;
  costsUpdateResult?: any;
  costsSelectResult?: any;
  supplierPaymentsUpdateResult?: any;
} = {}) {
  const costsUpdateEq = vi.fn().mockResolvedValue(costsUpdateResult);
  const costsUpdate = vi.fn().mockReturnValue({ eq: costsUpdateEq });

  const costsSelectSingle = vi.fn().mockResolvedValue(costsSelectResult);
  const costsSelectEq = vi.fn().mockReturnValue({ single: costsSelectSingle });
  const costsSelect = vi.fn().mockReturnValue({ eq: costsSelectEq });

  const supplierPaymentsUpdateEq = vi.fn().mockResolvedValue(supplierPaymentsUpdateResult);
  const supplierPaymentsUpdate = vi.fn().mockReturnValue({ eq: supplierPaymentsUpdateEq });
  const supplierPaymentsMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const supplierPaymentsSelectEq = vi.fn().mockReturnValue({ maybeSingle: supplierPaymentsMaybeSingle });
  const supplierPaymentsSelect = vi.fn().mockReturnValue({ eq: supplierPaymentsSelectEq });

  const invoiceSingle = vi.fn().mockResolvedValue(invoiceInsertResult);
  const invoiceSelect = vi.fn().mockReturnValue({ single: invoiceSingle });
  const invoiceInsert = vi.fn().mockReturnValue({ select: invoiceSelect });

  (supabase.from as any).mockImplementation((table: string) => {
    if (table === 'supplier_invoices') return { insert: invoiceInsert };
    if (table === 'costs') return { update: costsUpdate, select: costsSelect };
    if (table === 'supplier_payments') return { update: supplierPaymentsUpdate, select: supplierPaymentsSelect };
    return {};
  });

  return { costsUpdate, supplierPaymentsUpdate, invoiceInsert };
}

describe('useLinkInvoiceToCost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test 1 — actualiza amount con el monto de la factura', async () => {
    const { costsUpdate } = buildMocks();
    const { result } = renderHook(() => useLinkInvoiceToCost());

    await act(async () => {
      await result.current.mutateAsync({
        costId: 'costo-1',
        supplierId: 'supplier-1',
        invoiceData: { ...BASE_INVOICE_DATA, amount: 150000 },
      });
    });

    expect(costsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 150000 })
    );
  });

  it('Test 2 — actualiza description con la glosa del XML', async () => {
    const { costsUpdate } = buildMocks();
    const { result } = renderHook(() => useLinkInvoiceToCost());

    await act(async () => {
      await result.current.mutateAsync({
        costId: 'costo-1',
        supplierId: 'supplier-1',
        invoiceData: { ...BASE_INVOICE_DATA, description: 'Mantención motor grúa' },
      });
    });

    expect(costsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Mantención motor grúa' })
    );
  });

  it('Test 3 — actualiza service_folio con el folio de la factura', async () => {
    const { costsUpdate } = buildMocks();
    const { result } = renderHook(() => useLinkInvoiceToCost());

    await act(async () => {
      await result.current.mutateAsync({
        costId: 'costo-1',
        supplierId: 'supplier-1',
        invoiceData: { ...BASE_INVOICE_DATA, folio: '00123' },
      });
    });

    expect(costsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ service_folio: '00123' })
    );
  });

  it('Test 4 — cuando la factura está pagada, actualiza payment_date', async () => {
    const { costsUpdate } = buildMocks();
    const { result } = renderHook(() => useLinkInvoiceToCost());

    await act(async () => {
      await result.current.mutateAsync({
        costId: 'costo-1',
        supplierId: 'supplier-1',
        invoiceData: { ...BASE_INVOICE_DATA, status: 'paid', paidDate: '2025-03-15' },
      });
    });

    expect(costsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_date: '2025-03-15' })
    );
  });

  it('Test 5 — cuando la factura NO está pagada, payment_date no se escribe', async () => {
    const { costsUpdate } = buildMocks();
    const { result } = renderHook(() => useLinkInvoiceToCost());

    await act(async () => {
      await result.current.mutateAsync({
        costId: 'costo-1',
        supplierId: 'supplier-1',
        invoiceData: { ...BASE_INVOICE_DATA, status: 'pending' },
      });
    });

    const calledWith = costsUpdate.mock.calls[0][0];
    expect(calledWith).not.toHaveProperty('payment_date');
  });

  it('Test 6 — propaga el error si falla la creación de supplier_invoice', async () => {
    const { costsUpdate } = buildMocks({
      invoiceInsertResult: { data: null, error: { message: 'violación de constraint' } },
    });
    const { result } = renderHook(() => useLinkInvoiceToCost());

    await expect(
      result.current.mutateAsync({
        costId: 'costo-1',
        supplierId: 'supplier-1',
        invoiceData: BASE_INVOICE_DATA,
      })
    ).rejects.toThrow('Error creando factura: violación de constraint');

    expect(costsUpdate).not.toHaveBeenCalled();
  });

  it('Test 7 — cuando existe supplier_payment_id, actualiza también supplier_payments', async () => {
    const { supplierPaymentsUpdate } = buildMocks({
      costsSelectResult: { data: { supplier_payment_id: 'pago-99' }, error: null },
    });
    const { result } = renderHook(() => useLinkInvoiceToCost());

    await act(async () => {
      await result.current.mutateAsync({
        costId: 'costo-1',
        supplierId: 'supplier-1',
        invoiceData: BASE_INVOICE_DATA,
      });
    });

    expect(supplierPaymentsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        reference_number: '00123',
        supplier_invoice_id: 'inv-1',
      })
    );
  });
});

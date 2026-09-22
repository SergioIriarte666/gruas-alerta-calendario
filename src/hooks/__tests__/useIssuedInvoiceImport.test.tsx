import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IssuedInvoiceDocument } from '@/utils/issuedInvoiceImport';
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  candidates: vi.fn(),
  existing: vi.fn(),
  register: vi.fn(),
  invalidate: vi.fn(),
  save: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));
vi.mock('@/utils/issuedInvoiceApi', () => ({
  listIssuedInvoiceDrafts: mocks.list,
  getIssuedInvoiceCandidates: mocks.candidates,
  existingFiscalNumbers: mocks.existing,
  registerIssuedInvoice: mocks.register,
  saveIssuedInvoiceDraft: mocks.save,
  findIssuedInvoiceFile: vi.fn(),
  INVOICE_PDF_BUCKET: 'issued-invoice-pdfs',
  fiscalKey: (v: string) => (/^\d+$/.test(v) ? BigInt(v).toString() : v),
}));
vi.mock('@/utils/readIssuedInvoicePdf', () => ({
  readIssuedInvoicePdf: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { useIssuedInvoiceImport } from '../useIssuedInvoiceImport';
const makeDoc = (id: string): IssuedInvoiceDocument => ({
  id,
  file_name: id + '.pdf',
  file_hash: id,
  storage_path: id,
  result: null,
  created_at: '2026-09-22',
  draft: {
    fields: {
      documentType: '33',
      issuerRut: '76123456-0',
      clientRut: '77222333-4',
      fiscalNumber: id,
      purchaseOrder: 'OC-001',
      issueDate: '2026-09-01',
      dueDate: '2026-09-30',
      net: 100,
      vat: 19,
      total: 119,
      description: 'Servicio de traslado',
    },
    selectedKeys: [id + ':covered'],
    reviewed: true,
    manualReason: '',
  },
});
const candidate = (id: string) => ({
  key: id + ':covered',
  serviceId: id,
  folio: id,
  date: '2026-09-01',
  purchaseOrder: '001',
  valueType: 'covered',
  amount: 100,
  blocked: null,
  closureId: null,
  closureFolio: null,
});
describe('issued invoice batch orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([makeDoc('1'), makeDoc('2')]);
    mocks.candidates.mockResolvedValue([candidate('1'), candidate('2')]);
    mocks.existing.mockResolvedValue(new Set());
  });
  it('automatically proposes the OC services and selects the matching invoice before final confirmation', async () => {
    const doc = makeDoc('1');
    doc.draft.reviewed = false;
    doc.draft.selectedKeys = [];
    doc.draft.fields.description = '';
    mocks.list.mockResolvedValue([doc]);
    mocks.candidates.mockResolvedValue([candidate('1')]);
    mocks.save.mockImplementation(async (document, draft) => ({
      ...document,
      draft,
    }));
    const { result } = renderHook(() => useIssuedInvoiceImport());
    await act(() => result.current.load());
    expect(result.current.ready.map((d) => d.id)).toEqual(['1']);
    expect(result.current.selected.has('1')).toBe(true);
    expect(result.current.documents[0].draft.selectedKeys).toEqual([
      '1:covered',
    ]);
    expect(result.current.documents[0].draft.reviewed).toBe(false);
    expect(mocks.register).not.toHaveBeenCalled();
    await act(() => result.current.run());
    expect(mocks.register).toHaveBeenCalledTimes(1);
  });
  it('registers only selected ready documents and preserves partial results for retry', async () => {
    mocks.register
      .mockResolvedValueOnce({
        invoiceId: 'i1',
        invoiceFolio: 'FACT-1',
        closureFolios: ['CIE-1'],
      })
      .mockRejectedValueOnce(new Error('Conexión interrumpida'));
    const { result } = renderHook(() => useIssuedInvoiceImport());
    await act(() => result.current.load());
    act(() => result.current.setSelected(new Set(['1', '2'])));
    await act(() => result.current.run());
    expect(mocks.register).toHaveBeenCalledTimes(2);
    expect(mocks.register).toHaveBeenNthCalledWith(1, '1', makeDoc('1').draft);
    expect(result.current.documents[0].result?.invoiceId).toBe('i1');
    expect(result.current.documents[1].result).toBeNull();
    expect(result.current.selected.has('1')).toBe(false);
    expect(result.current.error).toContain('Conexión interrumpida');
    mocks.register.mockResolvedValue({
      invoiceId: 'i2',
      invoiceFolio: 'FACT-2',
      closureFolios: ['CIE-2'],
    });
    await act(() => result.current.retry());
    await act(() => result.current.run());
    expect(mocks.register).toHaveBeenCalledTimes(3);
    expect(mocks.register).toHaveBeenLastCalledWith('2', makeDoc('2').draft);
  });
  it('blocks duplicate fiscal numbers both in TMS and within the batch', async () => {
    mocks.existing.mockResolvedValue(new Set(['1']));
    const { result } = renderHook(() => useIssuedInvoiceImport());
    await act(() => result.current.load());
    expect(result.current.ready.map((d) => d.id)).toEqual(['2']);
    mocks.list.mockResolvedValue([
      makeDoc('1'),
      {
        ...makeDoc('2'),
        draft: {
          ...makeDoc('2').draft,
          fields: { ...makeDoc('2').draft.fields, fiscalNumber: '01' },
        },
      },
    ]);
    mocks.existing.mockResolvedValue(new Set());
    await act(() => result.current.load());
    expect(result.current.ready).toHaveLength(0);
    act(() => result.current.setSelected(new Set(['1', '2'])));
    await act(() => result.current.run());
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it('blocks assigning the same service and amount type to two invoices', async () => {
    const one = makeDoc('1');
    const two = makeDoc('2');
    two.draft.selectedKeys = [...one.draft.selectedKeys];
    mocks.list.mockResolvedValue([one, two]);
    const { result } = renderHook(() => useIssuedInvoiceImport());
    await act(() => result.current.load());
    expect(result.current.ready).toHaveLength(0);
    expect(result.current.issues['1'][0]).toContain('varias facturas');
  });
  it('blocks a service that becomes disputed after a saved review', async () => {
    mocks.candidates.mockResolvedValue([
      { ...candidate('1'), blocked: 'Disputa abierta' },
      candidate('2'),
    ]);
    const { result } = renderHook(() => useIssuedInvoiceImport());
    await act(() => result.current.load());
    expect(result.current.ready.map((d) => d.id)).toEqual(['2']);
  });
});

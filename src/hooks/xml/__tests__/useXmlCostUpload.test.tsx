import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useXmlCostUpload } from '../useXmlCostUpload';
import { getDocumentStateKey } from '@/utils/xml/xmlGlosaHelpers';
import type { XMLDocumentData } from '@/types/suppliers';

const mocks = vi.hoisted(() => ({ addCost: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [{ id: 'parts', name: 'Partes', category_id: 'inventory' }], isPending: false, isError: false }) }));
vi.mock('@/hooks/useXMLParsing', () => ({ useXMLParsing: () => ({ parseResult, reset: vi.fn() }) }));
vi.mock('@/hooks/useCosts', () => ({ useAddCost: () => ({ mutate: mocks.addCost }), useLinkInvoiceToCost: () => ({ mutateAsync: vi.fn() }) }));
vi.mock('@/hooks/useCostCategories', () => ({ useCostCategories: () => ({ data: [{ id: 'inventory', name: 'Inventario' }, { id: 'other', name: 'Otros' }] }) }));
vi.mock('@/hooks/useCranes', () => ({ useCranes: () => ({ cranes: [] }) }));
vi.mock('@/hooks/useDuplicateCheck', () => ({ useCostDuplicateCheck: () => ({ checkDuplicates: vi.fn() }) }));
vi.mock('@/hooks/usePaymentTerms', () => ({ usePaymentTerms: () => ({ paymentTerms: [], loading: false }) }));
vi.mock('@/components/ui/batch-progress-modal', () => ({ useBatchProgress: () => ({ start: vi.fn(), close: vi.fn() }) }));

const document = { folio: '7069653', supplier_rut: '78924030-2', issue_date: '2026-10-17', due_date: '2026-10-31', total_amount: 223040,
  items: [{ description: 'Patín', quantity: 4, unit_price: 43269, total: 205960.44 }],
} as XMLDocumentData;
const parseResult = { documents: [document], suppliers: [{ name: 'Implementos', rut: document.supplier_rut }] };
const key = getDocumentStateKey(document);

function selectedUpload() {
  const hook = renderHook(() => useXmlCostUpload({ onClose: vi.fn() }));
  act(() => {
    hook.result.current.selectAllDocuments();
    hook.result.current.toggleSupplierSelection(document.supplier_rut);
    hook.result.current.handleCategoryChange(document.supplier_rut, 'inventory');
  });
  return hook;
}

afterEach(() => vi.clearAllMocks());

describe('Estado real del importador XML de Costos', () => {
  it('excluye proveedores desmarcados del total y del resumen de carga', () => {
    const { result } = selectedUpload();
    expect(result.current.uploadableCount).toBe(1);
    expect(result.current.selectedTotal).toBe(223040);
    act(() => result.current.toggleSupplierSelection(document.supplier_rut));
    expect(result.current.uploadableCount).toBe(0);
    expect(result.current.selectedTotal).toBe(0);
    expect(result.current.configurationError).toBeTruthy();
  });
  it('valida el pago solo cuando la factura está marcada pagada, antes de escribir', async () => {
    const { result } = selectedUpload();
    expect(result.current.reviewError).toBeNull();
    act(() => result.current.setPaidOverrides({ [key]: true }));
    expect(result.current.reviewError).toContain('fecha de pago válida');
    await act(() => result.current.handleUploadCosts());
    expect(mocks.addCost).not.toHaveBeenCalled();
    act(() => result.current.setPaidDateOverrides({ [key]: '2026-10-18' }));
    expect(result.current.reviewError).toBeNull();
    act(() => result.current.setPaidOverrides({ [key]: false }));
    expect(result.current.reviewError).toBeNull();
  });
  it('limpia las asignaciones al cambiar de categoría y rechaza subcategorías ajenas', () => {
    const { result } = selectedUpload();
    act(() => result.current.setLineSubcategories({ [`${key}:0`]: 'parts' }));
    expect(result.current.getClassifiedItems(document)[0].cost_subcategory).toBe('Partes');
    act(() => result.current.handleCategoryChange(document.supplier_rut, 'other'));
    expect(result.current.lineSubcategories).toEqual({});
    act(() => result.current.setLineSubcategories({ [`${key}:0`]: 'parts' }));
    expect(result.current.reviewError).toContain('deben pertenecer');
  });
  it('usa el vencimiento editado en la revisión y no admite fechas imposibles', () => {
    const { result } = selectedUpload();
    expect(result.current.getDocumentDueDate(document)).toBe('2026-10-31');
    act(() => result.current.setDueDateOverrides({ [key]: '2026-11-15' }));
    expect(result.current.getDocumentDueDate(document)).toBe('2026-11-15');
    act(() => result.current.setDueDateOverrides({ [key]: '2026-02-30' }));
    expect(result.current.reviewError).toContain('vencimiento');
  });
});

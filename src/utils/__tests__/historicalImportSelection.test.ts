import { describe, expect, it } from 'vitest';
import {
  applyStatusToSelectedKeys,
  getImportSelectionState,
  toggleAllImportableKeys,
} from '@/utils/historicalImportSelection';
import {
  getEffectiveInvoiceStatus,
  getInvoiceImportKey,
  getInvoicePaymentFields,
  type ProcessedInvoice,
} from '@/utils/invoiceHistoryParser';
import {
  getEffectivePurchaseStatus,
  getPurchaseImportKey,
  type ProcessedPurchase,
} from '@/utils/purchaseHistoryParser';

const sale: ProcessedInvoice = {
  folio: '123', numeroFiscal: '123', rut: '76.123.456-7', razonSocial: 'Cliente', issueDate: '2026-06-01',
  dueDate: '2026-06-30', subtotal: 100, iva: 19, total: 119, status: 'sent', isPaid: false, notes: '',
  documentType: 'factura', clientMatch: 'exact',
};

const purchase: ProcessedPurchase = {
  invoice_number: '456', rut: '77.123.456-8', razonSocial: 'Proveedor', issueDate: '2026-06-02',
  dueDate: '2026-07-02', net_amount: 100, tax_amount: 19, amount: 119, status: 'pending', description: '',
  documentType: 'factura', supplierMatch: 'exact',
};

describe('historical import selection', () => {
  const keys = ['a', 'b', 'c'];

  it('supports individual selection and indeterminate state', () => {
    const selection = new Set(['b']);
    expect(getImportSelectionState(keys, selection)).toEqual({ selectedCount: 1, allSelected: false, indeterminate: true });
  });

  it('selects and deselects every importable document without touching unrelated keys', () => {
    const selected = toggleAllImportableKeys(new Set(['other']), keys, true);
    expect([...selected]).toEqual(['other', 'a', 'b', 'c']);
    expect(getImportSelectionState(keys, selected).allSelected).toBe(true);
    expect([...toggleAllImportableKeys(selected, keys, false)]).toEqual(['other']);
  });

  it('applies a status only to selected importable documents and allows changing it again', () => {
    const first = applyStatusToSelectedKeys(new Map<string, 'paid' | 'overdue'>(), keys, new Set(['a', 'c']), 'paid');
    expect([...first]).toEqual([['a', 'paid'], ['c', 'paid']]);
    const second = applyStatusToSelectedKeys(first, keys, new Set(['c']), 'overdue');
    expect(second.get('a')).toBe('paid');
    expect(second.get('c')).toBe('overdue');
    expect(second.has('b')).toBe(false);
  });

  it('has an empty state suitable for resetting the importer', () => {
    expect(getImportSelectionState(keys, new Set())).toEqual({ selectedCount: 0, allSelected: false, indeterminate: false });
    expect(new Map().size).toBe(0);
  });
});

describe('effective historical statuses and persistence fields', () => {
  it('keeps original sales and purchase statuses when there is no manual override', () => {
    expect(getEffectiveInvoiceStatus(sale, new Map())).toBe('sent');
    expect(getEffectivePurchaseStatus(purchase, new Map())).toBe('pending');
  });

  it('uses stable keys and persists manual sales and purchase statuses', () => {
    const saleKey = getInvoiceImportKey(sale);
    const purchaseKey = getPurchaseImportKey(purchase);
    expect(getInvoiceImportKey({ ...sale })).toBe(saleKey);
    expect(getPurchaseImportKey({ ...purchase })).toBe(purchaseKey);
    expect(getEffectiveInvoiceStatus(sale, new Map([[saleKey, 'overdue']]))).toBe('overdue');
    expect(getEffectivePurchaseStatus(purchase, new Map([[purchaseKey, 'paid']]))).toBe('paid');
  });

  it('synchronizes sales paid amount and payment date with the effective status', () => {
    expect(getInvoicePaymentFields(sale, 'paid')).toEqual({ paid_amount: 119, payment_date: '2026-06-01' });
    expect(getInvoicePaymentFields({ ...sale, status: 'paid', isPaid: true }, 'sent')).toEqual({ paid_amount: 0, payment_date: null });
  });

  it('never persists a negative paid amount for paid credit notes', () => {
    const creditNote: ProcessedInvoice = {
      ...sale,
      folio: 'NC-123',
      numeroFiscal: '123',
      total: -119,
      subtotal: -100,
      iva: -19,
      documentType: 'nota_credito',
    };

    expect(getInvoicePaymentFields(creditNote, 'paid')).toEqual({
      paid_amount: 0,
      payment_date: '2026-06-01',
    });
  });
});

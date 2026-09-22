import { describe, expect, it } from 'vitest';
import {
  invoiceFieldErrors,
  normalizeInvoiceOC,
  parseIssuedInvoiceText,
  prepareIssuedInvoiceDraft,
  reconciliationErrors,
  suggestedInvoiceKeys,
  type InvoiceCandidate,
  type IssuedInvoiceFields,
} from '../issuedInvoiceImport';

const fields: IssuedInvoiceFields = {
  documentType: '33',
  issuerRut: '76.123.456-0',
  clientRut: '77.222.333-4',
  fiscalNumber: '4369',
  purchaseOrder: 'OC-00821',
  issueDate: '2026-09-01',
  dueDate: '2026-09-30',
  net: 100000,
  vat: 19000,
  total: 119000,
  description: 'Servicios de traslado según OC',
};
const candidate = (
  id: string,
  overrides: Partial<InvoiceCandidate> = {},
): InvoiceCandidate => ({
  key: id + ':covered',
  serviceId: id,
  folio: 'SER-' + id,
  date: '2026-09-01',
  purchaseOrder: '00821',
  valueType: 'covered',
  amount: 100000,
  blocked: null,
  closureId: null,
  closureFolio: null,
  ...overrides,
});
describe('issued invoice import', () => {
  it('normalizes OC prefixes but preserves significant zeros and internal separators', () => {
    expect(normalizeInvoiceOC(' O.C. : 00821 ')).toBe('00821');
    expect(normalizeInvoiceOC('ORDEN DE COMPRA 00821')).toBe('00821');
    expect(normalizeInvoiceOC('OCEANO')).toBe('OCEANO');
    expect(normalizeInvoiceOC('821')).not.toBe(normalizeInvoiceOC('00821'));
    expect(normalizeInvoiceOC('AB-12')).not.toBe(normalizeInvoiceOC('AB12'));
  });
  it('only suggests available matching OC candidates whose combined net matches', () => {
    expect(
      suggestedInvoiceKeys(fields, [
        candidate('a'),
        candidate('b', { purchaseOrder: 'OTHER' }),
      ]),
    ).toEqual(['a:covered']);
    expect(
      suggestedInvoiceKeys(fields, [candidate('a'), candidate('b')]),
    ).toEqual([]);
    expect(
      suggestedInvoiceKeys(fields, [
        candidate('a', { blocked: 'Disputa abierta' }),
      ]),
    ).toEqual([]);
    expect(
      suggestedInvoiceKeys({ ...fields, purchaseOrder: '' }, [candidate('a')]),
    ).toEqual([]);
  });
  it('requires reviewed amounts, availability and a manual explanation for a different OC', () => {
    const draft = {
      fields,
      selectedKeys: ['a:covered'],
      reviewed: true,
      manualReason: '',
    };
    expect(reconciliationErrors(draft, [candidate('a')])).toEqual([]);
    expect(
      reconciliationErrors({ ...draft, reviewed: false }, [candidate('a')]),
    ).toContain('Confirma la revisión del PDF y de sus servicios.');
    expect(
      reconciliationErrors(draft, [candidate('a', { purchaseOrder: '821' })]),
    ).toHaveLength(1);
    expect(
      reconciliationErrors(
        {
          ...draft,
          manualReason: 'Referencia validada en el documento original',
        },
        [candidate('a', { purchaseOrder: '821' })],
      ),
    ).toEqual([]);
    expect(
      reconciliationErrors(draft, [candidate('a', { amount: 119000 })]),
    ).toContain('El neto/base de los servicios no coincide con el PDF.');
    expect(
      reconciliationErrors(
        { ...draft, selectedKeys: ['a:covered', 'a:covered'] },
        [candidate('a')],
      ),
    ).toContain('Selecciona servicios disponibles.');
  });
  it('extracts labeled PDF fields, not a filename; leaves ambiguous OC and RUT blank', () => {
    const text = `FACTURA ELECTRONICA\nN° 4369\nRUT EMISOR: 76.123.456-0\nRUT RECEPTOR: 77.222.333-4\nFECHA EMISION: 01/09/2026\nVENCIMIENTO: 30/09/2026\nORDEN DE COMPRA: 00821\nMONTO NETO $ 100.000\nIVA 19% $ 19.000\nMONTO TOTAL $ 119.000`;
    expect(parseIssuedInvoiceText(text)).toMatchObject({
      ...fields,
      description: '',
      purchaseOrder: '00821',
    });
    expect(parseIssuedInvoiceText(text + '\nOC: 00999').purchaseOrder).toBe('');
    expect(parseIssuedInvoiceText('4369.pdf').fiscalNumber).toBe('');
    expect(
      parseIssuedInvoiceText('RUT: 76.123.456-0\nRUT: 77.222.333-4').issuerRut,
    ).toBe('');
    expect(
      parseIssuedInvoiceText('NOTA DE CREDITO\nREFERENCIA FACTURA ELECTRONICA')
        .documentType,
    ).toBe('');
  });
  it('reads the standard SII recipient block and written dates', () => {
    const parsed = parseIssuedInvoiceText(
      `R.U.T.: 76.123.456-0\nFACTURA ELECTRONICA\nN° 4369\nSEÑOR(ES): CLIENTE EJEMPLO\nR.U.T.: 77.222.333-4\nGIRO: TRANSPORTES\nFECHA EMISION: 01 de Septiembre del 2026\nOrden de Compra: 00821`,
    );
    expect(parsed.clientRut).toBe('77.222.333-4');
    expect(parsed.issuerRut).toBe('761234560');
    expect(parsed.issueDate).toBe('2026-09-01');
    expect(parsed.purchaseOrder).toBe('00821');
  });
  it('prepares the closure from the invoice OC without a mandatory manual step', () => {
    const input = {
      fields: { ...fields, description: '', dueDate: '' },
      selectedKeys: [],
      reviewed: false,
      manualReason: '',
    };
    const result = prepareIssuedInvoiceDraft(input, [candidate('a')]);
    expect(result.selectedKeys).toEqual(['a:covered']);
    expect(result.fields.description).toBe('Factura SII 4369 · OC 00821');
    expect(result.fields.dueDate).toBe('2026-10-01');
    expect(result.dueDateDefaulted).toBe(true);
    expect(result.reviewed).toBe(false);
    expect(
      prepareIssuedInvoiceDraft({ ...input, fields }, [candidate('a')]).fields
        .dueDate,
    ).toBe('2026-09-30');
  });
  it('blocks missing dates, invalid totals and exempt VAT', () => {
    expect(invoiceFieldErrors(fields)).toEqual([]);
    expect(invoiceFieldErrors({ ...fields, dueDate: '' })).not.toEqual([]);
    expect(invoiceFieldErrors({ ...fields, net: NaN })).not.toEqual([]);
    expect(invoiceFieldErrors({ ...fields, documentType: '34' })).toContain(
      'Una factura exenta debe tener IVA cero.',
    );
    expect(invoiceFieldErrors({ ...fields, total: 120000 })).not.toEqual([]);
  });
});

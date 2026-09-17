import { describe, expect, it } from 'vitest';
import {
  computeSiiCuadratura,
  normalizeFiscalFolio,
  type CuadraturaInvoiceInput,
  type CuadraturaRcvInput,
} from '@/utils/siiCuadratura';

const rcv = (overrides: Partial<CuadraturaRcvInput>): CuadraturaRcvInput => ({
  id: `rcv-${overrides.folio ?? 0}-${overrides.doc_type ?? 33}`,
  doc_type: 33,
  folio: 0,
  counterpart_rut: '11.111.111-1',
  counterpart_name: 'Cliente SII',
  doc_date: '2026-08-10',
  total_amount: 0,
  ref_doc_type: null,
  ref_folio: null,
  ...overrides,
});

const invoice = (overrides: Partial<CuadraturaInvoiceInput>): CuadraturaInvoiceInput => ({
  id: `inv-${overrides.numero_fiscal ?? overrides.folio ?? '0'}`,
  folio: 'F-001',
  numero_fiscal: null,
  issue_date: '2026-08-10',
  total: 0,
  status: 'sent',
  clientName: 'Cliente TMS',
  ...overrides,
});

const run = (params: {
  rcvRows?: CuadraturaRcvInput[];
  periodInvoices?: CuadraturaInvoiceInput[];
  extraInvoices?: CuadraturaInvoiceInput[];
  cancelledInvoiceIds?: Set<string>;
}) =>
  computeSiiCuadratura({
    period: '2026-08',
    rcvRows: params.rcvRows ?? [],
    periodInvoices: params.periodInvoices ?? [],
    extraInvoices: params.extraInvoices ?? [],
    cancelledInvoiceIds: params.cancelledInvoiceIds ?? new Set(),
  });

describe('normalizeFiscalFolio', () => {
  it('deja solo dígitos y quita ceros a la izquierda', () => {
    expect(normalizeFiscalFolio('004013')).toBe('4013');
    expect(normalizeFiscalFolio(' 4013 ')).toBe('4013');
    expect(normalizeFiscalFolio('N° 4013')).toBe('4013');
    expect(normalizeFiscalFolio('')).toBeNull();
    expect(normalizeFiscalFolio(null)).toBeNull();
    expect(normalizeFiscalFolio('S/F')).toBeNull();
  });
});

describe('computeSiiCuadratura', () => {
  it('caso 4013: folio existe en ambos lados con montos distintos → MONTO NO CUADRA con la diferencia', () => {
    const result = run({
      rcvRows: [rcv({ folio: 4013, total_amount: 47600 })],
      periodInvoices: [invoice({ numero_fiscal: '4013', total: 95200 })],
    });

    expect(result.summary.montoNoCuadra.count).toBe(1);
    const row = result.rows.find((r) => r.folio === 4013);
    expect(row?.categoria).toBe('monto_no_cuadra');
    expect(row?.siiTotal).toBe(47600);
    expect(row?.invoice?.total).toBe(95200);
    expect(row?.diff).toBe(47600 - 95200);
    expect(result.summary.tmsSinSii.count).toBe(0);
    expect(result.summary.siiSinTms.count).toBe(0);
  });

  it('folio con montos iguales → OK', () => {
    const result = run({
      rcvRows: [rcv({ folio: 4001, total_amount: 119000 })],
      periodInvoices: [invoice({ numero_fiscal: '4001', total: 119000 })],
    });
    expect(result.summary.ok.count).toBe(1);
    expect(result.rows[0].categoria).toBe('ok');
  });

  it('matchea aunque el numero_fiscal traiga ceros a la izquierda o formato', () => {
    const result = run({
      rcvRows: [rcv({ folio: 4001, total_amount: 119000 })],
      periodInvoices: [invoice({ numero_fiscal: '004001', total: 119000 })],
    });
    expect(result.summary.ok.count).toBe(1);
  });

  it('folio del RCV sin factura en el TMS → SII SIN TMS', () => {
    const result = run({
      rcvRows: [rcv({ folio: 4100, total_amount: 50000 })],
    });
    expect(result.summary.siiSinTms.count).toBe(1);
    expect(result.rows[0].categoria).toBe('sii_sin_tms');
    expect(result.rows[0].invoice).toBeNull();
  });

  it('factura del período sin registro en el RCV → TMS SIN SII, excluyendo anuladas', () => {
    const result = run({
      periodInvoices: [
        invoice({ numero_fiscal: '4200', total: 80000 }),
        invoice({ numero_fiscal: '4201', total: 30000, status: 'cancelled' }),
      ],
    });
    expect(result.summary.tmsSinSii.count).toBe(1);
    expect(result.tmsSinSii[0].numeroFiscal).toBe('4200');
  });

  it('también excluye de TMS SIN SII a las anuladas vía invoice_cancellations con status desincronizado', () => {
    const inv = invoice({ numero_fiscal: '4300', total: 60000, status: 'sent' });
    const result = run({
      periodInvoices: [inv],
      cancelledInvoiceIds: new Set([inv.id]),
    });
    expect(result.summary.tmsSinSii.count).toBe(0);
  });

  it('factura vigente sin numero_fiscal no entra a TMS SIN SII: cuenta como informativa', () => {
    const result = run({
      periodInvoices: [invoice({ numero_fiscal: null, total: 40000 })],
    });
    expect(result.summary.tmsSinSii.count).toBe(0);
    expect(result.sinNumeroFiscal).toBe(1);
  });

  it('nota de crédito (61) no es descuadre y se asocia a la factura del folio referenciado', () => {
    const facturada = invoice({ numero_fiscal: '4013', total: 47600, folio: 'F-4013' });
    const result = run({
      rcvRows: [
        rcv({ folio: 4013, total_amount: 47600 }),
        rcv({ doc_type: 61, folio: 88, total_amount: 47600, ref_doc_type: 33, ref_folio: 4013 }),
      ],
      periodInvoices: [facturada],
    });

    expect(result.summary.ok.count).toBe(1);
    expect(result.summary.siiSinTms.count).toBe(0);
    expect(result.notasCredito).toHaveLength(1);
    expect(result.notasCredito[0].refFolio).toBe(4013);
    expect(result.notasCredito[0].refInvoice?.folio).toBe('F-4013');
    // El folio propio de la NC no cuenta para el set del RCV: una factura TMS
    // con numero_fiscal 88 seguiría siendo TMS SIN SII.
    const result2 = run({
      rcvRows: [rcv({ doc_type: 61, folio: 88, total_amount: 10000 })],
      periodInvoices: [invoice({ numero_fiscal: '88', total: 10000 })],
    });
    expect(result2.summary.tmsSinSii.count).toBe(1);
  });

  it('matchea contra factura de otro mes entregada como extraInvoice (drift de fecha)', () => {
    const result = run({
      rcvRows: [rcv({ folio: 4500, total_amount: 100000 })],
      extraInvoices: [invoice({ numero_fiscal: '4500', total: 100000, issue_date: '2026-07-28' })],
    });
    expect(result.summary.ok.count).toBe(1);
    // Y no aparece en TMS SIN SII porque no es factura del período.
    expect(result.summary.tmsSinSii.count).toBe(0);
  });

  it('con numero_fiscal duplicado prefiere la factura vigente por sobre la anulada', () => {
    const anulada = invoice({ id: 'inv-a', numero_fiscal: '4600', total: 50000, status: 'cancelled', folio: 'F-A' });
    const vigente = invoice({ id: 'inv-b', numero_fiscal: '4600', total: 50000, status: 'paid', folio: 'F-B' });
    const result = run({
      rcvRows: [rcv({ folio: 4600, total_amount: 50000 })],
      periodInvoices: [anulada, vigente],
    });
    expect(result.rows[0].categoria).toBe('ok');
    expect(result.rows[0].invoice?.folio).toBe('F-B');
  });
});

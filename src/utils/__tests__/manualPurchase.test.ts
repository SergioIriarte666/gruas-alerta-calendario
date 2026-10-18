import { describe, expect, it } from 'vitest';
import { buildManualPurchaseResult, draftFromReceiptExtraction, emptyManualPurchase, isPurchaseRutValid, manualPurchaseTotals, normalizePurchaseRut, validateManualPurchase, type ManualPurchaseDraft } from '../manualPurchase';

const draft = (): ManualPurchaseDraft => ({ supplierName: 'Ferretería y Repuestos Dicar Ltda.', supplierRut: '85.355.900-8', folio: '54491', issueDate: '2026-10-15', dueDate: '2026-10-16', net: '127606', vat: '24245', total: '151851',
  lines: [6723, 7983, 31900, 81000].map((unitPrice, index) => ({ id: `line-${index}`, code: '', description: ['Dado Torx', 'Dado impacto Torx', 'Dado largo', 'Llave rueda'][index], quantity: '1', unitPrice: String(unitPrice), taxRate: '19' })),
});

describe('Compra manual desde comprobante Dicar 54491', () => {
  it('recupera cuatro productos y conserva el total fiscal sin inflar IVA por línea', () => {
    expect(validateManualPurchase(draft())).toBeNull();
    expect(manualPurchaseTotals(draft())).toEqual({ net: 127606, vat: 24245, total: 151851 });
    const parsed = buildManualPurchaseResult(draft());
    expect(parsed.documents).toHaveLength(1);
    expect(parsed.documents[0]).toMatchObject({ folio: '54491', supplier_rut: '85355900-8', total_amount: 151851, net_amount: 127606, vat_amount: 24245 });
    expect(parsed.documents[0].items).toHaveLength(4);
    expect(parsed.documents[0].payment_method_code).toBeUndefined();
  });
  it('normaliza y valida el RUT del emisor', () => {
    expect(normalizePurchaseRut('85.355.900-8')).toBe('85355900-8');
    expect(isPurchaseRutValid('85355900-8')).toBe(true);
    expect(isPurchaseRutValid('85355900-9')).toBe(false);
    expect(isPurchaseRutValid('sin rut')).toBe(false);
  });
  it.each([
    { total: '151800' }, { net: '127000' }, { vat: '-1' }, { total: 'Infinity' }, { issueDate: '2026-02-30' }, { dueDate: '2026-10-14' }, { folio: '' }, { supplierRut: '85355900-9' },
  ])('rechaza datos y montos inválidos: %j', changes => {
    expect(validateManualPurchase({ ...draft(), ...changes })).toBeTruthy();
    expect(() => buildManualPurchaseResult({ ...draft(), ...changes })).toThrow();
  });
  it.each([{ quantity: '1.5' }, { quantity: '0' }, { quantity: '2147483648' }, { unitPrice: '' }, { unitPrice: 'NaN' }, { taxRate: '25' }, { description: '' }])('valida los productos: %j', changes => {
    const value = draft();
    value.lines[0] = { ...value.lines[0], ...changes };
    expect(validateManualPurchase(value)).toBeTruthy();
  });
  it('no inventa productos ni totales cuando la lectura no los entrega', () => {
    const value = draftFromReceiptExtraction({ vendorName: 'Dicar', vendorRut: '85355900-8', documentNumber: '54491', date: 'malformada', totals: { total: 151851 } });
    expect(value.issueDate).toBe('');
    expect(value.net).toBe('');
    expect(value.lines[0].description).toBe('');
    expect(value.lines[0].unitPrice).toBe('');
    expect(validateManualPurchase(value)).toBeTruthy();
    expect(validateManualPurchase(emptyManualPurchase())).toBeTruthy();
  });
  it('precarga precios netos sin volver a descontar IVA', () => {
    const value = draftFromReceiptExtraction({ vendorName: 'Dicar', vendorRut: '85355900-8', documentNumber: '54491', date: '2026-10-15', totals: { neto: 127606, iva: 24245, total: 151851 },
      items: draft().lines.map(line => ({ description: line.description, quantity: 1, unitPrice: Number(line.unitPrice), total: Number(line.unitPrice) })),
    });
    expect(value.lines.map(line => line.unitPrice)).toEqual(['6723', '7983', '31900', '81000']);
    expect(validateManualPurchase(value)).toBeNull();
  });
  it('convierte precios brutos solo cuando el lector declara explícitamente esa base', () => {
    const value = draftFromReceiptExtraction({ vendorName: 'Dicar', vendorRut: '85355900-8', documentNumber: '54491', date: '2026-10-15', totals: { neto: 1000, iva: 190, total: 1190 }, items: [{ description: 'Herramienta', quantity: 1, unitPrice: 1190, unitPriceBasis: 'gross', total: 1190 }] });
    expect(value.lines[0].unitPrice).toBe('1000');
    expect(validateManualPurchase(value)).toBeNull();
  });
  it.each([173076, 205960.44, 999999])('preserva código y P.Unitario, sin inferir precios desde Total=%s', total => {
    const value = draftFromReceiptExtraction({ vendorName: 'Dicar', vendorRut: '85355900-8', documentNumber: '54491', date: '2026-10-15', totals: { neto: 173076, iva: 32884, total: 205960 },
      items: [{ productCode: '00015-A', description: 'Producto', quantity: 4, unitPrice: 43269, unitPriceBasis: 'net', total }],
    });
    expect(value.lines[0]).toMatchObject({ code: '00015-A', quantity: '4', unitPrice: '43269' });
    expect(manualPurchaseTotals(value)).toEqual({ net: 173076, vat: 32884, total: 205960 });
    expect(buildManualPurchaseResult(value).documents[0].items?.[0].product_code).toBe('00015-A');
  });
  it('no descuenta IVA de un precio unitario neto porque la columna Total incluya IVA', () => {
    const value = draftFromReceiptExtraction({ totals: { neto: 1000, iva: 190, total: 1190 }, items: [{ description: 'Producto', quantity: 1, unitPrice: 1000, total: 1190 }] });
    expect(value.lines[0].unitPrice).toBe('1000');
  });
  it('deja el precio unitario pendiente si es ilegible, aunque exista un total de línea', () => {
    const value = draftFromReceiptExtraction({ totals: { neto: 5000, iva: 950, total: 5950 }, items: [{ productCode: 'DAT89040-1', description: 'Producto', quantity: 2, unitPrice: null, total: 5000 }] });
    expect(value.lines[0].unitPrice).toBe('');
    expect(value.lines[0].code).toBe('DAT89040-1');
  });
  it('identifica el IVA mal leído de la captura sin modificar los datos del comprobante', () => {
    const value = { ...draft(), vat: '24345' };
    expect(validateManualPurchase(value)).toBe('IVA no cuadra: comprobante $24.345; calculado $24.245 (diferencia $100). Revisa el IVA leído en la foto.');
    expect(value.vat).toBe('24345');
    expect(validateManualPurchase({ ...value, vat: '24245' })).toBeNull();
  });
});

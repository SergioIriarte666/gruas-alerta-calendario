import { describe, expect, it } from 'vitest';
import { classifySelectedCostItems, getConsolidatedCostSubcategory, resolveXmlCostPaymentDate } from '../xmlCostWizard';
import { getDocumentStateKey } from '../xmlGlosaHelpers';
import { buildDocumentalInvoiceItemRows } from '@/services/xmlCostInvoiceSync';
import type { XMLDocumentData } from '@/types/suppliers';

const document = { folio: '7069653', supplier_rut: '78924030-2', total_amount: 223040,
  items: ['Patín', 'Pilas', 'Probador'].map((description, index) => ({ description, quantity: index === 0 ? 4 : 1, unit_price: [43269, 1756, 12597][index], total: [205960.44, 2089.64, 14990.43][index] })),
} as XMLDocumentData;
const options = ['Partes y Piezas', 'Consumibles', 'Herramientas'].map((name, index) => ({ id: `sub-${index}`, name, category_id: 'inventory' }));
const key = getDocumentStateKey(document);
const assignments = Object.fromEntries(options.map((option, index) => [`${key}:${index}`, option.id]));

describe('Clasificación XML en Costos', () => {
  it('conserva tres subcategorías en un solo costo, sin clasificar todo como la primera', () => {
    const items = classifySelectedCostItems(document, new Set([0, 1, 2]), assignments, options, 'inventory');
    expect(items.map(item => item.cost_subcategory)).toEqual(options.map(option => option.name));
    expect(getConsolidatedCostSubcategory(items)).toBeNull();
    expect(document.total_amount).toBe(223040);
    expect(buildDocumentalInvoiceItemRows('invoice', items, null).map(row => row.cost_subcategory_id)).toEqual(options.map(option => option.id));
  });
  it('respeta los índices originales al excluir líneas', () => {
    const items = classifySelectedCostItems(document, new Set([2]), assignments, options, 'inventory');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ description: 'Probador', cost_subcategory: 'Herramientas' });
    expect(getConsolidatedCostSubcategory(items)).toBe('Herramientas');
  });
  it('no hereda categorías de otro proveedor o documento', () => {
    const otherDocument = { ...document, supplier_rut: 'otro' };
    const items = classifySelectedCostItems(otherDocument, new Set([0]), assignments, options, 'inventory');
    expect(items[0].cost_subcategory).toBe('');
  });
  it('no asigna una subcategoría ajena a la categoría actual', () => {
    const items = classifySelectedCostItems(document, new Set([0]), assignments, options, 'other');
    expect(items[0].cost_subcategory_id).toBeNull();
  });
  it('persiste sin subcategoría explícita y no permite el fallback histórico', () => {
    const items = classifySelectedCostItems(document, new Set([0, 1]), { [`${key}:0`]: 'sub-0' }, options, 'inventory');
    const rows = buildDocumentalInvoiceItemRows('invoice', items, null);
    expect(rows[1]).toMatchObject({ cost_subcategory_id: null, cost_subcategory: '' });
    expect(getConsolidatedCostSubcategory(items)).toBeNull();
  });
});

describe('Pago explícito del XML en Costos', () => {
  it('pendiente nunca usa la fecha de emisión ni una fecha de pago anterior', () => {
    expect(resolveXmlCostPaymentDate(false, '2026-10-17', '2026-10-18')).toBeNull();
  });
  it('pagado conserva la fecha real elegida', () => {
    expect(resolveXmlCostPaymentDate(true, '2026-10-16', '2026-10-18')).toBe('2026-10-16');
  });
});

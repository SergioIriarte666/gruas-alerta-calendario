import { describe, it, expect } from 'vitest';
import {
  buildDocumentalInvoiceItemRows,
  buildProductServiceDescription,
} from '../xmlCostInvoiceSync';
import type { XMLDocumentItem } from '@/types/suppliers';

const item = (overrides: Partial<XMLDocumentItem> = {}): XMLDocumentItem => ({
  description: 'Roam - Unlimited',
  quantity: 2,
  unit_price: 70470,
  subtotal: 140940,
  tax_amount: 26779,
  total: 167719,
  tax_rate: 19,
  ...overrides,
});

describe('buildDocumentalInvoiceItemRows', () => {
  it('mapea las líneas del DTE sin ítem de inventario y con line_number secuencial', () => {
    const rows = buildDocumentalInvoiceItemRows(
      'inv-1',
      [item(), item({ description: 'Residential', quantity: 1, unit_price: 42017, subtotal: 42017, tax_amount: 7983, total: 50000 })],
      'user-1'
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      supplier_invoice_id: 'inv-1',
      inventory_item_id: null,
      line_number: 1,
      description: 'Roam - Unlimited',
      quantity: 2,
      unit_price: 70470,
      subtotal: 140940,
      tax_amount: 26779,
      total_amount: 167719,
      created_by: 'user-1',
    });
    expect(rows[1].line_number).toBe(2);
  });

  it('normaliza cantidades no positivas o fraccionarias (CHECK quantity > 0, integer)', () => {
    const rows = buildDocumentalInvoiceItemRows(
      'inv-1',
      [item({ quantity: 0 }), item({ quantity: 1.4 })],
      null
    );
    expect(rows[0].quantity).toBe(1);
    expect(rows[1].quantity).toBe(1);
  });

  it('infiere el subtotal cuando la línea no lo trae', () => {
    const rows = buildDocumentalInvoiceItemRows(
      'inv-1',
      [item({ subtotal: undefined, quantity: 3, unit_price: 1000 })],
      null
    );
    expect(rows[0].subtotal).toBe(3000);
  });
});

describe('buildProductServiceDescription', () => {
  it('numera las líneas y las une con separador', () => {
    const text = buildProductServiceDescription(
      [item(), item({ description: 'Residential' })],
      'fallback'
    );
    expect(text).toBe('1. Roam - Unlimited | 2. Residential');
  });

  it('usa el fallback sin líneas y devuelve null bajo el mínimo del CHECK (10)', () => {
    expect(buildProductServiceDescription([], 'Glosa suficiente')).toBe('Glosa suficiente');
    expect(buildProductServiceDescription([], 'corta')).toBeNull();
  });

  it('trunca a 500 caracteres (tope del CHECK)', () => {
    const longItem = item({ description: 'X'.repeat(600) });
    expect(buildProductServiceDescription([longItem], 'fallback')?.length).toBe(500);
  });
});

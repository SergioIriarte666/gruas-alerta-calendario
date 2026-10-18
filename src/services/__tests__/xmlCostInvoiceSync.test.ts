import { describe, it, expect, vi } from 'vitest';
import {
  buildDocumentalInvoiceItemRows,
  buildProductServiceDescription,
  createSupplierInvoiceForImportedCost,
} from '../xmlCostInvoiceSync';
import type { XMLDocumentItem } from '@/types/suppliers';
import { supabase } from '@/integrations/supabase/client';

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

describe('Registro consolidado de pago del XML', () => {
  it.each([false, true])('actualiza el único pago del costo con estado pagado=%s y el vencimiento elegido', async isPaid => {
    const updates: { table: string; values: unknown }[] = [];
    const insertedItems: unknown[] = [];
    const from = vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'invoice-1', supplier_invoice_items: [] }, error: null }),
        insert: vi.fn(values => { insertedItems.push(values); return Promise.resolve({ error: null }); }),
        update: vi.fn(values => { updates.push({ table, values }); return query; }),
        then: (resolve: (value: unknown) => void) => resolve({ error: null }),
      };
      return query as never;
    });
    try {
      await createSupplierInvoiceForImportedCost({
        costId: 'cost-1', supplierId: 'supplier-1', folio: '7069653', issueDate: '2026-10-17', dueDate: '2026-11-15',
        amount: 223040, netAmount: 187429, taxAmount: 35611, description: 'Compra de productos', isPaid, paymentDate: '2026-10-18',
        xmlFileName: '7069653.xml', items: [{ ...item(), cost_subcategory_id: 'tools', cost_subcategory: 'Herramientas' }], userId: 'user-1',
      });
      expect(updates.filter(update => update.table === 'supplier_payments')).toEqual([{ table: 'supplier_payments', values: {
        supplier_invoice_id: 'invoice-1', reference_number: '7069653', due_date: '2026-11-15',
        status: isPaid ? 'paid' : 'pending', paid_amount: isPaid ? 223040 : 0, paid_date: isPaid ? '2026-10-18' : null,
      } }]);
      expect(insertedItems[0]).toEqual([expect.objectContaining({ cost_subcategory_id: 'tools', cost_subcategory: 'Herramientas' })]);
      expect(from.mock.calls.filter(([table]) => String(table) === 'supplier_payments')).toHaveLength(1);
    } finally {
      from.mockRestore();
    }
  });
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

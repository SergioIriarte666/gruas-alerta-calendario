import { describe, expect, it } from 'vitest';
import type { Invoice } from '@/types';
import { groupInvoicesByClient } from '@/utils/invoicesByClient';

const createInvoice = (overrides: Partial<Invoice>): Invoice => ({
  id: 'invoice-1',
  folio: 'FACT-1',
  closureId: 'closure-1',
  clientId: 'client-1',
  client: { id: 'client-1', name: 'Cliente Uno', rut: '11.111.111-1' },
  issueDate: '2026-08-01',
  dueDate: '2026-08-31',
  subtotal: 100,
  vat: 19,
  total: 119,
  status: 'sent',
  paidAmount: 0,
  remainingAmount: 119,
  productServiceDescription: 'Servicio',
  createdAt: '2026-08-01T12:00:00Z',
  updatedAt: '2026-08-01T12:00:00Z',
  ...overrides,
});

describe('vista de facturas por cliente', () => {
  it('separa clientes y prioriza el que tiene facturas vencidas', () => {
    const groups = groupInvoicesByClient([
      createInvoice({ id: 'paid', status: 'paid', total: 500, paidAmount: 500, remainingAmount: 0 }),
      createInvoice({
        id: 'overdue',
        clientId: 'client-2',
        client: { id: 'client-2', name: 'Cliente Dos', rut: '22.222.222-2' },
        status: 'overdue',
        total: 300,
        remainingAmount: 300,
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      clientId: 'client-2',
      health: 'overdue',
      outstandingAmount: 300,
    });
  });

  it('no suma borradores ni anuladas al saldo por cobrar', () => {
    const [group] = groupInvoicesByClient([
      createInvoice({ id: 'draft', status: 'draft', total: 200, remainingAmount: 200 }),
      createInvoice({ id: 'cancelled', status: 'cancelled', total: 400, remainingAmount: 400 }),
      createInvoice({ id: 'sent', status: 'sent', total: 600, paidAmount: 100, remainingAmount: 500 }),
    ]);

    expect(group.outstandingAmount).toBe(500);
    expect(group.draftAmount).toBe(200);
    expect(group.totalBilled).toBe(600);
    expect(group.totalPaid).toBe(100);
    expect(group.counts).toMatchObject({ draft: 1, cancelled: 1, sent: 1 });
  });

  it('considera completamente cobrada una factura pagada aunque el dato pagado venga atrasado', () => {
    const [group] = groupInvoicesByClient([
      createInvoice({ status: 'paid', total: 699_860, paidAmount: 0, remainingAmount: 0 }),
    ]);

    expect(group.health).toBe('current');
    expect(group.totalPaid).toBe(699_860);
    expect(group.outstandingAmount).toBe(0);
  });
});


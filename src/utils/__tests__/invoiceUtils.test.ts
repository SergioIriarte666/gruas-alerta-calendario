import { describe, expect, it, vi } from 'vitest';
import { businessClock } from '../businessClock';
import { formatInvoiceData } from '../invoiceUtils';

const baseInvoice = {
  id: 'invoice-1',
  folio: 'HIST-F-100',
  client_id: 'client-1',
  issue_date: '2020-01-01',
  due_date: '2020-01-31',
  subtotal: 100,
  vat: 19,
  total: 119,
  paid_amount: 0,
  remaining_amount: 119,
  status: 'paid',
  product_service_description: 'Servicio histórico',
  created_at: '2020-01-01T00:00:00Z',
  updated_at: '2020-01-01T00:00:00Z',
};

describe('formatInvoiceData', () => {
  it('preserva el estado manual de una factura histórica aunque no tenga pagos asociados', () => {
    const invoice = formatInvoiceData({ ...baseInvoice, source: 'historico' });

    expect(invoice.status).toBe('paid');
  });

  it('reconoce el folio HIST como respaldo cuando source aún no está disponible', () => {
    const invoice = formatInvoiceData(baseInvoice);

    expect(invoice.status).toBe('paid');
    expect(invoice.source).toBe('historico');
  });
});

// Run under America/Santiago as well as UTC: UTC alone hides this regression.
describe('invoice calendar dates', () => {
  it.each(['2026-09-11', '2026-09-01', '2026-10-01', '2026-09-06', '2026-04-05']) (
    'preserves %s through repeated database → edit → save cycles', (date) => {
      let row = { ...baseInvoice, issue_date: date, due_date: date, payment_date: date };
      for (let cycle = 0; cycle < 3; cycle++) {
        const invoice = formatInvoiceData(row);
        expect(invoice.issueDate).toBe(date);
        expect(invoice.dueDate).toBe(date);
        expect(invoice.paymentDate).toBe(date);
        row = { ...row, issue_date: invoice.issueDate, due_date: invoice.dueDate, payment_date: invoice.paymentDate! };
      }
    },
  );
});

it('does not mark an invoice due today as overdue in the TMS calendar', () => {
  const today = vi.spyOn(businessClock, 'today').mockReturnValue('2026-09-11');
  try {
    const row = { ...baseInvoice, folio: 'F-123', source: 'sistema', status: 'sent', due_date: '2026-09-11' };
    expect(formatInvoiceData(row).status).toBe('sent');
    expect(formatInvoiceData({ ...row, due_date: '2026-09-10' }).status).toBe('overdue');
  } finally { today.mockRestore(); }
});

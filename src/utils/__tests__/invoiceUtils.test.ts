import { describe, expect, it } from 'vitest';
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

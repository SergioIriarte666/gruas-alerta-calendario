import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvoiceSummaryPanel } from '../form/InvoiceSummaryPanel';
import { formatInvoiceData } from '@/utils/invoiceUtils';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { businessClock } from '@/utils/businessClock';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('invoice dates shown to the user', () => {
  it.each(['America/Santiago', 'UTC', 'Pacific/Kiritimati'])('keeps September 11 with business timezone %s', (timezone) => {
    vi.spyOn(businessClock, 'timezone').mockReturnValue(timezone);
    const invoice = formatInvoiceData({
      id: 'test', folio: 'F-123', client_id: 'client-1', source: 'historico', status: 'paid', total: 119,
      issue_date: '2026-09-11', due_date: '2026-10-01', payment_date: '2026-09-12',
    });
    expect(formatForDisplay(invoice.issueDate)).toBe('11/09/2026');
    render(<InvoiceSummaryPanel
      status="paid" numeroFiscal="123" issueDate={invoice.issueDate}
      dueDate={invoice.dueDate} paymentDate={invoice.paymentDate!}
      clientName="Cliente" closureFolio="C-1" subtotal={100} vat={19}
      total={119} isEditing={false}
    />);
    expect(screen.getByText('11/09/2026')).toBeInTheDocument();
    expect(screen.getByText('01/10/2026')).toBeInTheDocument();
    expect(screen.getByText('12/09/2026')).toBeInTheDocument();
  });
});

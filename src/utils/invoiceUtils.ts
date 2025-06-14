
import { Invoice } from '@/types';

export const formatInvoiceData = (data: any): Invoice => ({
  id: data.id,
  folio: data.folio,
  serviceIds: data.invoice_services?.map((is: any) => is.service_id) || [],
  clientId: data.client_id,
  issueDate: data.issue_date,
  dueDate: data.due_date,
  subtotal: Number(data.subtotal),
  vat: Number(data.vat),
  total: Number(data.total),
  status: data.status as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled',
  paymentDate: data.payment_date,
  createdAt: data.created_at,
  updatedAt: data.updated_at
});

export const generateInvoiceFolio = (count: number): string => {
  return `FACT-${String(count + 1).padStart(3, '0')}`;
};

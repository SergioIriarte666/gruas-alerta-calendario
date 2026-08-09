import type { Invoice, InvoiceStatus } from '@/types';

export type ClientInvoiceHealth = 'overdue' | 'pending' | 'draft' | 'current';

export type InvoiceStatusCounts = Record<InvoiceStatus, number>;

export interface InvoiceClientGroup {
  clientId: string;
  clientName: string;
  clientRut: string;
  invoices: Invoice[];
  counts: InvoiceStatusCounts;
  totalBilled: number;
  totalPaid: number;
  outstandingAmount: number;
  draftAmount: number;
  health: ClientInvoiceHealth;
}

const createEmptyCounts = (): InvoiceStatusCounts => ({
  draft: 0,
  sent: 0,
  paid: 0,
  overdue: 0,
  cancelled: 0,
});

const asAmount = (value: number | undefined): number => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

export const getInvoiceOutstandingAmount = (invoice: Invoice): number => {
  if (invoice.status !== 'sent' && invoice.status !== 'overdue') return 0;

  if (invoice.remainingAmount !== undefined) {
    return asAmount(invoice.remainingAmount);
  }

  return Math.max(0, asAmount(invoice.total) - asAmount(invoice.paidAmount));
};

const getInvoicePaidAmount = (invoice: Invoice): number => {
  if (invoice.status === 'cancelled' || invoice.status === 'draft') return 0;
  if (invoice.status === 'paid') return asAmount(invoice.total);
  return Math.min(asAmount(invoice.total), asAmount(invoice.paidAmount));
};

const sortInvoices = (invoices: Invoice[]): Invoice[] =>
  [...invoices].sort((left, right) => {
    const statusPriority: Record<InvoiceStatus, number> = {
      overdue: 0,
      sent: 1,
      draft: 2,
      paid: 3,
      cancelled: 4,
    };

    const statusDifference = statusPriority[left.status] - statusPriority[right.status];
    if (statusDifference !== 0) return statusDifference;
    return right.issueDate.localeCompare(left.issueDate);
  });

export const groupInvoicesByClient = (invoices: Invoice[]): InvoiceClientGroup[] => {
  const groups = new Map<string, InvoiceClientGroup>();

  invoices.forEach((invoice) => {
    const clientId = invoice.clientId || invoice.client?.id || 'sin-cliente';
    const existing = groups.get(clientId);
    const group = existing ?? {
      clientId,
      clientName: invoice.client?.name?.trim() || 'Cliente no identificado',
      clientRut: invoice.client?.rut?.trim() || '',
      invoices: [],
      counts: createEmptyCounts(),
      totalBilled: 0,
      totalPaid: 0,
      outstandingAmount: 0,
      draftAmount: 0,
      health: 'current' as ClientInvoiceHealth,
    };

    group.invoices.push(invoice);
    group.counts[invoice.status] += 1;

    if (invoice.status === 'draft') {
      group.draftAmount += asAmount(invoice.total);
    } else if (invoice.status !== 'cancelled') {
      group.totalBilled += asAmount(invoice.total);
    }

    group.totalPaid += getInvoicePaidAmount(invoice);
    group.outstandingAmount += getInvoiceOutstandingAmount(invoice);
    groups.set(clientId, group);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      invoices: sortInvoices(group.invoices),
      health: group.counts.overdue > 0
        ? 'overdue'
        : group.counts.sent > 0
          ? 'pending'
          : group.counts.draft > 0
            ? 'draft'
            : 'current',
    }))
    .sort((left, right) => {
      if (left.counts.overdue !== right.counts.overdue) {
        return right.counts.overdue - left.counts.overdue;
      }
      if (left.outstandingAmount !== right.outstandingAmount) {
        return right.outstandingAmount - left.outstandingAmount;
      }
      return left.clientName.localeCompare(right.clientName, 'es');
    });
};

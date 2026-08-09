import type { InvoiceStatus } from '@/types';

/**
 * Una factura solicitada como pagada se inserta primero como emitida. El estado
 * paid solo se establece después de crear y aplicar el pago correspondiente.
 */
export const normalizeInvoiceStatusBeforeAutomaticPayment = (
  requestedStatus: InvoiceStatus,
): InvoiceStatus => requestedStatus === 'paid' ? 'sent' : requestedStatus;

export const assertAutomaticPaymentSucceeded = (result: unknown): void => {
  const payload = result as { success?: boolean; error?: string } | null;

  if (payload?.success === true) {
    return;
  }

  throw new Error(payload?.error || 'La base de datos no confirmó la aplicación del pago');
};

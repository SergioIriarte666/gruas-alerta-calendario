import { Service, ServiceStatus } from '@/types';

const hasText = (value?: string | null) => Boolean(value?.trim());

export const hasServiceInvoiceData = (
  service: Pick<Service, 'invoiceFolio' | 'invoiceNumeroFiscal'>,
) => hasText(service.invoiceFolio) || hasText(service.invoiceNumeroFiscal);

export const getVipPipelineDisplayStatus = (
  service: Pick<
    Service,
    'status' | 'quoteNumber' | 'purchaseOrderNumber' | 'purchaseOrder' | 'invoiceFolio' | 'invoiceNumeroFiscal'
  >,
): ServiceStatus => {
  if (service.status === 'partially_invoiced') {
    return 'partially_invoiced';
  }

  if (service.status === 'invoiced' || hasServiceInvoiceData(service)) {
    return 'invoiced';
  }

  const hasQuote = hasText(service.quoteNumber);
  const hasPurchaseOrder = hasText(service.purchaseOrderNumber) || hasText(service.purchaseOrder);

  if (service.status === 'completed' && hasQuote) {
    return hasPurchaseOrder ? 'with_purchase_order' : 'quoted';
  }

  if ((service.status === 'quoted' || service.status === 'purchase_order_pending') && hasPurchaseOrder) {
    return 'with_purchase_order';
  }

  return service.status;
};

export const isVipPipelineInvoiced = (
  service: Pick<
    Service,
    'status' | 'quoteNumber' | 'purchaseOrderNumber' | 'purchaseOrder' | 'invoiceFolio' | 'invoiceNumeroFiscal'
  >,
) => {
  const status = getVipPipelineDisplayStatus(service);
  return status === 'invoiced' || status === 'partially_invoiced';
};

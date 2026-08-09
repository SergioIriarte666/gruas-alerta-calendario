import type { ServiceStatus } from '@/types';

export interface ClientBillingInvoiceRef {
  folio?: string | null;
  numeroFiscal?: string | null;
}

export interface ClientClosureBillingState {
  coveredInvoiced: boolean;
  excessInvoiced: boolean;
  coveredInvoice?: ClientBillingInvoiceRef;
  excessInvoice?: ClientBillingInvoiceRef;
}

interface ResolveClientServiceBillingInput {
  rawStatus: ServiceStatus;
  hasExcess: boolean;
  primaryClientId: string | null;
  thirdPartyClientId: string | null;
  viewingClientId: string;
  globalInvoiceFolio?: string | null;
  globalInvoiceNumeroFiscal?: string | null;
  closureBilling?: ClientClosureBillingState;
}

export interface ClientServiceBillingView {
  status: ServiceStatus;
  invoiceFolio?: string;
  invoiceNumeroFiscal?: string;
}

const invoiceFields = (invoice?: ClientBillingInvoiceRef): Pick<
  ClientServiceBillingView,
  'invoiceFolio' | 'invoiceNumeroFiscal'
> => ({
  invoiceFolio: invoice?.folio || undefined,
  invoiceNumeroFiscal: invoice?.numeroFiscal || undefined,
});

/**
 * Resuelve el estado y la factura visibles desde el pipeline de un cliente.
 * La aseguradora ve la parte cubierta; el tercero pagador ve el excedente.
 */
export const resolveClientServiceBillingView = ({
  rawStatus,
  hasExcess,
  primaryClientId,
  thirdPartyClientId,
  viewingClientId,
  globalInvoiceFolio,
  globalInvoiceNumeroFiscal,
  closureBilling,
}: ResolveClientServiceBillingInput): ClientServiceBillingView => {
  const isPrimaryView = primaryClientId === viewingClientId;
  const isThirdPartyView = Boolean(
    hasExcess && thirdPartyClientId && thirdPartyClientId === viewingClientId,
  );

  if (!hasExcess || (!isPrimaryView && !isThirdPartyView)) {
    return {
      status: rawStatus,
      invoiceFolio: globalInvoiceFolio || undefined,
      invoiceNumeroFiscal: globalInvoiceNumeroFiscal || undefined,
    };
  }

  const relevantInvoiced = isThirdPartyView
    ? closureBilling?.excessInvoiced
    : closureBilling?.coveredInvoiced;
  const counterpartInvoiced = isThirdPartyView
    ? closureBilling?.coveredInvoiced
    : closureBilling?.excessInvoiced;
  const relevantInvoice = isThirdPartyView
    ? closureBilling?.excessInvoice
    : closureBilling?.coveredInvoice;

  if (relevantInvoiced) {
    return {
      status: 'invoiced',
      ...invoiceFields(relevantInvoice),
    };
  }

  if (counterpartInvoiced) {
    return {
      status: 'partially_invoiced',
      invoiceFolio: undefined,
      invoiceNumeroFiscal: undefined,
    };
  }

  // Compatibilidad con facturas históricas sin closure_services tipificado:
  // la factura global corresponde a la cobertura, nunca al tercero excedente.
  if (rawStatus === 'invoiced' || rawStatus === 'partially_invoiced') {
    if (isThirdPartyView) {
      return {
        status: 'partially_invoiced',
        invoiceFolio: undefined,
        invoiceNumeroFiscal: undefined,
      };
    }

    return {
      status: 'invoiced',
      invoiceFolio: globalInvoiceFolio || undefined,
      invoiceNumeroFiscal: globalInvoiceNumeroFiscal || undefined,
    };
  }

  return {
    status: rawStatus,
    invoiceFolio: undefined,
    invoiceNumeroFiscal: undefined,
  };
};

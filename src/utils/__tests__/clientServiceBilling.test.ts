import { describe, expect, it } from 'vitest';
import { resolveClientServiceBillingView } from '@/utils/clientServiceBilling';

const baseInput = {
  rawStatus: 'invoiced' as const,
  hasExcess: true,
  primaryClientId: 'auxilia',
  thirdPartyClientId: 'el-pelicano',
  globalInvoiceFolio: 'FACT-4496',
  globalInvoiceNumeroFiscal: '4292',
  closureBilling: {
    coveredInvoiced: true,
    excessInvoiced: false,
    coveredInvoice: {
      folio: 'FACT-4496',
      numeroFiscal: '4292',
    },
  },
};

describe('vista de facturación por cliente en Pipeline VIP', () => {
  it('muestra a Auxilia su cobertura facturada y su número fiscal', () => {
    expect(resolveClientServiceBillingView({
      ...baseInput,
      viewingClientId: 'auxilia',
    })).toEqual({
      status: 'invoiced',
      invoiceFolio: 'FACT-4496',
      invoiceNumeroFiscal: '4292',
    });
  });

  it('muestra al tercero como parcialmente facturado sin heredar la factura de Auxilia', () => {
    expect(resolveClientServiceBillingView({
      ...baseInput,
      viewingClientId: 'el-pelicano',
    })).toEqual({
      status: 'partially_invoiced',
      invoiceFolio: undefined,
      invoiceNumeroFiscal: undefined,
    });
  });

  it('muestra al tercero su propia factura cuando se factura el excedente', () => {
    expect(resolveClientServiceBillingView({
      ...baseInput,
      viewingClientId: 'el-pelicano',
      closureBilling: {
        ...baseInput.closureBilling,
        excessInvoiced: true,
        excessInvoice: {
          folio: 'FACT-4501',
          numeroFiscal: '4300',
        },
      },
    })).toEqual({
      status: 'invoiced',
      invoiceFolio: 'FACT-4501',
      invoiceNumeroFiscal: '4300',
    });
  });

  it('mantiene a Auxilia vinculada a su factura después de facturar el excedente', () => {
    expect(resolveClientServiceBillingView({
      ...baseInput,
      viewingClientId: 'auxilia',
      globalInvoiceFolio: 'FACT-4501',
      globalInvoiceNumeroFiscal: '4300',
      closureBilling: {
        ...baseInput.closureBilling,
        excessInvoiced: true,
        excessInvoice: {
          folio: 'FACT-4501',
          numeroFiscal: '4300',
        },
      },
    })).toEqual({
      status: 'invoiced',
      invoiceFolio: 'FACT-4496',
      invoiceNumeroFiscal: '4292',
    });
  });
});

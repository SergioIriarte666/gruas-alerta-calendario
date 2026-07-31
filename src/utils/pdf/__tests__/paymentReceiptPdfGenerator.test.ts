import { beforeEach, describe, expect, it, vi } from 'vitest';

const maybeSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  },
}));

vi.mock('../companyDataFetcher', () => ({
  fetchCompanyData: async () => ({
    businessName: 'Grúas 5 Norte',
    rut: '76.123.456-7',
    address: 'Copiapó',
    phone: '+56 9 0000 0000',
    email: 'contacto@gruas5norte.cl',
  }),
}));

const {
  generatePaymentReceiptPDF,
  paymentReceiptFileName,
  paymentReceiptNumber,
} = await import('../paymentReceiptPdfGenerator');

// El pago real del bug reportado: COMP-974F29FC, $1.190.000 aplicado a FACT-4495.
const payment = {
  id: '974f29fc-1b2c-4d5e-8f90-abcdef123456',
  amount: 1190000,
  payment_date: '2026-07-20',
  payment_method: 'Transferencia',
  bank_reference: null,
  notes: null,
  client_id: 'client-1',
  remaining_amount: 0,
  created_at: '2026-07-20T12:00:00Z',
  clients: {
    name: 'Transportes Gonzalez e Hijos Limitada',
    rut: '76.374.411-6',
    address: 'Copiapó',
    phone: '+56 9 1111 1111',
    email: 'pagos@transportes.cl',
  },
  payment_applications: [
    { applied_amount: 1190000, invoices: { folio: 'FACT-4495', numero_fiscal: '4495' } },
  ],
};

/** Texto plano del PDF: jsPDF no comprime los streams sin `compress: true`. */
const pdfText = async (blob: Blob) => await blob.text();

describe('generatePaymentReceiptPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: payment, error: null });
    // Sin red en los tests: el header cae a su rama "sin logo".
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));
  });

  it('rotula el documento como comprobante de pago', async () => {
    const text = await pdfText(await generatePaymentReceiptPDF(payment.id));

    expect(text).toContain('COMPROBANTE DE PAGO');
    expect(text).toContain('PAGO RECIBIDO');
    expect(text).toContain('COMP-974F29FC');
  });

  // El bug que llegó a clientes: el helper de header deducía el rótulo de los
  // flags de inspección, así que un comprobante salía como "REPORTE DE
  // INSPECCIÓN PRE-SERVICIO" con badge naranjo "PRE-SERVICIO".
  it('no arrastra ni una palabra del reporte de inspección', async () => {
    const text = await pdfText(await generatePaymentReceiptPDF(payment.id));

    expect(text).not.toContain('PRE-SERVICIO');
    expect(text).not.toContain('INSPECCI');
    expect(text).not.toContain('INFORME FINAL DE SERVICIO');
    expect(text).not.toContain('ACTA DE SERVICIO');
  });

  it('nombra el archivo con el número del comprobante', () => {
    expect(paymentReceiptNumber(payment.id)).toBe('COMP-974F29FC');
    expect(paymentReceiptFileName(payment.id)).toBe('comprobante-COMP-974F29FC.pdf');
  });
});

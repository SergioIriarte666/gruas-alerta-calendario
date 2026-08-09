import { describe, expect, it } from 'vitest';
import {
  assertAutomaticPaymentSucceeded,
  normalizeInvoiceStatusBeforeAutomaticPayment,
} from '@/utils/invoicePaymentCreation';

describe('creación de facturas pagadas', () => {
  it('inserta temporalmente como emitida hasta registrar el pago', () => {
    expect(normalizeInvoiceStatusBeforeAutomaticPayment('paid')).toBe('sent');
    expect(normalizeInvoiceStatusBeforeAutomaticPayment('draft')).toBe('draft');
    expect(normalizeInvoiceStatusBeforeAutomaticPayment('overdue')).toBe('overdue');
  });

  it('acepta únicamente una confirmación explícita del pago automático', () => {
    expect(() => assertAutomaticPaymentSucceeded({ success: true })).not.toThrow();
    expect(() => assertAutomaticPaymentSucceeded({
      success: false,
      error: 'No se pudo aplicar el pago',
    })).toThrow('No se pudo aplicar el pago');
    expect(() => assertAutomaticPaymentSucceeded(null)).toThrow(
      'La base de datos no confirmó la aplicación del pago',
    );
  });
});

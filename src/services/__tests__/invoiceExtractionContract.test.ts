import { describe, expect, it } from 'vitest';
import { invoiceItemProperties, invoiceItemRules } from '../../../supabase/functions/parse-receipt-image/invoiceExtraction';

describe('Contrato de lectura de renglones de factura', () => {
  it('solicita códigos literales sin perder guiones ni ceros iniciales', () => {
    expect(invoiceItemProperties.productCode.type).toBe('string');
    expect(invoiceItemRules).toContain('conservando letras, ceros iniciales y guiones');
  });
  it('separa el precio unitario del importe total del renglón y permite datos ilegibles', () => {
    expect(invoiceItemProperties.unitPrice.type).toEqual(['number', 'null']);
    expect(invoiceItemProperties.unitPrice.description).toContain('Nunca el Total');
    expect(invoiceItemRules).toContain('sin reconstruirlo desde el total');
    expect(invoiceItemProperties.unitPriceBasis.enum).toEqual(['net', 'gross', 'unknown']);
    expect(invoiceItemRules).toContain('No decidas esto por coincidencias entre sumas y totales');
  });
});

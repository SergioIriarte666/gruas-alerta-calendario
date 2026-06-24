import { describe, expect, it } from 'vitest';
import { buildCompactXmlDescription } from '../xmlGlosaHelpers';
import type { XMLDocumentData } from '@/types/suppliers';

const makeDocument = (overrides: Partial<XMLDocumentData> = {}): XMLDocumentData => ({
  folio: '1791312',
  document_type: 'Factura electrónica',
  issue_date: '2026-05-06',
  net_amount: 33150,
  vat_amount: 6299,
  total_amount: 39449,
  currency: 'CLP',
  description: '',
  supplier_rut: '76769841-0',
  ...overrides,
});

describe('buildCompactXmlDescription', () => {
  it('elimina el RUT, los cálculos y el folio de la descripción sugerida', () => {
    const result = buildCompactXmlDescription(makeDocument({
      items: [
        { description: '76769841-0 Servicio Facturación Electrónica Mensual', quantity: 1, unit_price: 30150, total: 35879 },
        { description: '76769841-0 Reposición del servicio con fecha de 27-04-2026', quantity: 1, unit_price: 3000, total: 3570 },
      ],
    }));

    expect(result).toBe('Servicio Facturación Electrónica Mensual · Reposición del servicio con fecha de 27-04-2026');
    expect(result).not.toContain('1791312');
    expect(result).not.toContain('$');
  });

  it('resume documentos con muchos conceptos', () => {
    const result = buildCompactXmlDescription(makeDocument({
      items: [
        { description: 'Servicio mensual', quantity: 1, unit_price: 1, total: 1 },
        { description: 'Reposición', quantity: 1, unit_price: 1, total: 1 },
        { description: 'Soporte', quantity: 1, unit_price: 1, total: 1 },
        { description: 'Configuración', quantity: 1, unit_price: 1, total: 1 },
      ],
    }));

    expect(result).toBe('Servicio mensual · Reposición · y 2 conceptos más');
  });
});

import { describe, expect, it } from 'vitest';
import { extractFolioFromDescription } from '@/utils/folioExtractor';

describe('extractFolioFromDescription', () => {
  it.each([
    ['Factura Electrónica N° 504448', '504448'],
    ['Compra Nº3447671', '3447671'],
    ['Documento No 497480', '497480'],
    ['Folio 52133267', '52133267'],
    ['folio 3076', '3076'],
  ])('extracts a folio from "%s"', (description, expected) => {
    expect(extractFolioFromDescription(description)).toBe(expected);
  });

  it.each([null, undefined, '', 'Factura 12', 'Orden de compra 12345'])(
    'returns null when no supported folio exists',
    (description) => {
      expect(extractFolioFromDescription(description)).toBeNull();
    },
  );

  it('returns the first folio when the description contains more than one', () => {
    expect(extractFolioFromDescription('N° 111 y también N° 222')).toBe('111');
  });

  it('requires at least three digits to avoid short item-number false positives', () => {
    expect(extractFolioFromDescription('Item N° 1 del listado')).toBeNull();
    expect(extractFolioFromDescription('Item N° 99 del listado')).toBeNull();
    expect(extractFolioFromDescription('Item N° 100 del listado')).toBe('100');
  });
});

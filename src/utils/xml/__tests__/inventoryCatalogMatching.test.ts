import { describe, expect, it } from 'vitest';
import { isNearbyProductCode, matchInventoryCatalog } from '../inventoryCatalogMatching';
import type { XMLDocumentItem } from '@/types/suppliers';

const catalog = [
  { id: 'torx', name: 'Dado Torx T-40 Largo Force', sku: 'DAT89040-1' },
  { id: 'impacto', name: 'Dado Impacto Torx 1/2" X 38Mm Ferton', sku: 'DAT89040-2' },
];
const line = (code: string, description = 'DADO IMPACTO TORX T-40 FORCE'): XMLDocumentItem => ({ product_code: code, description, quantity: 2, unit_price: 7983, total: 19000 });

describe('inventory catalog identity with OCR mistakes', () => {
  it('suggests the missing-zero SKU without silently linking different descriptions or brands', () => {
    const result = matchInventoryCatalog(line('DAT8940-2'), catalog);
    expect(result.match).toBeNull();
    expect(result.candidates.map(item => item.id)).toEqual(['impacto']);
  });
  it('recognizes a unique exact name despite a misread SKU', () => {
    expect(matchInventoryCatalog(line('DAT8940-1', 'DADO TORX T-40 LARGO FORCE'), catalog).match?.id).toBe('torx');
  });
  it('matches the exact SKU independent of description', () => {
    expect(matchInventoryCatalog(line('dat89040-2'), catalog).match?.id).toBe('impacto');
  });
  it('never selects the first of multiple identical codes or names', () => {
    const duplicates = [...catalog, { ...catalog[1], id: 'duplicate' }];
    expect(matchInventoryCatalog(line('DAT89040-2'), duplicates).match).toBeNull();
    expect(matchInventoryCatalog(line('missing', catalog[1].name), duplicates).candidates).toHaveLength(2);
  });
  it('ignores placeholders and short or unrelated codes', () => {
    expect(matchInventoryCatalog(line('0'), catalog).candidates).toEqual([]);
    expect(isNearbyProductCode('123', '1234')).toBe(false);
    expect(isNearbyProductCode('DAT8940-2', 'DAT89040-1')).toBe(false);
    expect(isNearbyProductCode('DAT8940-2', 'DAT89040-2')).toBe(true);
    expect(isNearbyProductCode('DAT89040-2', 'DAT89040-2')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { computeSelectedTotal, computeLineTotal } from '../xmlInventoryHelpers';
import type { XMLDocumentItem } from '@/types/suppliers';

// Escenario afecto (IVA 19% por línea): el parser deja `subtotal` como neto
// (MontoItem) y `total` como bruto (MontoItem * 1.19). La suma de brutos == MntTotal.
const affectItems: XMLDocumentItem[] = [
  { description: 'Closet 2P', quantity: 1, unit_price: 100824, subtotal: 100824, tax_amount: 19157, total: 119981, tax_rate: 19 },
  { description: 'Codo PVC', quantity: 2, unit_price: 10000, subtotal: 20000, tax_amount: 3800, total: 23800, tax_rate: 19 },
  { description: 'Cemento', quantity: 1, unit_price: 12000, subtotal: 12000, tax_amount: 2280, total: 14280, tax_rate: 19 },
  { description: 'Fijaciones', quantity: 1, unit_price: 5932, subtotal: 5932, tax_amount: 1127, total: 7059, tax_rate: 19 },
];
const affectDocTotal = affectItems.reduce((sum, item) => sum + Math.round(computeLineTotal(item)), 0); // 165120

const allSelected = new Set(affectItems.map((_, i) => i));

describe('computeSelectedTotal', () => {
  it('con todas las líneas seleccionadas devuelve el total del documento exacto', () => {
    expect(computeSelectedTotal(affectItems, allSelected, affectDocTotal)).toBe(affectDocTotal);
  });

  it('con una selección parcial suma solo los brutos de las líneas marcadas', () => {
    // Deselecciona "Closet 2P" (índice 0) → quedan las 3 líneas restantes.
    const partial = new Set([1, 2, 3]);
    const expected = 23800 + 14280 + 7059; // 45139
    expect(computeSelectedTotal(affectItems, partial, affectDocTotal)).toBe(expected);
  });

  it('con 0 líneas seleccionadas devuelve 0', () => {
    expect(computeSelectedTotal(affectItems, new Set(), affectDocTotal)).toBe(0);
  });

  it('sin ítems (documento sin detalle) devuelve el total del documento', () => {
    expect(computeSelectedTotal([], new Set(), 50000)).toBe(50000);
    expect(computeSelectedTotal(undefined, new Set(), 50000)).toBe(50000);
  });

  it('respeta líneas exentas mezcladas (tax_rate 0 → bruto = neto)', () => {
    const mixed: XMLDocumentItem[] = [
      { description: 'Afecto', quantity: 1, unit_price: 10000, subtotal: 10000, tax_amount: 1900, total: 11900, tax_rate: 19 },
      { description: 'Exento', quantity: 1, unit_price: 5000, subtotal: 5000, tax_amount: 0, total: 5000, tax_rate: 0 },
    ];
    const docTotal = 16900;
    // Solo la línea exenta → 5000 (sin IVA).
    expect(computeSelectedTotal(mixed, new Set([1]), docTotal)).toBe(5000);
    // Solo la afecta → 11900 (con IVA).
    expect(computeSelectedTotal(mixed, new Set([0]), docTotal)).toBe(11900);
    // Ambas → total del documento exacto.
    expect(computeSelectedTotal(mixed, new Set([0, 1]), docTotal)).toBe(docTotal);
  });
});

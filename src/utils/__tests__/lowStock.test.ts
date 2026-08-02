import { describe, expect, it } from 'vitest';
import {
  selectLowStock,
  selectOutOfStockWithoutMinimum,
  stockCoveragePercent,
  summarizeStockByProduct,
  type StockRowInput,
} from '@/utils/lowStock';

const row = (overrides: Partial<StockRowInput> & Pick<StockRowInput, 'itemId'>): StockRowInput => ({
  itemName: `Producto ${overrides.itemId}`,
  isActive: true,
  minimumStock: 0,
  quantity: 0,
  ...overrides,
});

describe('lowStock', () => {
  it('no marca bajo mínimo a los productos sin mínimo definido', () => {
    // El bug original: minimum_stock es DEFAULT 0, así que todo agotado quedaba
    // "bajo mínimo" y la tarjeta marcaba 122 de 126.
    const summaries = summarizeStockByProduct([
      row({ itemId: 'sin-minimo-agotado', minimumStock: 0, quantity: 0 }),
      row({ itemId: 'sin-minimo-con-stock', minimumStock: 0, quantity: 5 }),
      row({ itemId: 'con-minimo-bajo', minimumStock: 3, quantity: 1 }),
    ]);

    expect(selectLowStock(summaries).map((s) => s.itemId)).toEqual(['con-minimo-bajo']);
  });

  it('suma todas las ubicaciones antes de comparar contra el mínimo', () => {
    // inventory_stock tiene una fila por producto+ubicación, pero el mínimo es del
    // producto: 2 + 2 = 4 supera el mínimo de 3, no está bajo mínimo.
    const summaries = summarizeStockByProduct([
      row({ itemId: 'repartido', minimumStock: 3, quantity: 2, locationName: 'Bodega Central' }),
      row({ itemId: 'repartido', minimumStock: 3, quantity: 2, locationName: 'Taller' }),
    ]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].quantity).toBe(4);
    expect(summaries[0].locations).toEqual(['Bodega Central', 'Taller']);
    expect(selectLowStock(summaries)).toHaveLength(0);
  });

  it('cuenta una sola vez un producto repartido que sí está bajo mínimo', () => {
    const summaries = summarizeStockByProduct([
      row({ itemId: 'repartido', minimumStock: 10, quantity: 2, locationName: 'Bodega Central' }),
      row({ itemId: 'repartido', minimumStock: 10, quantity: 3, locationName: 'Taller' }),
    ]);

    const low = selectLowStock(summaries);
    expect(low).toHaveLength(1);
    expect(low[0].quantity).toBe(5);
    expect(low[0].missing).toBe(5);
  });

  it('excluye productos inactivos', () => {
    const summaries = summarizeStockByProduct([
      row({ itemId: 'inactivo', isActive: false, minimumStock: 5, quantity: 0 }),
      row({ itemId: 'activo', minimumStock: 5, quantity: 0 }),
    ]);

    expect(summaries.map((s) => s.itemId)).toEqual(['activo']);
  });

  it('no solapa bajo mínimo con sin stock', () => {
    const summaries = summarizeStockByProduct([
      row({ itemId: 'agotado-con-minimo', minimumStock: 2, quantity: 0 }),
      row({ itemId: 'agotado-sin-minimo', minimumStock: 0, quantity: 0 }),
    ]);

    const low = selectLowStock(summaries).map((s) => s.itemId);
    const out = selectOutOfStockWithoutMinimum(summaries).map((s) => s.itemId);

    expect(low).toEqual(['agotado-con-minimo']);
    expect(out).toEqual(['agotado-sin-minimo']);
    expect(low.filter((id) => out.includes(id))).toEqual([]);
  });

  it('ordena primero los agotados y después por lo que más falta', () => {
    const summaries = summarizeStockByProduct([
      row({ itemId: 'falta-poco', minimumStock: 4, quantity: 3 }),
      row({ itemId: 'falta-mucho', minimumStock: 20, quantity: 2 }),
      row({ itemId: 'agotado', minimumStock: 1, quantity: 0 }),
    ]);

    expect(selectLowStock(summaries).map((s) => s.itemId)).toEqual([
      'agotado',
      'falta-mucho',
      'falta-poco',
    ]);
  });

  it('calcula el faltante contra el mínimo', () => {
    const [summary] = summarizeStockByProduct([row({ itemId: 'x', minimumStock: 10, quantity: 4 })]);
    expect(summary.missing).toBe(6);
    expect(summary.label).toBe('Bajo mínimo');
  });

  it('rotula agotado el producto bajo mínimo sin ninguna unidad', () => {
    const [summary] = summarizeStockByProduct([row({ itemId: 'x', minimumStock: 10, quantity: 0 })]);
    expect(summary.label).toBe('Agotado');
    expect(summary.missing).toBe(10);
  });

  it('devuelve null en la cobertura cuando no hay mínimo, en vez de dividir por cero', () => {
    expect(stockCoveragePercent(0, 0)).toBeNull();
    expect(stockCoveragePercent(5, 0)).toBeNull();
    expect(stockCoveragePercent(5, null)).toBeNull();
  });

  it('acota la cobertura entre 0 y 100', () => {
    expect(stockCoveragePercent(0, 4)).toBe(0);
    expect(stockCoveragePercent(2, 4)).toBe(50);
    expect(stockCoveragePercent(40, 4)).toBe(100);
    expect(stockCoveragePercent(-3, 4)).toBe(0);
  });

  it('tolera cantidades nulas sin romper el total', () => {
    const summaries = summarizeStockByProduct([
      row({ itemId: 'x', minimumStock: 2, quantity: null }),
      row({ itemId: 'x', minimumStock: 2, quantity: 1 }),
    ]);
    expect(summaries[0].quantity).toBe(1);
  });
});

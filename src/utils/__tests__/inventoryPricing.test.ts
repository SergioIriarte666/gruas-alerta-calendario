import { describe, expect, it } from 'vitest';
import { getSalePrice, describeSalePriceSource } from '../inventoryPricing';

describe('getSalePrice', () => {
  it('usa sale_price_fixed cuando está configurado, sin importar el costo', () => {
    const result = getSalePrice({ unit_cost: 14161, sale_markup_percent: 50, sale_price_fixed: 20000 }, 30);
    expect(result).toEqual({ price: 20000, source: 'fixed', markupPercent: expect.any(Number) });
  });

  it('usa sale_markup_percent cuando no hay precio fijo', () => {
    const result = getSalePrice({ unit_cost: 14161, sale_markup_percent: 30, sale_price_fixed: null }, 50);
    expect(result.price).toBe(Math.round(14161 * 1.3));
    expect(result.source).toBe('markup');
    expect(result.markupPercent).toBe(30);
  });

  it('cae al margen por defecto cuando ambos son null', () => {
    const result = getSalePrice({ unit_cost: 14161, sale_markup_percent: null, sale_price_fixed: null }, 30);
    expect(result.price).toBe(Math.round(14161 * 1.3));
    expect(result.source).toBe('default');
    expect(result.markupPercent).toBe(30);
  });

  it('redondea siempre a peso entero (CLP sin decimales)', () => {
    const result = getSalePrice({ unit_cost: 999, sale_markup_percent: 33, sale_price_fixed: null }, 30);
    expect(Number.isInteger(result.price)).toBe(true);
  });

  it('trata unit_cost faltante como 0', () => {
    const result = getSalePrice({ unit_cost: 0, sale_markup_percent: null, sale_price_fixed: null }, 30);
    expect(result.price).toBe(0);
  });
});

describe('describeSalePriceSource', () => {
  it('describe un precio fijo', () => {
    expect(describeSalePriceSource({ price: 20000, source: 'fixed', markupPercent: 0 })).toBe('fijo');
  });

  it('describe un margen propio redondeado', () => {
    expect(describeSalePriceSource({ price: 18409, source: 'markup', markupPercent: 30 })).toBe('+30% (margen propio)');
  });

  it('describe el margen por defecto', () => {
    expect(describeSalePriceSource({ price: 18409, source: 'default', markupPercent: 30 })).toBe('+30% (margen por defecto)');
  });
});

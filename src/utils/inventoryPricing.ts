export interface SalePriceInput {
  unit_cost: number;
  sale_markup_percent?: number | null;
  sale_price_fixed?: number | null;
}

export type SalePriceSource = 'fixed' | 'markup' | 'default';

export interface SalePriceResult {
  /** Precio de venta efectivo, redondeado a peso entero (CLP sin decimales). */
  price: number;
  /** Origen del precio: valor fijo propio, % propio, o margen por defecto global. */
  source: SalePriceSource;
  /** Margen efectivo aplicado, en porcentaje sobre unit_cost. */
  markupPercent: number;
}

/**
 * Calcula el precio de venta efectivo de un producto de inventario.
 *
 * Precedencia:
 *   1. `sale_price_fixed` no nulo → se usa ese valor tal cual (source: 'fixed').
 *   2. `sale_markup_percent` no nulo → unit_cost * (1 + pct/100) (source: 'markup').
 *   3. Ambos nulos → unit_cost * (1 + defaultMarkupPercent/100) (source: 'default').
 *
 * unit_cost es siempre el costo FIFO real (no se modifica ni se usa aquí
 * para otra cosa que calcular el precio sugerido). El resultado se
 * redondea a entero porque CLP no usa decimales.
 */
export function getSalePrice(item: SalePriceInput, defaultMarkupPercent: number): SalePriceResult {
  const unitCost = item.unit_cost || 0;

  if (item.sale_price_fixed != null) {
    const markupPercent = unitCost > 0 ? ((item.sale_price_fixed - unitCost) / unitCost) * 100 : 0;
    return { price: Math.round(item.sale_price_fixed), source: 'fixed', markupPercent };
  }

  if (item.sale_markup_percent != null) {
    return {
      price: Math.round(unitCost * (1 + item.sale_markup_percent / 100)),
      source: 'markup',
      markupPercent: item.sale_markup_percent,
    };
  }

  return {
    price: Math.round(unitCost * (1 + defaultMarkupPercent / 100)),
    source: 'default',
    markupPercent: defaultMarkupPercent,
  };
}

const SOURCE_LABELS: Record<SalePriceSource, string> = {
  fixed: 'fijo',
  markup: 'margen propio',
  default: 'margen por defecto',
};

/** Texto corto para tooltips: "fijo", "+30% (margen propio)" o "+30% (margen por defecto)". */
export function describeSalePriceSource(result: SalePriceResult): string {
  if (result.source === 'fixed') return SOURCE_LABELS.fixed;
  return `+${Math.round(result.markupPercent)}% (${SOURCE_LABELS[result.source]})`;
}

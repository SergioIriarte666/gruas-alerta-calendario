/**
 * Fuente única de la definición de "stock bajo" en Bodega.
 *
 * Antes cada pantalla comparaba `current_quantity <= minimum_stock` sobre las filas
 * crudas de `inventory_stock`. Eso daba tres números distintos y todos malos:
 *
 *  - `minimum_stock` es `integer DEFAULT 0`, así que cualquier producto agotado
 *    quedaba "bajo mínimo" aunque nadie le hubiera definido un mínimo. La tarjeta
 *    marcaba 122 de 126 cuando el número real era 11.
 *  - `inventory_stock` tiene una fila por producto **y ubicación**, y el mínimo es
 *    global del producto. Un producto repartido en dos bodegas se contaba dos veces,
 *    o aparecía bajo mínimo teniendo el total completo.
 *  - Los productos inactivos entraban igual.
 *
 * Reglas, en orden:
 *  1. Se suma la existencia de todas las ubicaciones ANTES de comparar.
 *  2. Los productos inactivos no existen para este cálculo.
 *  3. Sin mínimo definido (`minimum_stock <= 0`) no hay alerta posible.
 *  4. "Bajo mínimo" y "sin stock" son categorías **excluyentes**: un producto agotado
 *     que sí tiene mínimo es un caso de bajo mínimo (el más urgente), no se cuenta
 *     dos veces en las dos tarjetas.
 *
 * Se usa `current_quantity`, no `available_quantity`: la segunda es una columna
 * generada (`current_quantity - reserved_quantity`) y hoy no hay reservas, pero
 * mezclar las dos hacía que la tarjeta y la fila de la tabla mostraran distinto.
 */

/** Fila de existencia normalizada. Cada pantalla mapea su propio embed a esto. */
export interface StockRowInput {
  itemId: string;
  itemName: string;
  isActive: boolean;
  minimumStock: number | null | undefined;
  quantity: number | null | undefined;
  locationName?: string | null;
  categoryName?: string | null;
  sku?: string | null;
}

export type StockStatus =
  /** Tiene mínimo definido y la existencia total está en o bajo ese mínimo. */
  | 'bajo_minimo'
  /** Agotado y sin mínimo definido: no puede generar alerta hasta que le carguen uno. */
  | 'agotado_sin_minimo'
  /** Con existencia suficiente, o sin mínimo pero con stock. */
  | 'normal';

export interface ProductStockSummary {
  itemId: string;
  name: string;
  sku?: string | null;
  categoryName?: string | null;
  /** Suma de todas las ubicaciones. */
  quantity: number;
  minimumStock: number;
  /** Cuánto falta para llegar al mínimo. 0 si no aplica. */
  missing: number;
  /** Ubicaciones donde el producto tiene existencia registrada. */
  locations: string[];
  status: StockStatus;
  /** Rótulo de la insignia. Sale de acá para que tarjeta y tabla no se contradigan. */
  label: string;
}

const toNumber = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const resolveStatus = (quantity: number, minimumStock: number): StockStatus => {
  if (minimumStock > 0) return quantity <= minimumStock ? 'bajo_minimo' : 'normal';
  return quantity === 0 ? 'agotado_sin_minimo' : 'normal';
};

const resolveLabel = (status: StockStatus, quantity: number): string => {
  if (status === 'bajo_minimo') return quantity === 0 ? 'Agotado' : 'Bajo mínimo';
  if (status === 'agotado_sin_minimo') return 'Sin stock';
  return 'Normal';
};

/**
 * Agrupa filas de `inventory_stock` por producto y las clasifica.
 * Devuelve únicamente productos activos.
 */
export const summarizeStockByProduct = (rows: StockRowInput[]): ProductStockSummary[] => {
  const byProduct = new Map<string, ProductStockSummary>();

  for (const row of rows) {
    if (!row.itemId || !row.isActive) continue;

    const existing = byProduct.get(row.itemId);
    const quantity = toNumber(row.quantity);
    const locationName = row.locationName?.trim();

    if (existing) {
      existing.quantity += quantity;
      if (locationName && !existing.locations.includes(locationName)) {
        existing.locations.push(locationName);
      }
      continue;
    }

    byProduct.set(row.itemId, {
      itemId: row.itemId,
      name: row.itemName,
      sku: row.sku ?? null,
      categoryName: row.categoryName ?? null,
      quantity,
      minimumStock: Math.max(0, toNumber(row.minimumStock)),
      missing: 0,
      locations: locationName ? [locationName] : [],
      status: 'normal',
      label: 'Normal',
    });
  }

  for (const summary of byProduct.values()) {
    summary.status = resolveStatus(summary.quantity, summary.minimumStock);
    summary.missing =
      summary.status === 'bajo_minimo' ? Math.max(0, summary.minimumStock - summary.quantity) : 0;
    summary.label = resolveLabel(summary.status, summary.quantity);
    summary.locations.sort((a, b) => a.localeCompare(b, 'es'));
  }

  return [...byProduct.values()];
};

/**
 * Productos bajo mínimo, del más urgente al menos: primero los agotados, después
 * por cantidad faltante, y a igualdad por nombre.
 */
export const selectLowStock = (summaries: ProductStockSummary[]): ProductStockSummary[] =>
  summaries
    .filter((summary) => summary.status === 'bajo_minimo')
    .sort((a, b) => {
      if (a.quantity === 0 !== (b.quantity === 0)) return a.quantity === 0 ? -1 : 1;
      if (b.missing !== a.missing) return b.missing - a.missing;
      return a.name.localeCompare(b.name, 'es');
    });

/** Productos agotados que todavía no tienen mínimo definido. */
export const selectOutOfStockWithoutMinimum = (
  summaries: ProductStockSummary[],
): ProductStockSummary[] =>
  summaries
    .filter((summary) => summary.status === 'agotado_sin_minimo')
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

/**
 * Porcentaje de cobertura contra el mínimo, acotado a 0-100.
 * Devuelve `null` cuando no hay mínimo: sin mínimo no hay porcentaje que mostrar
 * (dividir por cero daba `Infinity` o `NaN` en las barras de progreso).
 */
export const stockCoveragePercent = (
  quantity: number | null | undefined,
  minimumStock: number | null | undefined,
): number | null => {
  const minimum = toNumber(minimumStock);
  if (minimum <= 0) return null;
  const ratio = (toNumber(quantity) / minimum) * 100;
  return Math.max(0, Math.min(100, Math.round(ratio)));
};

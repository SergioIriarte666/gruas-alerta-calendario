/** Fila de `inventory_stock` (una por producto/ubicación). */
export interface StockQuantityRow {
  current_quantity?: number | null;
  reserved_quantity?: number | null;
  available_quantity?: number | null;
}

/**
 * Stock disponible de un producto: suma de `available_quantity` de todas sus
 * ubicaciones. Es la misma fuente que pinta el módulo Bodega.
 *
 * Regla dura: el stock NO se reconstruye sumando `inventory_movements` en el
 * cliente. Ese cálculo contaba también los movimientos anulados y hacía que el
 * selector de Servicios mostrara un número menor que Bodega.
 *
 * `available_quantity` es columna calculada y puede venir nula en lecturas
 * parciales; en ese caso se reconstruye como existencia menos reservado.
 */
export const sumAvailableStock = (rows: StockQuantityRow[] | null | undefined): number =>
  (rows ?? []).reduce(
    (total, row) =>
      total +
      (row.available_quantity ??
        (row.current_quantity || 0) - (row.reserved_quantity || 0)),
    0,
  );

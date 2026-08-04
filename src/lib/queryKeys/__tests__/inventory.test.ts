import { describe, it, expect, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import {
  inventoryQueryKeys,
  STOCK_DEPENDENT_QUERY_KEYS,
  invalidateStockDependentQueries,
} from '../inventory';

describe('llaves de stock de inventario', () => {
  it('incluye el selector de productos de Servicios entre las vistas dependientes del stock', () => {
    // El bug original: el selector usaba una llave que ninguna mutación
    // invalidaba, así que Servicios y Bodega mostraban números distintos.
    expect(STOCK_DEPENDENT_QUERY_KEYS).toContainEqual(inventoryQueryKeys.salesSelector);
    expect(STOCK_DEPENDENT_QUERY_KEYS).toContainEqual(inventoryQueryKeys.stock);
  });

  it('invalida de una sola vez todas las vistas que muestran stock', () => {
    const invalidateQueries = vi.fn();
    invalidateStockDependentQueries({ invalidateQueries } as unknown as QueryClient);

    expect(invalidateQueries).toHaveBeenCalledTimes(STOCK_DEPENDENT_QUERY_KEYS.length);
    STOCK_DEPENDENT_QUERY_KEYS.forEach((queryKey) => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
    });
  });
});

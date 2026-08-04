import type { QueryClient } from '@tanstack/react-query';

/**
 * Llaves de React Query de todo lo que muestra stock de bodega.
 *
 * Existen acá y no sueltas en cada hook por un motivo concreto: el selector de
 * productos del formulario de Servicios (`salesSelector`) usaba una llave que
 * ninguna mutación invalidaba, así que seguía sirviendo el stock cacheado
 * mientras Bodega ya mostraba el número nuevo (p. ej. tras anular un
 * movimiento). Cualquier mutación que mueva stock debe invalidar el conjunto
 * completo vía `invalidateStockDependentQueries`, no una lista escrita a mano.
 */
export const inventoryQueryKeys = {
  /** Catálogo de productos (`inventory_items`). */
  items: ['inventory-items'] as const,
  /** Existencias por producto/ubicación (`inventory_stock`). */
  stock: ['inventory-stock'] as const,
  /** Movimientos de bodega (`inventory_movements`). */
  movements: ['inventory-movements'] as const,
  /** KPIs del panel de Bodega. */
  stats: ['inventory-stats'] as const,
  /** Productos bajo su mínimo. Ver `@/utils/lowStock`. */
  lowStock: ['low-stock-items'] as const,
  /** Productos agotados sin mínimo cargado. Ver `@/utils/lowStock`. */
  outOfStockWithoutMinimum: ['out-of-stock-no-minimum'] as const,
  /** Selector de productos vendibles del formulario de Servicios. */
  salesSelector: ['inventory-items-for-sales'] as const,
} as const;

/**
 * Toda vista cuyo número cambia cuando cambia el stock. El selector de
 * Servicios va incluido a propósito: es la única forma de que muestre siempre
 * el mismo número que Bodega.
 */
export const STOCK_DEPENDENT_QUERY_KEYS: ReadonlyArray<readonly string[]> = [
  inventoryQueryKeys.items,
  inventoryQueryKeys.stock,
  inventoryQueryKeys.movements,
  inventoryQueryKeys.stats,
  inventoryQueryKeys.lowStock,
  inventoryQueryKeys.outOfStockWithoutMinimum,
  inventoryQueryKeys.salesSelector,
];

/**
 * Invalida todas las vistas de stock de una sola vez. Usar en cualquier
 * mutación que cree, edite, anule o revierta movimientos de inventario.
 */
export const invalidateStockDependentQueries = (queryClient: QueryClient): void => {
  STOCK_DEPENDENT_QUERY_KEYS.forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey });
  });
};

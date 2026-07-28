import type { CostCategory } from '@/types/costs';

/**
 * Categoría "Comisión Operador".
 *
 * Las comisiones tienen un dueño único: el trigger que las deriva de
 * service_resources al completar el servicio. Crearlas a mano como un costo
 * cualquiera produce dos filas para el mismo hecho —una que se recalcula sola y
 * otra que no— y así apareció "Comisión Juan Carlos Sanchez" duplicada en el
 * folio 3263006-1 el 27/07.
 *
 * La base de datos rechaza esos INSERT (prevent_manual_commission_cost). Esto es
 * la capa visual del mismo criterio: que no se pueda ni intentar.
 */
export const COMMISSION_CATEGORY_ID = '440296d4-09c2-4f3a-b02b-835f861df4c4';

export const COMMISSION_CATEGORY_NOTICE =
  'Las comisiones se generan automáticamente al completar el servicio.';

export const isCommissionCategory = (category: Pick<CostCategory, 'id' | 'name'>): boolean =>
  category.id === COMMISSION_CATEGORY_ID ||
  /comisi[oó]n/i.test(category.name || '');

/**
 * Categorías ofrecidas para creación/edición manual.
 *
 * `selectedCategoryId` mantiene visible la categoría del registro que se está
 * editando: los costos de comisión históricos siguen abriéndose y guardándose
 * con su nombre a la vista; lo que se cierra es elegirla de nuevo.
 */
export const selectableCostCategories = (
  categories: CostCategory[],
  selectedCategoryId?: string | null
): CostCategory[] =>
  categories.filter(cat => !isCommissionCategory(cat) || cat.id === selectedCategoryId);

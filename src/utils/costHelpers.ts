import { Cost } from '@/types/costs';
import { getCurrentChileDateString } from '@/utils/timezoneUtils';

/**
 * Prepara los datos de un costo para ser duplicado.
 * Actualiza la fecha a hoy y marca la descripción como duplicado.
 */
export const prepareCostForDuplication = (cost: Cost) => {
  const currentDate = getCurrentChileDateString();

  return {
    // Copiar campos principales
    description: `[Duplicado] ${cost.description}`,
    amount: Number(cost.amount),
    category_id: cost.category_id,
    subcategory: cost.subcategory || '',

    // Actualizar fecha a hoy
    date: currentDate,

    // Mantener asociaciones
    crane_id: cost.crane_id || 'none',
    operator_id: cost.operator_id || 'none',
    service_id: cost.service_id || 'none',
    service_folio: cost.service_folio || '',
    cost_center_id: cost.cost_center_id || 'none',

    // Copiar notas
    notes: cost.notes ? `[Copia de costo anterior]\n${cost.notes}` : '',

    // Campos de inventario (no duplicar movimientos)
    purchase_quantity: null,
    purchase_unit_cost: null,
    immediate_consumption: false,
    supplier_id: cost.supplier_id || 'none',
  };
};

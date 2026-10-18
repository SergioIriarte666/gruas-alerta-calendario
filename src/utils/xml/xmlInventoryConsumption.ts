export interface LineConsumption {
  immediate: boolean;
  quantity: number;
  craneId: string;
}

export function resolveLineConsumption(quantity: number, value?: LineConsumption, defaultCraneId = '') {
  return value || { immediate: false, quantity, craneId: defaultCraneId };
}

export function validateLineConsumption(purchasedQuantity: number, value: LineConsumption, defaultCraneId = ''): string | null {
  if (!value.immediate) return null;
  if (!Number.isInteger(value.quantity) || value.quantity <= 0 || value.quantity > purchasedQuantity) {
    return 'La cantidad a consumir debe ser un entero entre 1 y la cantidad comprada.';
  }
  if (!(value.craneId || defaultCraneId)) return 'Selecciona una grúa para el consumo inmediato.';
  return null;
}

export function buildLineConsumptionPayload(value: LineConsumption, defaultCraneId = '') {
  return {
    consumption_quantity: value.immediate ? value.quantity : 0,
    consumption_crane_id: value.immediate ? value.craneId || defaultCraneId || null : null,
  };
}

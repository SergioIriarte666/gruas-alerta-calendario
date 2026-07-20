interface ComparableServiceChange {
  changeType: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

interface IdentifiableServiceChange extends ComparableServiceChange {
  id: string;
  eventId: string | null;
  serviceId: string | null;
}

const ZERO_DEFAULT_FIELDS = new Set([
  'operator_commission',
  'outsourced_cost',
  'custody_discount_percentage',
]);

const normalizeComparableValue = (fieldName: string, value: string | null): string | number | null => {
  if (ZERO_DEFAULT_FIELDS.has(fieldName)) {
    if (value === null || value === '') return 0;

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : value;
  }

  return value === '' ? null : value;
};

/**
 * Oculta entradas heredadas que representan el mismo valor funcional.
 * Los eventos CREATE/DELETE/SNAPSHOT siempre forman parte del historial.
 */
export const isMeaningfulServiceChange = (change: ComparableServiceChange): boolean => {
  if (change.changeType !== 'UPDATE') return true;

  const oldValue = normalizeComparableValue(change.fieldName, change.oldValue);
  const newValue = normalizeComparableValue(change.fieldName, change.newValue);

  return !Object.is(oldValue, newValue);
};

export const isServiceItemField = (fieldName: string | null | undefined): boolean =>
  fieldName?.startsWith('Item: ') ?? false;

/**
 * Dos triggers ejecutados dentro del mismo evento pueden dejar filas idénticas.
 * Sin event_id no se deduplica para no mezclar operaciones legítimas antiguas.
 */
export const serviceChangeIdentity = (change: IdentifiableServiceChange): string => {
  if (!change.eventId) return `legacy:${change.id}`;

  return [
    change.eventId,
    change.serviceId,
    change.changeType,
    change.fieldName,
    change.oldValue,
    change.newValue,
  ].join('|');
};

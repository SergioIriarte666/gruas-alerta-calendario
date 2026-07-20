interface ComparableServiceChange {
  changeType: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
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

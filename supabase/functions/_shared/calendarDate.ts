/** A document date is a calendar value, not a UTC timestamp. */
export function formatDocumentDate(value: string, options: Intl.DateTimeFormatOptions = {}): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError('Expected YYYY-MM-DD');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(12, 0, 0, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError('Invalid document date');
  }
  return date.toLocaleDateString('es-CL', { ...options, timeZone: 'UTC' });
}

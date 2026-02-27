/**
 * Utilities to distinguish Chilean license plates from VINs.
 */

/** Chilean plates: 6 alphanumeric chars (e.g. ABCD12 or AB1234) */
export const isChileanPlate = (value: string): boolean => {
  const clean = value.replace(/[-\s]/g, '').toUpperCase();
  return /^[A-Z0-9]{6}$/.test(clean);
};

/** VIN: exactly 17 alphanumeric characters (no I, O, Q per standard, but we're lenient) */
export const isVIN = (value: string): boolean => {
  const clean = value.replace(/[-\s]/g, '').toUpperCase();
  return /^[A-Z0-9]{17}$/.test(clean);
};

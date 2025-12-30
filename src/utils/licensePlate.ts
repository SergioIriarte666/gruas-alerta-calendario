/**
 * Utility functions for license plate handling
 * Handles plates with or without separators (hyphens, spaces, etc.)
 */

/**
 * Normalizes a license plate by removing all non-alphanumeric characters
 * and converting to uppercase.
 * 
 * Examples:
 * - "TSSX-54" -> "TSSX54"
 * - "tssx 54" -> "TSSX54"
 * - "TSSX.54" -> "TSSX54"
 */
export function normalizeLicensePlate(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Builds a fuzzy ILIKE pattern that matches license plates regardless of separators.
 * Inserts '%' between each character to allow any characters in between.
 * 
 * Examples:
 * - "TSSX54" -> "%T%S%S%X%5%4%"
 * 
 * This pattern will match:
 * - "TSSX54"
 * - "TSSX-54"
 * - "TSSX 54"
 * - "(TSSX-54)"
 * - etc.
 */
export function buildFuzzyLicensePlatePattern(normalizedPlate: string): string {
  if (!normalizedPlate) return '%';
  
  // Insert % between each character and at the start/end
  const chars = normalizedPlate.split('');
  return '%' + chars.join('%') + '%';
}

/**
 * Formats a license plate for display.
 * Attempts to format Chilean-style plates (4 letters + 2 numbers or similar)
 */
export function formatLicensePlateForDisplay(plate: string): string {
  const normalized = normalizeLicensePlate(plate);
  
  // Chilean format: XXXX-00 (4 letters + 2 numbers)
  if (/^[A-Z]{4}\d{2}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
  }
  
  // Old format: XX-0000 or similar
  if (/^[A-Z]{2}\d{4}$/.test(normalized)) {
    return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
  }
  
  // Return as-is if no known format
  return normalized;
}

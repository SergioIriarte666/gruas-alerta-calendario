const FOLIO_PATTERN = /(?:N[º°o]\s*|Folio\s+)(\d{3,})/i;

/**
 * Extracts an invoice folio written in a cost's free-text description.
 * Supports "N° 12345", "Nº 12345", "No 12345", and "Folio 12345".
 */
export function extractFolioFromDescription(description?: string | null): string | null {
  if (!description) return null;
  const match = description.match(FOLIO_PATTERN);
  return match?.[1] ?? null;
}

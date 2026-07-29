const STOPWORDS = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'y']);
const MIN_TOKEN_LENGTH = 3;
// Rango de marcas diacriticas combinables (U+0300-U+036F), construido con
// fromCharCode para evitar literales de ancho combinable en el codigo fuente.
const DIACRITICS_REGEX = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Guard de relevancia para resultados de Places Text Search: ante un origin
 * sin sentido ("xyzz123"), Places casi nunca devuelve cero resultados, sino
 * su mejor adivinanza dentro del locationBias (un POI aleatorio cercano).
 * Para consultas con varios términos exige una mayoría real (mínimo dos):
 * aceptar sólo "custodia" de "Custodia G5N" convirtió una coincidencia débil
 * en un origen público a 30 km del lugar correcto.
 */
export const isRelevantPlaceResult = (
  query: string,
  displayName: string | null | undefined,
  formattedAddress: string | null | undefined,
): boolean => {
  const tokens = normalize(query)
    .split(' ')
    .filter((token) => token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token));

  if (tokens.length === 0) return false;

  const haystack = normalize(`${displayName ?? ''} ${formattedAddress ?? ''}`);
  if (!haystack) return false;

  const matchedTokens = tokens.filter((token) => haystack.includes(token)).length;
  const requiredMatches = tokens.length === 1
    ? 1
    : Math.max(2, Math.ceil(tokens.length * 0.6));

  return matchedTokens >= requiredMatches;
};

const CHILE_REGION_NAMES = new Set([
  'arica y parinacota',
  'tarapaca',
  'antofagasta',
  'atacama',
  'coquimbo',
  'valparaiso',
  'metropolitana de santiago',
  'libertador general bernardo ohiggins',
  'maule',
  'nuble',
  'biobio',
  'la araucania',
  'los rios',
  'los lagos',
  'aysen del general carlos ibanez del campo',
  'magallanes y de la antartica chilena',
]);

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const cleanSegment = (value: string): string =>
  value
    // Google suele anteponer el código postal chileno a la comuna.
    .replace(/\b\d{7}\b/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s-]+|[\s-]+$/g, '')
    .trim();

const isRedundantChileSegment = (segment: string): boolean => {
  const normalized = normalize(segment)
    .replace(/^region (?:de|del) /, '')
    .replace(/^region /, '');

  return normalized === 'chile' || CHILE_REGION_NAMES.has(normalized);
};

const compactParts = (value: string): string[] => {
  const seen = new Set<string>();

  return value
    .split(',')
    .map(cleanSegment)
    .filter(Boolean)
    .filter((segment) => !isRedundantChileSegment(segment))
    .filter((segment) => {
      const key = normalize(segment);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

/**
 * Convierte la respuesta postal de Google a la etiqueta que usa una persona
 * en Chile: nombre del lugar, calle/sector y comuna. Las coordenadas exactas
 * siguen guardándose por separado.
 */
export const formatChileLocationLabel = ({
  mainText,
  secondaryText,
  formattedAddress,
}: {
  mainText?: string | null;
  secondaryText?: string | null;
  formattedAddress?: string | null;
}): string => {
  const main = cleanSegment(mainText ?? '');
  const source = secondaryText?.trim() || formattedAddress?.trim() || '';
  const details = compactParts(source);
  const combined = main ? [main, ...details] : details;
  const seen = new Set<string>();
  const unique = combined.filter((part) => {
    const key = normalize(part);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const compact = unique.slice(0, 3).join(', ');
  return compact || main || cleanSegment(formattedAddress ?? '') || cleanSegment(secondaryText ?? '');
};

export const formatChileAddress = (address: string): string =>
  formatChileLocationLabel({ formattedAddress: address });

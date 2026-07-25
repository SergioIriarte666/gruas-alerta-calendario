/**
 * Acorta una dirección geocodificada para documentos impresos.
 *
 * Google devuelve la cadena completa —"Los Chercanes 95, 2571126 Viña del Mar,
 * Valparaíso, Chile"— que en el acta ocupa dos líneas y aporta ruido: el código
 * postal chileno no se usa y el país es siempre el mismo.
 *
 * Se corta por componentes (no con un regex sobre la cadena entera): se
 * descartan país y códigos postales, y se conservan los dos primeros
 * componentes útiles → "Los Chercanes 95, Viña del Mar".
 *
 * Una dirección escrita a mano ("Taller 5 Norte, atrás del galpón") queda
 * intacta mientras tenga dos componentes o menos.
 */
const COUNTRY_COMPONENTS = new Set(['chile', 'cl']);
const POSTAL_CODE_PREFIX = /^\d{4,7}\s+/;
const ONLY_DIGITS = /^\d+$/;

export const formatShortAddress = (
  address: string | null | undefined,
  maxComponents = 2,
): string => {
  const raw = (address ?? '').trim();
  if (!raw) return '';

  const components = raw
    .split(',')
    .map((part) => part.trim().replace(POSTAL_CODE_PREFIX, '').trim())
    .filter((part) => part.length > 0)
    .filter((part) => !ONLY_DIGITS.test(part))
    .filter((part) => !COUNTRY_COMPONENTS.has(part.toLowerCase()));

  if (components.length === 0) return raw;

  return components.slice(0, maxComponents).join(', ');
};

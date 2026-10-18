import type { XMLDocumentItem } from '@/types/suppliers';
import { isPlaceholderCode, normalizeCode, normalizeText } from './xmlInventoryHelpers';

interface CatalogIdentity {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
}

export const isNearbyProductCode = (input: string, stored: string): boolean => {
  const first = normalizeCode(input);
  const second = normalizeCode(stored);
  if (first.length < 6 || second.length < 6 || Math.abs(first.length - second.length) > 1) return false;
  if (first === second) return false;
  const shorter = first.length <= second.length ? first : second;
  const longer = first.length <= second.length ? second : first;
  let shorterIndex = 0;
  let longerIndex = 0;
  let differences = 0;
  while (shorterIndex < shorter.length && longerIndex < longer.length) {
    if (shorter[shorterIndex] === longer[longerIndex]) {
      shorterIndex++;
      longerIndex++;
    } else {
      differences++;
      if (differences > 1) return false;
      if (shorter.length === longer.length) shorterIndex++;
      longerIndex++;
    }
  }
  return differences + longer.length - longerIndex <= 1;
};

export function matchInventoryCatalog<Item extends CatalogIdentity>(line: XMLDocumentItem, catalog: Item[]): { match: Item | null; candidates: Item[] } {
  const codes = [
    !isPlaceholderCode(line.product_code) ? normalizeCode(line.product_code) : '',
    normalizeCode(line.product_name),
    normalizeCode(line.description),
  ].filter(Boolean);
  for (const code of codes) {
    const matches = catalog.filter(item =>
      (!isPlaceholderCode(item.sku) && normalizeCode(item.sku) === code) ||
      (!isPlaceholderCode(item.barcode) && normalizeCode(item.barcode) === code) ||
      normalizeCode(item.name) === code
    );
    if (matches.length) return { match: matches.length === 1 ? matches[0] : null, candidates: matches.length === 1 ? [] : matches };
  }
  const description = normalizeText(line.description);
  const exactNames = description ? catalog.filter(item => normalizeText(item.name) === description) : [];
  if (exactNames.length) return { match: exactNames.length === 1 ? exactNames[0] : null, candidates: exactNames.length === 1 ? [] : exactNames };
  const nearbyCodes = !isPlaceholderCode(line.product_code)
    ? catalog.filter(item => [item.sku, item.barcode].some(code => !isPlaceholderCode(code) && isNearbyProductCode(line.product_code || '', code || '')))
    : [];
  const partialNames = catalog.filter(item => {
    const name = normalizeText(item.name);
    return description.length >= 6 && name.length >= 6 && (name.includes(description) || description.includes(name));
  });
  if (nearbyCodes.length) return { match: null, candidates: [...new Map([...nearbyCodes, ...partialNames].map(item => [item.id, item])).values()] };
  return { match: partialNames.length === 1 ? partialNames[0] : null, candidates: partialNames.length === 1 ? [] : partialNames };
}

import type { XMLDocumentData } from '@/types/suppliers';
import type { ClassifiedXmlCostItem } from '@/services/xmlCostInvoiceSync';
import { getDocumentStateKey } from './xmlGlosaHelpers';

export function classifySelectedCostItems(
  document: XMLDocumentData,
  selected: Set<number>,
  assignments: Record<string, string>,
  subcategories: { id: string; name: string; category_id: string }[],
  categoryId: string,
): ClassifiedXmlCostItem[] {
  return (document.items || []).flatMap((item, index) => {
    if (!selected.has(index)) return [];
    const assignment = assignments[`${getDocumentStateKey(document)}:${index}`];
    const subcategory = subcategories.find(option => option.id === assignment && option.category_id === categoryId);
    return [{ ...item, cost_subcategory_id: subcategory?.id || null, cost_subcategory: subcategory?.name || '' }];
  });
}

export function getConsolidatedCostSubcategory(items: ClassifiedXmlCostItem[]) {
  const names = new Set(items.map(item => item.cost_subcategory || ''));
  return names.size === 1 ? [...names][0] || null : null;
}

export function resolveXmlCostPaymentDate(isPaid: boolean, paidDate: string, today: string) {
  return isPaid ? paidDate || today : null;
}

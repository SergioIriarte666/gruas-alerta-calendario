import type { XMLCompleteParseResult, XMLDocumentItem } from '@/types/suppliers';
import { isImportDateValid } from '@/utils/xml/xmlInventoryWizard';

export interface ManualPurchaseLine {
  id: string;
  code: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

export interface ManualPurchaseDraft {
  supplierName: string;
  supplierRut: string;
  folio: string;
  issueDate: string;
  dueDate: string;
  net: string;
  vat: string;
  total: string;
  lines: ManualPurchaseLine[];
}

export const emptyPurchaseLine = (): ManualPurchaseLine => ({ id: crypto.randomUUID(), code: '', description: '', quantity: '1', unitPrice: '', taxRate: '19' });
export const emptyManualPurchase = (): ManualPurchaseDraft => ({ supplierName: '', supplierRut: '', folio: '', issueDate: '', dueDate: '', net: '', vat: '', total: '', lines: [emptyPurchaseLine()] });

export function normalizePurchaseRut(value: string) {
  const raw = value.replace(/[^0-9kK]/g, '').toUpperCase();
  return raw.length > 1 ? `${raw.slice(0, -1)}-${raw.slice(-1)}` : raw;
}

export function isPurchaseRutValid(value: string) {
  const rut = normalizePurchaseRut(value);
  if (!/^\d{7,8}-[0-9K]$/.test(rut)) return false;
  const [body, digit] = rut.split('-');
  let sum = 0;
  [...body].reverse().forEach((character, index) => { sum += Number(character) * (2 + index % 6); });
  const remainder = 11 - sum % 11;
  return digit === (remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder));
}

export function manualPurchaseItems(draft: ManualPurchaseDraft): XMLDocumentItem[] {
  return draft.lines.map(line => {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    const subtotal = Math.round(quantity * unitPrice * 100) / 100;
    const taxRate = Number(line.taxRate);
    const taxAmount = subtotal * taxRate / 100;
    return { product_code: line.code.trim(), description: line.description.trim(), quantity, unit_price: unitPrice, subtotal, tax_rate: taxRate, tax_amount: taxAmount, total: subtotal + taxAmount };
  });
}

export function manualPurchaseTotals(draft: ManualPurchaseDraft) {
  const items = manualPurchaseItems(draft);
  const net = Math.round(items.reduce((sum, item) => sum + (item.subtotal || 0), 0));
  const vat = Math.round(items.reduce((sum, item) => sum + (item.tax_amount || 0), 0));
  return { net, vat, total: net + vat };
}

export function validateManualPurchase(draft: ManualPurchaseDraft): string | null {
  if (!draft.supplierName.trim()) return 'Indica el nombre del proveedor.';
  if (!isPurchaseRutValid(draft.supplierRut)) return 'Revisa el RUT del proveedor y su dígito verificador.';
  if (!/^\d{1,20}$/.test(draft.folio.trim()) || /^0+$/.test(draft.folio.trim())) return 'Indica un folio numérico válido.';
  if (!isImportDateValid(draft.issueDate)) return 'Indica una fecha de emisión válida.';
  if (draft.dueDate && (!isImportDateValid(draft.dueDate) || draft.dueDate < draft.issueDate)) return 'El vencimiento no puede ser anterior a la emisión.';
  if (!draft.lines.length || draft.lines.length > 100) return 'Ingresa entre 1 y 100 productos.';
  for (const [index, line] of draft.lines.entries()) {
    if (!line.description.trim()) return `Producto ${index + 1}: falta la descripción.`;
    if (!Number.isSafeInteger(Number(line.quantity)) || Number(line.quantity) <= 0 || Number(line.quantity) > 2147483647) return `Producto ${index + 1}: la cantidad debe ser un entero mayor a cero dentro del rango permitido.`;
    if (!line.unitPrice.trim() || !Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) < 0) return `Producto ${index + 1}: revisa el precio unitario neto.`;
    if (!['0', '19'].includes(line.taxRate)) return `Producto ${index + 1}: selecciona IVA 19% o exento.`;
  }
  if ([draft.net, draft.vat, draft.total].some(value => !value.trim() || !Number.isFinite(Number(value)) || Number(value) < 0) || Number(draft.total) <= 0) return 'Completa neto, IVA y total con los importes del comprobante.';
  const calculated = manualPurchaseTotals(draft);
  if (Math.abs(calculated.net - Number(draft.net)) > 1 || Math.abs(calculated.vat - Number(draft.vat)) > 1 || Math.abs(Number(draft.net) + Number(draft.vat) - Number(draft.total)) > 1) return 'Los productos, el IVA y el total no cuadran. Revisa los precios netos y el comprobante.';
  return null;
}

export function buildManualPurchaseResult(draft: ManualPurchaseDraft): XMLCompleteParseResult {
  const error = validateManualPurchase(draft);
  if (error) throw new Error(error);
  const rut = normalizePurchaseRut(draft.supplierRut);
  return { success: true, errors: [], warnings: [], totalSuppliers: 1, validSuppliers: 1, totalDocuments: 1, validDocuments: 1,
    suppliers: [{ name: draft.supplierName.trim(), rut, email: '', phone: '', address: '', contact_name: '', category: 'otros', is_active: true }],
    documents: [{ folio: draft.folio.trim(), supplier_rut: rut, document_type: 'Factura', issue_date: draft.issueDate, due_date: draft.dueDate || draft.issueDate,
      net_amount: Number(draft.net), vat_amount: Number(draft.vat), total_amount: Number(draft.total), currency: 'CLP',
      description: draft.supplierName.trim(), items: manualPurchaseItems(draft) }],
  };
}

const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? String(value) : '';

export function draftFromReceiptExtraction(value: unknown): ManualPurchaseDraft {
  const receipt = record(value);
  const totals = record(receipt.totals);
  const items = Array.isArray(receipt.items) ? receipt.items.slice(0, 100).map(record) : [];
  const lineSum = items.reduce((sum, item) => sum + (Number(item.total) || Number(item.unitPrice) * Number(item.quantity) || 0), 0);
  const grossPrices = Number(totals.iva) > 0 && Math.abs(lineSum - Number(totals.total)) <= 2 && Math.abs(lineSum - Number(totals.neto)) > 2;
  return {
    supplierName: text(receipt.vendorName), supplierRut: normalizePurchaseRut(text(receipt.vendorRut)), folio: text(receipt.documentNumber),
    issueDate: isImportDateValid(text(receipt.date)) ? text(receipt.date) : '', dueDate: '', net: amount(totals.neto), vat: amount(totals.iva), total: amount(totals.total),
    lines: items.length ? items.map(item => ({ id: crypto.randomUUID(), code: '', description: text(item.description),
      quantity: amount(item.quantity), unitPrice: grossPrices && typeof item.unitPrice === 'number' ? String(Math.round(item.unitPrice / 1.19 * 100) / 100) : amount(item.unitPrice),
      taxRate: totals.iva === 0 ? '0' : '19',
    })) : [emptyPurchaseLine()],
  };
}

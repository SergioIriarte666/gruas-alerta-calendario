import { isCalendarDate } from '@/utils/calendarDate';

export interface IssuedInvoiceFields {
  documentType: string;
  issuerRut: string;
  clientRut: string;
  fiscalNumber: string;
  purchaseOrder: string;
  issueDate: string;
  dueDate: string;
  net: number;
  vat: number;
  total: number;
  description: string;
}
export interface InvoiceCandidate {
  key: string;
  serviceId: string;
  clientId?: string;
  folio: string;
  date: string;
  purchaseOrder: string;
  valueType: 'covered' | 'excess';
  amount: number;
  blocked: string | null;
  closureId: string | null;
  closureFolio: string | null;
}
export interface IssuedInvoiceDraft {
  fields: IssuedInvoiceFields;
  selectedKeys: string[];
  reviewed: boolean;
  manualReason: string;
  dueDateDefaulted?: boolean;
}
export interface ImportedInvoiceResult {
  invoiceId: string;
  invoiceFolio: string;
  closureFolios: string[];
}
export interface IssuedInvoiceDocument {
  id: string;
  file_name: string;
  file_hash: string;
  storage_path: string;
  draft: IssuedInvoiceDraft;
  result: ImportedInvoiceResult | null;
  created_at: string;
}
export const normalizeInvoiceRut = (value: string) =>
  value.toUpperCase().replace(/[.\s-]/g, '');
// Preserve internal separators and significant zeros. Avoid conflating different OCs.
export const normalizeInvoiceOC = (value: string) =>
  value
    .toUpperCase()
    .trim()
    .replace(
      /^(?:O\.?C\.?|ORDEN\s+DE\s+COMPRA)(?=[\s:#0-9-]|$)\s*[:#-]?\s*/,
      '',
    )
    .replace(/\s/g, '');
export function invoiceFieldErrors(f: IssuedInvoiceFields): string[] {
  const errors: string[] = [];
  if (!['33', '34'].includes(f.documentType))
    errors.push('Confirma el tipo: factura electrónica (33) o exenta (34).');
  if (!/^\d{7,8}[0-9K]$/.test(normalizeInvoiceRut(f.issuerRut)))
    errors.push('Revisa el RUT emisor.');
  if (!/^\d{7,8}[0-9K]$/.test(normalizeInvoiceRut(f.clientRut)))
    errors.push('Revisa el RUT receptor.');
  if (!/^\d+$/.test(f.fiscalNumber) || /^0+$/.test(f.fiscalNumber))
    errors.push('Confirma el folio fiscal del contenido del PDF.');
  if (
    !isCalendarDate(f.issueDate) ||
    !isCalendarDate(f.dueDate) ||
    f.dueDate < f.issueDate
  )
    errors.push('Completa emisión y vencimiento válidos.');
  if (
    ![f.net, f.vat, f.total].every((v) => Number.isSafeInteger(v) && v >= 0) ||
    f.net <= 0 ||
    f.net + f.vat !== f.total
  )
    errors.push(
      'Neto/base + IVA debe coincidir exactamente con el total, en pesos.',
    );
  if (f.documentType === '34' && f.vat !== 0)
    errors.push('Una factura exenta debe tener IVA cero.');
  if (f.description.trim().length < 10 || f.description.length > 500)
    errors.push('Descripción: entre 10 y 500 caracteres.');
  return errors;
}
const unique = (values: string[]) => [...new Set(values)];
function singleMatch(text: string, expression: RegExp) {
  const found = unique([...text.matchAll(expression)].map((m) => m[1].trim()));
  return found.length === 1 ? found[0] : '';
}
function dateValue(value: string) {
  let m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) {
    const written = value.match(
      /^(\d{1,2})\s+(?:DE\s+)?([A-Z]+)\s+(?:DEL?\s+)?(\d{4})$/,
    );
    const months = [
      'ENERO',
      'FEBRERO',
      'MARZO',
      'ABRIL',
      'MAYO',
      'JUNIO',
      'JULIO',
      'AGOSTO',
      'SEPTIEMBRE',
      'OCTUBRE',
      'NOVIEMBRE',
      'DICIEMBRE',
    ];
    if (written && months.includes(written[2]))
      m = [
        written[0],
        written[1],
        String(months.indexOf(written[2]) + 1),
        written[3],
      ] as RegExpMatchArray;
  }
  if (!m) return '';
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return isCalendarDate(iso) ? iso : '';
}
// Same 30-day default used by the individual invoice form, relative to the
// invoice's original issue date. Keep its provenance visible in the proposal.
export function prepareIssuedInvoiceDraft(
  draft: IssuedInvoiceDraft,
  candidates: InvoiceCandidate[],
): IssuedInvoiceDraft {
  const fields = { ...draft.fields };
  let dueDateDefaulted = draft.dueDateDefaulted;
  if (!fields.dueDate && isCalendarDate(fields.issueDate)) {
    const date = new Date(`${fields.issueDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 30);
    fields.dueDate = date.toISOString().slice(0, 10);
    dueDateDefaulted = true;
  }
  if (!fields.description && fields.fiscalNumber && fields.purchaseOrder)
    fields.description = `Factura SII ${fields.fiscalNumber} · OC ${normalizeInvoiceOC(fields.purchaseOrder)}`;
  return {
    ...draft,
    fields,
    ...(dueDateDefaulted ? { dueDateDefaulted } : {}),
    selectedKeys: draft.selectedKeys.length
      ? draft.selectedKeys
      : suggestedInvoiceKeys(fields, candidates),
  };
}
// Conservative extraction: ambiguous/missing fields stay empty for explicit review.
// Never infer a fiscal number from a filename or assign a client from an unlabeled RUT.
export function parseIssuedInvoiceText(text: string): IssuedInvoiceFields {
  const t = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  const amount = (label: string) => {
    const raw = singleMatch(
      t,
      new RegExp(
        `(?:^|\\n)\\s*(?:${label})\\s*:?\\s*\\$?\\s*([\\d.]+)(?=\\s|$)`,
        'g',
      ),
    );
    return raw ? Number(raw.replace(/\./g, '')) : NaN;
  };
  const type = /NOTA\s+DE\s+(?:CREDITO|DEBITO)/.test(t)
    ? ''
    : /FACTURA[^\n]*EXENTA/.test(t)
      ? '34'
      : /FACTURA\s+ELECTRONICA/.test(t)
        ? '33'
        : '';
  const rutPattern = '(\\d{1,2}\\.?\\d{3}\\.?\\d{3}-[0-9K])';
  let issuer = singleMatch(
    t,
    new RegExp(`R\\.?U\\.?T\\.?\\s*(?:EMISOR)?\\s*:?\\s*${rutPattern}`, 'g'),
  );
  let receptor = singleMatch(
    t,
    new RegExp(
      `(?:R\\.?U\\.?T\\.?\\s*(?:RECEPTOR|CLIENTE)|(?:RECEPTOR|CLIENTE)\\s+R\\.?U\\.?T\\.?)\\s*:?\\s*${rutPattern}`,
      'g',
    ),
  );
  // Standard SII documents label the recipient block SEÑOR(ES), then use
  // an unqualified RUT. Keep roles contextual instead of taking the first RUT.
  if (!receptor) {
    const recipientBlock =
      t.match(
        /SENOR(?:\(ES\)|ES)?\s*:?([\s\S]*?)(?=\n\s*(?:GIRO|DIRECCION|COMUNA|CIUDAD)\b|$)/,
      )?.[1] || '';
    receptor = singleMatch(
      recipientBlock,
      new RegExp(`R\\.?U\\.?T\\.?\\s*:?\\s*${rutPattern}`, 'g'),
    );
  }
  if (!issuer && receptor) {
    const ruts = unique(
      [
        ...t.matchAll(
          new RegExp(
            `R\\.?U\\.?T\\.?\\s*(?:EMISOR|RECEPTOR|CLIENTE)?\\s*:?\\s*${rutPattern}`,
            'g',
          ),
        ),
      ]
        .map((m) => normalizeInvoiceRut(m[1]))
        .filter((r) => r !== normalizeInvoiceRut(receptor)),
    );
    if (ruts.length === 1) issuer = ruts[0];
  }
  const vat = amount(
    '(?:19\\s*%\\s*)?(?:MONTO\\s+)?I\\.?V\\.?A\\.?(?:\\s*19\\s*%)?',
  );
  // Fiscal box and city/date header can be interleaved with the issuer's
  // contact column. Only inspect the header, before recipient/references.
  const header = t.split(/SENOR(?:\(ES\)|ES)?\s*:/)[0];
  return {
    documentType: type,
    issuerRut: issuer,
    clientRut: receptor,
    fiscalNumber:
      singleMatch(
        t,
        /(?:FACTURA(?:\s+NO\s+AFECTA\s+O)?(?:\s+EXENTA)?\s+ELECTRONICA\s*\n?\s*(?:N[°ºO.]|NUMERO|FOLIO)\s*[:.]?\s*|FOLIO\s*:\s*)(\d+)/g,
      ) ||
      (type ? singleMatch(header, /(?:^|\s)N[°º]\s*:?\s*(\d+)(?=\s|$)/g) : ''),
    purchaseOrder: singleMatch(
      t,
      /(?:ORDEN\s+DE\s+COMPRA|\bO\.?C\.?)(?=[\s:#0-9-]|$)\s*[:#-]?\s*(?:(?:NRO\.?|NUMERO|N[°ºO.])\s*[:#-]?\s*)?([A-Z0-9][A-Z0-9/-]*)/g,
    ),
    issueDate: dateValue(
      singleMatch(
        t,
        /(?:FECHA\s+(?:DE\s+)?EMISION)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}\s+(?:DE\s+)?[A-Z]+\s+(?:DEL?\s+)?\d{4})/g,
      ) ||
        singleMatch(
          header,
          /(?:^|\n)[A-Z][A-Z .'-]+,\s*(\d{1,2}\s+DE\s+[A-Z]+\s+DE(?:L)?\s+\d{4})(?=\s|$)/g,
        ),
    ),
    dueDate: dateValue(
      singleMatch(
        t,
        /(?:FECHA\s+(?:DE\s+)?)?VENCIMIENTO\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}\s+(?:DE\s+)?[A-Z]+\s+(?:DEL?\s+)?\d{4})/g,
      ),
    ),
    net: amount(type === '34' ? '(?:MONTO\\s+)?EXENTO' : '(?:MONTO\\s+)?NETO'),
    vat: type === '34' && Number.isNaN(vat) ? 0 : vat,
    total: amount('(?:MONTO\\s+)?TOTAL'),
    description: '',
  };
}
export function suggestedInvoiceKeys(
  fields: IssuedInvoiceFields,
  candidates: InvoiceCandidate[],
): string[] {
  const oc = normalizeInvoiceOC(fields.purchaseOrder);
  if (!oc) return [];
  const matches = candidates.filter(
    (c) => !c.blocked && normalizeInvoiceOC(c.purchaseOrder) === oc,
  );
  return matches.length &&
    matches.reduce((sum, c) => sum + c.amount, 0) === fields.net
    ? matches.map((c) => c.key)
    : [];
}
export function reconciliationErrors(
  draft: IssuedInvoiceDraft,
  candidates: InvoiceCandidate[],
) {
  const errors = invoiceFieldErrors(draft.fields);
  const rows = candidates.filter((c) => draft.selectedKeys.includes(c.key));
  if (
    !rows.length ||
    rows.length !== draft.selectedKeys.length ||
    new Set(draft.selectedKeys).size !== draft.selectedKeys.length
  )
    errors.push('Selecciona servicios disponibles.');
  if (new Set(rows.map((c) => c.clientId).filter(Boolean)).size > 1)
    errors.push(
      'Los servicios pertenecen a distintas fichas de cliente. Selecciona los de una misma ficha.',
    );
  if (rows.some((c) => c.blocked)) errors.push('Hay servicios bloqueados.');
  if (rows.reduce((s, c) => s + c.amount, 0) !== draft.fields.net)
    errors.push('El neto/base de los servicios no coincide con el PDF.');
  const oc = normalizeInvoiceOC(draft.fields.purchaseOrder);
  if (
    (!oc || rows.some((c) => normalizeInvoiceOC(c.purchaseOrder) !== oc)) &&
    draft.manualReason.trim().length < 10
  )
    errors.push(
      'OC ausente o distinta: documenta el motivo de la asignación manual (mínimo 10 caracteres).',
    );
  if (!draft.reviewed)
    errors.push('Confirma la revisión del PDF y de sus servicios.');
  return errors;
}

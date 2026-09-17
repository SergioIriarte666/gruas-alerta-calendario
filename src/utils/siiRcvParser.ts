import { createLogger } from '@/lib/logger';
import { normalizeRut } from '@/utils/rutFormatter';

const logger = createLogger('SiiRcvParser');

export type SiiBookType = 'compra' | 'venta';

export type ParsedRcvRow = {
  doc_type: number;
  folio: number;
  counterpart_rut: string;
  counterpart_name: string;
  doc_date: string | null;
  net_amount: number;
  exempt_amount: number;
  tax_amount: number;
  total_amount: number;
  ref_doc_type: number | null;
  ref_folio: number | null;
  _rowIndex: number;
  _invalid: boolean;
  _invalidReason: string | null;
};

export type ParseSiiRcvResult = {
  bookType: SiiBookType | null;
  rows: ParsedRcvRow[];
  errors: string[];
};

const stripAccents = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeHeader = (value: string): string =>
  stripAccents(value.replace(/^\uFEFF/, '').trim().toLowerCase()).replace(/\s+/g, ' ');

const HEADER_ALIASES: Record<string, string[]> = {
  doc_type: ['tipo doc', 'tipo dte', 'tipo documento'],
  folio: ['folio'],
  counterpart_rut_compra: ['rut proveedor'],
  counterpart_rut_venta: ['rut cliente'],
  counterpart_name: ['razon social'],
  doc_date: ['fecha docto', 'fecha documento'],
  net_amount: ['monto neto'],
  exempt_amount: ['monto exento'],
  tax_amount_primary: ['monto iva recuperable'],
  tax_amount_fallback: ['monto iva', 'monto iva no recuperable'],
  total_amount: ['monto total'],
  // Columnas de referencia (notas de crédito/débito). Opcionales: el CSV de
  // compras por-tipo no siempre las trae.
  ref_doc_type: ['tipo docto. referencia', 'tipo docto referencia', 'tipo doc. referencia', 'tipo doc referencia'],
  ref_folio: ['folio docto. referencia', 'folio docto referencia', 'folio doc. referencia', 'folio doc referencia'],
};

const findColumnIndex = (headers: string[], aliases: string[]): number =>
  headers.findIndex((header) => aliases.includes(header));

const decodeFile = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const utf8Text = new TextDecoder('utf-8').decode(buffer);
  if (!utf8Text.includes('�')) return utf8Text;
  logger.info('Encoding UTF-8 inválido detectado, releyendo como ISO-8859-1');
  return new TextDecoder('iso-8859-1').decode(buffer);
};

const splitCsvLine = (line: string): string[] => {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ';' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((field) => field.trim());
};

const parseCsvRows = (text: string): string[][] =>
  text
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim() !== '')
    .map(splitCsvLine);

const parseAmount = (raw: string | undefined): number => {
  const cleaned = (raw ?? '').trim();
  if (!cleaned) return 0;
  const numeric = cleaned.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(numeric);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
};

const isValidCalendarDate = (year: number, month: number, day: number): boolean => {
  const candidate = new Date(Date.UTC(year, month - 1, day, 12));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
};

/** Parsea DD/MM/YYYY o DD-MM-YYYY a YYYY-MM-DD sin usar new Date() con strings ambiguos. */
const parseSiiDate = (raw: string | undefined): string | null => {
  const cleaned = (raw ?? '').trim();
  const match = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const [, dayRaw, monthRaw, yearRaw] = match;
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  if (!isValidCalendarDate(year, month, day)) return null;
  return `${yearRaw}-${monthRaw.padStart(2, '0')}-${dayRaw.padStart(2, '0')}`;
};

export async function parseSiiRcvCsv(file: File): Promise<ParseSiiRcvResult> {
  const text = await decodeFile(file);
  const rawRows = parseCsvRows(text);
  if (rawRows.length < 2) {
    return { bookType: null, rows: [], errors: ['El archivo no tiene filas de datos.'] };
  }

  const headers = rawRows[0].map(normalizeHeader);
  const errors: string[] = [];

  const compraRutIndex = findColumnIndex(headers, HEADER_ALIASES.counterpart_rut_compra);
  const ventaRutIndex = findColumnIndex(headers, HEADER_ALIASES.counterpart_rut_venta);
  const bookType: SiiBookType | null = compraRutIndex !== -1 ? 'compra' : ventaRutIndex !== -1 ? 'venta' : null;
  const counterpartRutIndex = bookType === 'compra' ? compraRutIndex : ventaRutIndex;

  const docTypeIndex = findColumnIndex(headers, HEADER_ALIASES.doc_type);
  const folioIndex = findColumnIndex(headers, HEADER_ALIASES.folio);
  const counterpartNameIndex = findColumnIndex(headers, HEADER_ALIASES.counterpart_name);
  const docDateIndex = findColumnIndex(headers, HEADER_ALIASES.doc_date);
  const netAmountIndex = findColumnIndex(headers, HEADER_ALIASES.net_amount);
  const exemptAmountIndex = findColumnIndex(headers, HEADER_ALIASES.exempt_amount);
  const taxAmountPrimaryIndex = findColumnIndex(headers, HEADER_ALIASES.tax_amount_primary);
  const taxAmountFallbackIndex = findColumnIndex(headers, HEADER_ALIASES.tax_amount_fallback);
  const totalAmountIndex = findColumnIndex(headers, HEADER_ALIASES.total_amount);
  const refDocTypeIndex = findColumnIndex(headers, HEADER_ALIASES.ref_doc_type);
  const refFolioIndex = findColumnIndex(headers, HEADER_ALIASES.ref_folio);

  if (docTypeIndex === -1) errors.push('No se encontró la columna "Tipo Doc".');
  if (folioIndex === -1) errors.push('No se encontró la columna "Folio".');
  if (counterpartRutIndex === -1) errors.push('No se encontró la columna de RUT de contraparte ("RUT Proveedor" o "Rut cliente").');
  if (docDateIndex === -1) errors.push('No se encontró la columna "Fecha Docto".');
  if (totalAmountIndex === -1) errors.push('No se encontró la columna "Monto total".');

  if (errors.length > 0) {
    return { bookType, rows: [], errors };
  }

  const rows: ParsedRcvRow[] = rawRows.slice(1).map((cells, index) => {
    const rowIndex = index + 2;
    const docType = Number.parseInt((cells[docTypeIndex] ?? '').trim(), 10);
    const folio = Number.parseInt((cells[folioIndex] ?? '').trim(), 10);
    const docDate = parseSiiDate(cells[docDateIndex]);
    const counterpartRut = normalizeRut(cells[counterpartRutIndex] ?? '');

    const invalidReasons: string[] = [];
    if (!Number.isFinite(docType)) invalidReasons.push('Tipo Doc inválido');
    if (!Number.isFinite(folio)) invalidReasons.push('Folio inválido');
    if (!docDate) invalidReasons.push('Fecha Docto inválida');
    if (!counterpartRut) invalidReasons.push('RUT de contraparte vacío');

    const taxAmount = taxAmountPrimaryIndex !== -1
      ? parseAmount(cells[taxAmountPrimaryIndex])
      : parseAmount(cells[taxAmountFallbackIndex]);

    const refDocType = refDocTypeIndex !== -1
      ? Number.parseInt((cells[refDocTypeIndex] ?? '').trim(), 10)
      : Number.NaN;
    const refFolio = refFolioIndex !== -1
      ? Number.parseInt((cells[refFolioIndex] ?? '').trim(), 10)
      : Number.NaN;

    return {
      doc_type: Number.isFinite(docType) ? docType : 0,
      folio: Number.isFinite(folio) ? folio : 0,
      counterpart_rut: counterpartRut,
      counterpart_name: (cells[counterpartNameIndex] ?? '').trim(),
      doc_date: docDate,
      net_amount: netAmountIndex !== -1 ? parseAmount(cells[netAmountIndex]) : 0,
      exempt_amount: exemptAmountIndex !== -1 ? parseAmount(cells[exemptAmountIndex]) : 0,
      tax_amount: taxAmount,
      total_amount: parseAmount(cells[totalAmountIndex]),
      ref_doc_type: Number.isFinite(refDocType) ? refDocType : null,
      ref_folio: Number.isFinite(refFolio) && refFolio > 0 ? refFolio : null,
      _rowIndex: rowIndex,
      _invalid: invalidReasons.length > 0,
      _invalidReason: invalidReasons.length > 0 ? invalidReasons.join(', ') : null,
    };
  });

  return { bookType, rows, errors: [] };
}

/** Hash de dedupe SHA-256 (Web Crypto) sobre los campos identificadores del registro. */
export async function computeRcvContentHash(params: {
  entityRut: string;
  bookType: SiiBookType;
  docType: number;
  folio: number;
  counterpartRut: string;
  totalAmount: number;
}): Promise<string> {
  const raw = [
    params.entityRut,
    params.bookType,
    params.docType,
    params.folio,
    params.counterpartRut,
    params.totalAmount,
  ].join('|');
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

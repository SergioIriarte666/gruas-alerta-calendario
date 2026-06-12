import * as XLSX from 'xlsx';
import { loadPdfJsCompat, pdfJsWorkerSrc } from '@/utils/loadPdfJsCompat';

type RawPayloadValue = string | number | boolean | null;

export interface ParsedBankStatementMovement {
  rowIndex: number;
  transactionDate: string;
  postedDate: string | null;
  amount: number;
  currency: string;
  description: string;
  referenceId: string | null;
  payerName: string | null;
  rawPayload: Record<string, RawPayloadValue>;
}

export interface ParsedBankStatementFile {
  bankName: string | null;
  fileType: 'pdf' | 'xls' | 'xlsx';
  parserName: string;
  movements: ParsedBankStatementMovement[];
  summary: {
    totalRows: number;
    parsedMovements: number;
    positiveMovements: number;
    negativeMovements: number;
  };
}

const HEADER_SCAN_LIMIT = 20;

const removeDiacritics = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeHeader = (value: unknown) =>
  removeDiacritics(String(value ?? ''))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const normalizeTextValue = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

const parseAmount = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (value == null) return 0;

  const raw = String(value).trim();
  if (!raw) return 0;

  const parenthesized = raw.match(/^\((.+)\)$/);
  if (parenthesized) {
    return -Math.abs(parseAmount(parenthesized[1]));
  }

  const cleaned = raw
    .replace(/\s+/g, '')
    .replace(/\$/g, '')
    .replace(/CLP/gi, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDatePart = (value: number) => String(value).padStart(2, '0');

const parseDate = (value: unknown): string | null => {
  if (value == null || value === '') return null;

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${formatDatePart(parsed.m)}-${formatDatePart(parsed.d)}`;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parts = raw.split(/[-/.]/).map((part) => part.trim());
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const [year, month, day] = parts;
      return `${year}-${formatDatePart(Number(month))}-${formatDatePart(Number(day))}`;
    }

    const [day, month, year] = parts;
    const normalizedYear =
      year.length === 2 ? `${Number(year) <= 50 ? '20' : '19'}${year}` : year;
    return `${normalizedYear}-${formatDatePart(Number(month))}-${formatDatePart(Number(day))}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return `${parsed.getFullYear()}-${formatDatePart(parsed.getMonth() + 1)}-${formatDatePart(parsed.getDate())}`;
};

const hasAnyKeyword = (header: string, keywords: string[]) =>
  keywords.some((keyword) => header.includes(keyword));

const dateKeywords = ['fecha', 'transaction date', 'posting date', 'fec mov', 'fec'];
const descriptionKeywords = ['descripcion', 'detalle', 'glosa', 'concepto', 'movimiento', 'narrativa'];
const referenceKeywords = ['referencia', 'ref', 'operacion', 'documento', 'comprobante', 'transaccion', 'id'];
const payerKeywords = ['ordenante', 'nombre', 'origen', 'cliente', 'beneficiario', 'razon social'];
const amountKeywords = ['monto', 'importe', 'amount'];
const creditKeywords = ['abono', 'deposito', 'credito', 'haber', 'ingreso'];
const debitKeywords = ['cargo', 'debito', 'debe', 'egreso'];
const currencyKeywords = ['moneda', 'currency'];

interface HeaderMap {
  headerRowIndex: number;
  columns: {
    transactionDate?: number;
    postedDate?: number;
    description?: number;
    referenceId?: number;
    payerName?: number;
    amount?: number;
    credit?: number;
    debit?: number;
    currency?: number;
  };
  headers: string[];
}

const scoreHeaderRow = (row: unknown[]): number => {
  const normalized = row.map(normalizeHeader);
  let score = 0;

  if (normalized.some((header) => hasAnyKeyword(header, dateKeywords))) score += 3;
  if (normalized.some((header) => hasAnyKeyword(header, descriptionKeywords))) score += 3;
  if (
    normalized.some((header) => hasAnyKeyword(header, amountKeywords)) ||
    normalized.some((header) => hasAnyKeyword(header, creditKeywords)) ||
    normalized.some((header) => hasAnyKeyword(header, debitKeywords))
  ) {
    score += 4;
  }

  return score;
};

const detectHeaderMap = (rows: unknown[][]): HeaderMap | null => {
  let bestMatch: HeaderMap | null = null;
  let bestScore = 0;

  for (let index = 0; index < Math.min(rows.length, HEADER_SCAN_LIMIT); index += 1) {
    const row = rows[index];
    if (!Array.isArray(row) || row.length === 0) continue;

    const score = scoreHeaderRow(row);
    if (score < 7 || score < bestScore) continue;

    const headers = row.map(normalizeHeader);
    const columns: HeaderMap['columns'] = {};

    headers.forEach((header, columnIndex) => {
      if (!header) return;

      if (!columns.transactionDate && hasAnyKeyword(header, dateKeywords)) {
        if (header.includes('contable') || header.includes('valor')) {
          columns.postedDate = columnIndex;
        } else {
          columns.transactionDate = columnIndex;
        }
      }

      if (!columns.postedDate && (header.includes('fecha contable') || header.includes('fecha valor'))) {
        columns.postedDate = columnIndex;
      }

      if (!columns.description && hasAnyKeyword(header, descriptionKeywords)) {
        columns.description = columnIndex;
      }

      if (!columns.referenceId && hasAnyKeyword(header, referenceKeywords)) {
        columns.referenceId = columnIndex;
      }

      if (!columns.payerName && hasAnyKeyword(header, payerKeywords)) {
        columns.payerName = columnIndex;
      }

      if (!columns.credit && hasAnyKeyword(header, creditKeywords)) {
        columns.credit = columnIndex;
      }

      if (!columns.debit && hasAnyKeyword(header, debitKeywords)) {
        columns.debit = columnIndex;
      }

      if (!columns.amount && hasAnyKeyword(header, amountKeywords)) {
        columns.amount = columnIndex;
      }

      if (!columns.currency && hasAnyKeyword(header, currencyKeywords)) {
        columns.currency = columnIndex;
      }
    });

    bestScore = score;
    bestMatch = { headerRowIndex: index, columns, headers };
  }

  return bestMatch;
};

const buildRawPayload = (headers: string[], row: unknown[]) => {
  return headers.reduce<Record<string, RawPayloadValue>>((acc, header, index) => {
    if (!header) return acc;

    const value = row[index];
    if (value == null || value === '') return acc;

    if (typeof value === 'number' || typeof value === 'boolean') {
      acc[header] = value;
      return acc;
    }

    acc[header] = String(value);
    return acc;
  }, {});
};

const getAmountFromRow = (row: unknown[], columns: HeaderMap['columns']) => {
  const directAmount = columns.amount != null ? parseAmount(row[columns.amount]) : 0;
  if (directAmount !== 0) return directAmount;

  const credit = columns.credit != null ? parseAmount(row[columns.credit]) : 0;
  if (credit !== 0) return Math.abs(credit);

  const debit = columns.debit != null ? parseAmount(row[columns.debit]) : 0;
  if (debit !== 0) return -Math.abs(debit);

  return 0;
};

const detectBankName = (rows: unknown[][], fileName: string) => {
  for (const row of rows.slice(0, 8)) {
    const joined = row.map((cell) => normalizeTextValue(cell)).filter(Boolean).join(' ');
    if (!joined) continue;

    const match = joined.match(/(Banco\s+[A-Za-z0-9 .-]+)/i);
    if (match) {
      return match[1].trim();
    }
  }

  const upperName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  const bankMatch = upperName.match(/(banco\s+[A-Za-z0-9 ]+)/i);
  return bankMatch ? bankMatch[1].trim() : null;
};

const getSpreadsheetFileType = (fileName: string): 'xls' | 'xlsx' => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension === 'xls' ? 'xls' : 'xlsx';
};

const PDF_TRANSACTION_DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}\b/;

const normalizePdfLine = (value: string) => normalizeTextValue(value).replace(/\s+\$/g, ' $');

const parsePdfAmount = (value: string) => parseAmount(value);

const parsePdfDate = (value: string) => {
  const [day, month, year] = value.split('/');
  return parseDate(`${day}/${month}/${year}`);
};

const isPdfSectionBoundary = (line: string) => {
  const upperLine = removeDiacritics(line).toUpperCase();
  return upperLine.startsWith('SALDOS DIARIOS');
};

const shouldIgnorePdfLine = (line: string) => {
  const upperLine = removeDiacritics(line).toUpperCase();

  if (!upperLine) return true;

  return (
    upperLine === 'DETALLE MOVIMIENTOS' ||
    upperLine === 'FECHA CARGO ABONO DESCRIPCION SALDO N° DOC SUCURSAL' ||
    upperLine === 'FECHA CARGO ABONO DESCRIPCION SALDO N DOC SUCURSAL' ||
    upperLine === 'FECHA SALDO' ||
    upperLine === 'DATOS CUENTA' ||
    upperLine === 'SALDOS' ||
    upperLine.startsWith('CARTOLA PROVISORIA DE CTA. CTE.') ||
    upperLine.startsWith('SR. (A):') ||
    upperLine.startsWith('EMPRESA:') ||
    upperLine.startsWith('CUENTA:') ||
    upperLine.startsWith('NUMERO CARTOLA:') ||
    upperLine.startsWith('NUMERO CARTOLA:') ||
    upperLine.startsWith('SALDO INICIAL:') ||
    upperLine.startsWith('ABONOS:') ||
    upperLine.startsWith('NOTA:') ||
    upperLine.startsWith('INFORMESE SOBRE LA GARANTIA ESTATAL') ||
    /^\d+\s+DE\s+\d+$/.test(upperLine)
  );
};

interface ParsedPdfTransactionLine {
  transactionDate: string;
  amount: number;
  balance: number | null;
  documentNumber: string | null;
  branch: string | null;
  inlineDescription: string | null;
}

const parsePdfTransactionLine = (line: string): ParsedPdfTransactionLine | null => {
  const inlineDescriptionMatch = line.match(
    /^(\d{2}\/\d{2}\/\d{4})\s+\$\s*(-?[\d.]+)\s+(.+?)\s+\$\s*([\d.]+)\s+([A-Z0-9]+)\s+(.+)$/i,
  );

  if (inlineDescriptionMatch) {
    const [, rawDate, rawAmount, rawDescription, rawBalance, rawDocumentNumber, rawBranch] =
      inlineDescriptionMatch;
    const transactionDate = parsePdfDate(rawDate);

    if (!transactionDate) return null;

    return {
      transactionDate,
      amount: parsePdfAmount(rawAmount),
      balance: parsePdfAmount(rawBalance),
      documentNumber: normalizeTextValue(rawDocumentNumber) || null,
      branch: normalizeTextValue(rawBranch) || null,
      inlineDescription: normalizeTextValue(rawDescription) || null,
    };
  }

  const compactMatch = line.match(
    /^(\d{2}\/\d{2}\/\d{4})\s+\$\s*(-?[\d.]+)\s+\$\s*([\d.]+)\s+([A-Z0-9]+)\s+(.+)$/i,
  );

  if (compactMatch) {
    const [, rawDate, rawAmount, rawBalance, rawDocumentNumber, rawBranch] = compactMatch;
    const transactionDate = parsePdfDate(rawDate);

    if (!transactionDate) return null;

    return {
      transactionDate,
      amount: parsePdfAmount(rawAmount),
      balance: parsePdfAmount(rawBalance),
      documentNumber: normalizeTextValue(rawDocumentNumber) || null,
      branch: normalizeTextValue(rawBranch) || null,
      inlineDescription: null,
    };
  }

  const compactWithoutBranchMatch = line.match(
    /^(\d{2}\/\d{2}\/\d{4})\s+\$\s*(-?[\d.]+)\s+\$\s*([\d.]+)\s+([A-Z0-9]+)$/i,
  );

  if (!compactWithoutBranchMatch) return null;

  const [, rawDate, rawAmount, rawBalance, rawDocumentNumber] = compactWithoutBranchMatch;
  const transactionDate = parsePdfDate(rawDate);

  if (!transactionDate) return null;

  return {
    transactionDate,
    amount: parsePdfAmount(rawAmount),
    balance: parsePdfAmount(rawBalance),
    documentNumber: normalizeTextValue(rawDocumentNumber) || null,
    branch: null,
    inlineDescription: null,
  };
};

const splitReferenceFromContext = (line: string) => {
  const normalizedLine = normalizePdfLine(line);
  const match = normalizedLine.match(/^((?=[0-9A-Z-]{6,}\s)(?=[^ ]*(?:\d|-))[0-9A-Z-]+)\s+(.+)$/i);

  if (!match) {
    return {
      referenceId: null,
      descriptionPart: normalizedLine,
    };
  }

  return {
    referenceId: match[1] || null,
    descriptionPart: normalizeTextValue(match[2]) || normalizedLine,
  };
};

const looksLikeNextMovementContext = (line: string) => {
  const normalizedLine = normalizePdfLine(line);
  return (
    /^[0-9A-Z-]{6,}\s+/i.test(normalizedLine) ||
    /^(PAGO|TRANSF\.?|TRANSFERENCIA|COMPRA)\b/i.test(normalizedLine)
  );
};

const getMeaningfulReferenceId = (values: Array<string | null | undefined>) => {
  for (let index = 0; index < values.length; index += 1) {
    const value = normalizeTextValue(values[index]);
    if (!value) continue;

    const compactValue = value.replace(/[^0-9A-Z]/gi, '');
    if (!compactValue || /^0+$/.test(compactValue)) continue;
    return value;
  }

  return null;
};

const inferPayerName = (descriptionParts: string[]) => {
  for (let index = descriptionParts.length - 1; index >= 0; index -= 1) {
    const value = normalizeTextValue(descriptionParts[index]);
    if (!value) continue;

    if (
      !/^(PAGO|TRANSF|COMPRA|CHEQUE|Giro|GIRO|NOTA|FECHA|\$)/i.test(value) &&
      /[A-ZÁÉÍÓÚÑ]/.test(value)
    ) {
      return value;
    }
  }

  const description = descriptionParts.join(' ');
  const transferMatch = description.match(/(?:TRANSF\.?\s+(?:DE|A)\s+|TRANSFERENCIA\s+)(.+)$/i);
  if (transferMatch?.[1]) {
    return normalizeTextValue(transferMatch[1]) || null;
  }

  const paymentMatch = description.match(/PAGO\s+(.+)$/i);
  if (paymentMatch?.[1]) {
    return normalizeTextValue(paymentMatch[1]) || null;
  }

  return null;
};

interface PendingPdfMovement {
  parsedLine: ParsedPdfTransactionLine;
  beforeContext: string[];
  afterContext: string[];
}

const finalizePdfMovement = (movement: PendingPdfMovement, rowIndex: number): ParsedBankStatementMovement | null => {
  const descriptionParts: string[] = [];
  let contextReferenceId: string | null = null;

  movement.beforeContext.forEach((line) => {
    const parsedContext = splitReferenceFromContext(line);
    if (!contextReferenceId && parsedContext.referenceId) {
      contextReferenceId = parsedContext.referenceId;
    }
    if (parsedContext.descriptionPart) {
      descriptionParts.push(parsedContext.descriptionPart);
    }
  });

  if (movement.parsedLine.inlineDescription) {
    descriptionParts.push(movement.parsedLine.inlineDescription);
  }

  movement.afterContext.forEach((line) => {
    const parsedContext = splitReferenceFromContext(line);
    if (!contextReferenceId && parsedContext.referenceId) {
      contextReferenceId = parsedContext.referenceId;
    }
    if (parsedContext.descriptionPart) {
      descriptionParts.push(parsedContext.descriptionPart);
    }
  });

  const description = normalizeTextValue(descriptionParts.join(' ')) || 'Sin descripción';
  const referenceId = getMeaningfulReferenceId([contextReferenceId, movement.parsedLine.documentNumber]);
  const payerName = inferPayerName(descriptionParts);

  return {
    rowIndex,
    transactionDate: movement.parsedLine.transactionDate,
    postedDate: null,
    amount: Math.round(movement.parsedLine.amount * 100) / 100,
    currency: 'CLP',
    description,
    referenceId,
    payerName,
    rawPayload: {
      source: 'pdf',
      parser: 'bank-statement-pdf-v1',
      document_number: movement.parsedLine.documentNumber,
      branch: movement.parsedLine.branch,
      balance: movement.parsedLine.balance,
      context_before: movement.beforeContext.join(' | '),
      context_after: movement.afterContext.join(' | '),
    },
  };
};

export const parseBankStatementPdfTextLines = (lines: string[]): ParsedBankStatementMovement[] => {
  const movements: ParsedBankStatementMovement[] = [];
  const pendingContext: string[] = [];
  let currentMovement: PendingPdfMovement | null = null;

  const findNextRelevantLine = (startIndex: number) => {
    for (let index = startIndex; index < lines.length; index += 1) {
      const candidate = normalizePdfLine(lines[index] || '');
      if (!candidate) continue;
      if (isPdfSectionBoundary(candidate)) return candidate;
      if (shouldIgnorePdfLine(candidate)) continue;
      return candidate;
    }

    return null;
  };

  const flushCurrentMovement = () => {
    if (!currentMovement) return;

    const finalized = finalizePdfMovement(currentMovement, movements.length + 1);
    if (finalized && finalized.amount !== 0) {
      movements.push(finalized);
    }
    currentMovement = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizePdfLine(lines[index] || '');
    if (!line) continue;

    if (isPdfSectionBoundary(line)) {
      flushCurrentMovement();
      break;
    }

    if (shouldIgnorePdfLine(line)) {
      continue;
    }

    if (PDF_TRANSACTION_DATE_REGEX.test(line)) {
      const parsedLine = parsePdfTransactionLine(line);
      if (!parsedLine) continue;

      flushCurrentMovement();

      currentMovement = {
        parsedLine,
        beforeContext: [...pendingContext],
        afterContext: [],
      };
      pendingContext.length = 0;
      continue;
    }

    if (currentMovement) {
      const nextRelevantLine = findNextRelevantLine(index + 1);
      const nextIsTransactionLine = nextRelevantLine ? PDF_TRANSACTION_DATE_REGEX.test(nextRelevantLine) : false;
      const shouldBufferForNextMovement =
        looksLikeNextMovementContext(line) &&
        (nextIsTransactionLine || currentMovement.parsedLine.inlineDescription != null);

      if (shouldBufferForNextMovement) {
        pendingContext.push(line);
        continue;
      }

      currentMovement.afterContext.push(line);
    } else {
      pendingContext.push(line);
    }
  }

  flushCurrentMovement();

  return movements;
};

const extractPdfLines = async (file: File) => {
  const pdfjsLib = await loadPdfJsCompat();
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfJsWorkerSrc;
  }

  const data = new Uint8Array(await file.arrayBuffer());
  let pdf: any;

  try {
    pdf = await pdfjsLib.getDocument({
      data,
      disableAutoFetch: true,
      disableFontFace: true,
      disableStream: true,
      isImageDecoderSupported: false,
      isOffscreenCanvasSupported: false,
      useWorkerFetch: false,
      useWasm: false,
      disableWorker: false,
    }).promise;
  } catch {
    pdf = await pdfjsLib.getDocument({
      data,
      disableAutoFetch: true,
      disableFontFace: true,
      disableStream: true,
      isImageDecoderSupported: false,
      isOffscreenCanvasSupported: false,
      useWorkerFetch: false,
      useWasm: false,
      disableWorker: true,
    }).promise;
  }

  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const rows: Array<{ y: number; chunks: Array<{ x: number; text: string }> }> = [];
    const items = Array.isArray(textContent.items) ? textContent.items : Array.from(textContent.items || []);

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex] as { str?: string; transform?: number[] };
      const text = normalizePdfLine(item?.str || '');
      if (!text) continue;

      const x = item?.transform?.[4] || 0;
      const y = item?.transform?.[5] || 0;
      let row = rows.find((entry) => Math.abs(entry.y - y) < 2);

      if (!row) {
        row = { y, chunks: [] };
        rows.push(row);
      }

      row.chunks.push({ x, text });
    }

    rows
      .sort((a, b) => b.y - a.y)
      .forEach((row) => {
        const line = normalizePdfLine(
          row.chunks
            .sort((a, b) => a.x - b.x)
            .map((chunk) => chunk.text)
            .join(' '),
        );

        if (line) {
          lines.push(line);
        }
      });
  }

  return lines;
};

const detectPdfBankName = (lines: string[]) => {
  const haystack = lines.slice(0, 20).join(' ');
  const match = haystack.match(/Banco\s+[A-Za-z0-9 .-]+/i);
  return match ? match[0].trim() : null;
};

export const parseBankStatementPdf = async (file: File): Promise<ParsedBankStatementFile> => {
  const lines = await extractPdfLines(file);
  const movements = parseBankStatementPdfTextLines(lines);

  if (movements.length === 0) {
    throw new Error(
      'No se detectaron movimientos en la cartola PDF. Verifique que sea una cartola bancaria con texto seleccionable.',
    );
  }

  return {
    bankName: detectPdfBankName(lines),
    fileType: 'pdf',
    parserName: 'bank-statement-pdf-v1',
    movements,
    summary: {
      totalRows: lines.length,
      parsedMovements: movements.length,
      positiveMovements: movements.filter((movement) => movement.amount > 0).length,
      negativeMovements: movements.filter((movement) => movement.amount < 0).length,
    },
  };
};

export const parseBankStatementSpreadsheet = async (
  file: File,
): Promise<ParsedBankStatementFile> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('La cartola no contiene hojas para procesar');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
  });

  const headerMap = detectHeaderMap(rows);
  if (!headerMap) {
    throw new Error('No se pudo identificar la estructura de la cartola. Verifique que incluya fecha, descripción y monto.');
  }

  const movements: ParsedBankStatementMovement[] = [];

  for (let index = headerMap.headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!Array.isArray(row)) continue;

    const transactionDate =
      (headerMap.columns.transactionDate != null ? parseDate(row[headerMap.columns.transactionDate]) : null) ||
      (headerMap.columns.postedDate != null ? parseDate(row[headerMap.columns.postedDate]) : null);
    const postedDate =
      headerMap.columns.postedDate != null ? parseDate(row[headerMap.columns.postedDate]) : null;
    const amount = getAmountFromRow(row, headerMap.columns);

    if (!transactionDate || amount === 0) continue;

    const description =
      (headerMap.columns.description != null
        ? normalizeTextValue(row[headerMap.columns.description])
        : '') || 'Sin descripción';

    const referenceId =
      headerMap.columns.referenceId != null
        ? normalizeTextValue(row[headerMap.columns.referenceId]) || null
        : null;

    const payerName =
      headerMap.columns.payerName != null
        ? normalizeTextValue(row[headerMap.columns.payerName]) || null
        : null;

    const currency =
      headerMap.columns.currency != null
        ? normalizeTextValue(row[headerMap.columns.currency]).toUpperCase() || 'CLP'
        : 'CLP';

    movements.push({
      rowIndex: index + 1,
      transactionDate,
      postedDate,
      amount: Math.round(amount * 100) / 100,
      currency,
      description,
      referenceId,
      payerName,
      rawPayload: buildRawPayload(headerMap.headers, row),
    });
  }

  return {
    bankName: detectBankName(rows, file.name),
    fileType: getSpreadsheetFileType(file.name),
    parserName: 'bank-statement-spreadsheet-v1',
    movements,
    summary: {
      totalRows: Math.max(rows.length - (headerMap.headerRowIndex + 1), 0),
      parsedMovements: movements.length,
      positiveMovements: movements.filter((movement) => movement.amount > 0).length,
      negativeMovements: movements.filter((movement) => movement.amount < 0).length,
    },
  };
};

export const isSupportedBankStatementSpreadsheet = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension === 'xls' || extension === 'xlsx';
};

export const isSupportedBankStatementPdf = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension === 'pdf';
};

export const isSupportedBankStatementFile = (file: File) =>
  isSupportedBankStatementSpreadsheet(file) || isSupportedBankStatementPdf(file);

export const parseBankStatementFile = async (file: File): Promise<ParsedBankStatementFile> => {
  if (isSupportedBankStatementSpreadsheet(file)) {
    return parseBankStatementSpreadsheet(file);
  }

  if (isSupportedBankStatementPdf(file)) {
    return parseBankStatementPdf(file);
  }

  throw new Error('Formato de cartola no soportado');
};

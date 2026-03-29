import { createWorker } from 'tesseract.js';

type ReceiptTotals = {
  neto?: number;
  iva?: number;
  total: number;
};

export interface LocalReceiptExtractionResult {
  vendorName: string;
  vendorRut: string;
  documentType: string;
  documentNumber: string;
  date: string | null;
  currency: string;
  totals: ReceiptTotals;
  paymentMethod: string;
  notes: string;
  confidence: Record<string, number>;
  rawText: string;
  source: 'local-ocr';
}

const DOCUMENT_TYPES = [
  'FACTURA ELECTRONICA',
  'FACTURA',
  'BOLETA ELECTRONICA',
  'BOLETA',
];

const PAYMENT_METHOD_PATTERNS: Array<[RegExp, string]> = [
  [/\bdebito\b/i, 'débito'],
  [/\bcredito\b/i, 'crédito'],
  [/\btransferencia\b/i, 'transferencia'],
  [/\befectivo\b/i, 'efectivo'],
];

const cleanText = (text: string) =>
  text
    .replace(/[|]/g, 'I')
    .replace(/[‘’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const normalizeDate = (day: string, month: string, year: string) => {
  const yyyy = year.length === 2 ? `20${year}` : year;
  const mm = month.padStart(2, '0');
  const dd = day.padStart(2, '0');

  const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${yyyy}-${mm}-${dd}`;
};

const extractDate = (text: string) => {
  const matches = [...text.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g)];
  for (const match of matches) {
    const normalized = normalizeDate(match[1], match[2], match[3]);
    if (normalized) return normalized;
  }
  return null;
};

const parseAmount = (value: string) => {
  const digitsOnly = value.replace(/[^\d]/g, '');
  if (!digitsOnly) return null;
  const parsed = Number.parseInt(digitsOnly, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractTotal = (rawText: string) => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const prioritizedMatchers = [
    /(?:total\s*(?:a\s*pagar|pagado)?|monto\s*total|total\$?)\D{0,12}(\$?\s?[\d.]{3,})/i,
    /(?:importe\s*total)\D{0,12}(\$?\s?[\d.]{3,})/i,
  ];

  for (const line of lines) {
    for (const matcher of prioritizedMatchers) {
      const match = line.match(matcher);
      const amount = match?.[1] ? parseAmount(match[1]) : null;
      if (amount && amount > 0) return amount;
    }
  }

  const allAmounts = lines
    .flatMap((line) => [...line.matchAll(/\$?\s?([\d.]{3,})/g)])
    .map((match) => parseAmount(match[1]))
    .filter((value): value is number => typeof value === 'number' && value > 0)
    .sort((a, b) => b - a);

  return allAmounts[0] ?? 0;
};

const extractDocumentType = (text: string) => {
  const uppercase = text.toUpperCase();
  const found = DOCUMENT_TYPES.find((type) => uppercase.includes(type));
  return found
    ?.replace('ELECTRONICA', 'Electrónica')
    .replace('FACTURA', 'Factura')
    .replace('BOLETA', 'Boleta') ?? '';
};

const extractDocumentNumber = (text: string) => {
  const match = text.match(/(?:folio|n[°ºo]?|nro\.?|numero|num\.?)(?:\s*:?\s*|\s+)(\d{3,})/i);
  return match?.[1] ?? '';
};

const extractRut = (text: string) => {
  const match = text.match(/\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/);
  return match?.[0] ?? '';
};

const extractVendorName = (rawText: string) => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter(Boolean);

  const blocked = [
    'SII',
    'RUT',
    'TOTAL',
    'NETO',
    'IVA',
    'CAJA',
    'EFECTIVO',
    'DEBITO',
    'CREDITO',
    'GRACIAS',
  ];

  for (const line of lines.slice(0, 8)) {
    const uppercase = line.toUpperCase();
    if (line.length < 4 || line.length > 60) continue;
    if (/\d{4,}/.test(line)) continue;
    if (DOCUMENT_TYPES.some((type) => uppercase.includes(type))) continue;
    if (blocked.some((word) => uppercase.includes(word))) continue;
    if (!/[A-ZÁÉÍÓÚÑ]/i.test(line)) continue;
    return line;
  }

  return '';
};

const extractPaymentMethod = (text: string) => {
  for (const [pattern, label] of PAYMENT_METHOD_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return '';
};

const buildNotes = (rawText: string, vendorName: string, documentType: string, documentNumber: string) => {
  const description = [vendorName, documentType && documentNumber ? `${documentType} ${documentNumber}` : documentType]
    .filter(Boolean)
    .join(' · ');

  if (description) return description;

  return rawText
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ')
    .slice(0, 160);
};

export const extractReceiptDataLocally = async (imageUrl: string): Promise<LocalReceiptExtractionResult> => {
  const worker = await createWorker('spa+eng');

  try {
    const result = await worker.recognize(imageUrl);
    const rawText = result.data.text || '';
    const normalizedText = cleanText(rawText);

    const vendorName = extractVendorName(rawText);
    const documentType = extractDocumentType(normalizedText);
    const documentNumber = extractDocumentNumber(normalizedText);
    const date = extractDate(normalizedText);
    const total = extractTotal(rawText);
    const vendorRut = extractRut(normalizedText);
    const paymentMethod = extractPaymentMethod(normalizedText);
    const notes = buildNotes(rawText, vendorName, documentType, documentNumber);

    return {
      vendorName,
      vendorRut,
      documentType,
      documentNumber,
      date,
      currency: 'CLP',
      totals: { total },
      paymentMethod,
      notes,
      confidence: {
        ocr: Math.max(0, Math.min(1, (result.data.confidence || 0) / 100)),
      },
      rawText,
      source: 'local-ocr',
    };
  } finally {
    await worker.terminate();
  }
};
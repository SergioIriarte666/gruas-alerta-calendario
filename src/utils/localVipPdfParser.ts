import { loadPdfJsCompat } from '@/utils/loadPdfJsCompat';

export interface LocalVipPdfItem {
  patente: string;
  detail: string;
  amount: number;
  quantity?: number;
}

export interface LocalQuotePdfResult {
  quoteNumber: string;
  date: string | null;
  items: LocalVipPdfItem[];
  totals: { neto: number; iva: number; total: number };
  clientRut: string;
  rawText: string;
  source: 'local-pdf';
}

export interface LocalPurchaseOrderPdfResult {
  ocNumber: string;
  date: string | null;
  items: LocalVipPdfItem[];
  totals: { neto: number; iva: number; total: number };
  quoteReference: string;
  clientRut: string;
  rawText: string;
  source: 'local-pdf';
}

const normalizeSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeRut = (value: string) => value.replace(/[.\s-]/g, '').toUpperCase();
const parseAmount = (value: string) => {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number.parseInt(digits, 10) : 0;
};

const formatIsoDate = (day: string, month: string, year: string) => {
  const normalizedYear = year.length === 2 ? `20${year}` : year;
  const normalizedMonth = month.padStart(2, '0');
  const normalizedDay = day.padStart(2, '0');
  const date = new Date(`${normalizedYear}-${normalizedMonth}-${normalizedDay}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return `${normalizedYear}-${normalizedMonth}-${normalizedDay}`;
};

const extractDate = (text: string) => {
  const matches = [...text.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g)];
  for (const match of matches) {
    const date = formatIsoDate(match[1], match[2], match[3]);
    if (date) return date;
  }
  return null;
};

const PLATE_REGEX = /\b(?:[A-Z]{4}-?\d{2}|[A-Z]{2}-?\d{4})\b/g;
const VIN_REGEX = /\b[A-HJ-NPR-Z0-9]{16,17}\b/g;
const AMOUNT_REGEX = /\$?\s?\d{1,3}(?:\.\d{3})+(?:,\d+)?|\$?\s?\d{4,}/g;
const RUT_REGEX = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g;

const extractIdentifiers = (line: string) => {
  const upper = line.toUpperCase();
  const matches = [
    ...(upper.match(PLATE_REGEX) || []),
    ...(upper.match(VIN_REGEX) || []),
  ];

  return Array.from(new Set(matches.map((match) => match.replace(/\s+/g, '').toUpperCase())));
};

const pickClientRut = (text: string, labels: string[]) => {
  const upperText = text.toUpperCase();
  for (const label of labels) {
    const index = upperText.indexOf(label);
    if (index === -1) continue;
    const slice = text.slice(index, index + 220);
    const rut = slice.match(RUT_REGEX)?.[0];
    if (rut) return rut;
  }
  return '';
};

const extractTotals = (text: string) => {
  const neto = text.match(/NETO\D{0,20}(\$?\s?[\d.]{3,})/i)?.[1];
  const iva = text.match(/IVA\D{0,20}(\$?\s?[\d.]{3,})/i)?.[1];
  const total = text.match(/(?:TOTAL\s*(?:A\s*PAGAR|GENERAL)?|MONTO\s*TOTAL)\D{0,20}(\$?\s?[\d.]{3,})/i)?.[1];

  const amounts = [...text.matchAll(AMOUNT_REGEX)]
    .map((match) => parseAmount(match[0]))
    .filter((value) => value > 0)
    .sort((a, b) => b - a);

  return {
    neto: parseAmount(neto || '') || 0,
    iva: parseAmount(iva || '') || 0,
    total: parseAmount(total || '') || amounts[0] || 0,
  };
};

const cleanDetail = (line: string) => normalizeSpaces(line.replace(/\$?\s?\d{1,3}(?:\.\d{3})+(?:,\d+)?|\$?\s?\d{4,}/g, ''));

const extractQuantity = (line: string) => {
  const quantity = line.match(/\b(\d{1,3})\s*[xX]\b/)?.[1] || line.match(/CANT(?:IDAD)?\D{0,6}(\d{1,3})/i)?.[1];
  return quantity ? Number.parseInt(quantity, 10) : 1;
};

const shouldSkipLine = (line: string) => {
  const upper = line.toUpperCase();
  if (!upper) return true;
  return [
    'TOTAL',
    'NETO',
    'IVA',
    'SUBTOTAL',
    'EXENTO',
    'OBSERVACION',
    'OBSERVACIÓN',
    'NOTA',
    'RUT',
    'COTIZACION',
    'COTIZACIÓN',
    'ORDEN DE COMPRA',
    'PURCHASE ORDER',
  ].some((value) => upper.startsWith(value));
};

const extractItems = (lines: string[]): LocalVipPdfItem[] => {
  const items: LocalVipPdfItem[] = [];

  for (const line of lines) {
    if (shouldSkipLine(line)) continue;

    const identifiers = extractIdentifiers(line);
    if (identifiers.length === 0) continue;

    const amounts = [...line.matchAll(AMOUNT_REGEX)]
      .map((match) => parseAmount(match[0]))
      .filter((value) => value > 0);

    const quantity = extractQuantity(line);
    const amount = amounts.length > 0 ? amounts[amounts.length - 1] : 0;
    const detail = cleanDetail(line) || normalizeSpaces(line);
    const distributedAmount = identifiers.length > 1 && amount > 0 ? Math.round(amount / identifiers.length) : amount;

    for (const patente of identifiers) {
      items.push({
        patente,
        detail,
        amount: distributedAmount,
        quantity,
      });
    }
  }

  return items;
};

const extractQuoteNumber = (text: string) => {
  const candidates = [
    text.match(/\bCOT[-\s]?(\d{3,10})\b/i)?.[1],
    text.match(/(?:COTIZACI[ÓO]N|PRESUPUESTO)\D{0,15}(\d{3,10})/i)?.[1],
    text.match(/\bN[°ºO]?\s*(\d{3,10})\b/i)?.[1],
  ];
  return candidates.find(Boolean) || '';
};

const extractOcNumber = (text: string) => {
  const candidates = [
    text.match(/(?:ORDEN\s+DE\s+COMPRA|PURCHASE\s+ORDER)\D{0,20}(\d{4,12})/i)?.[1],
    text.match(/\bOC[-\s]?(\d{4,12})\b/i)?.[1],
    text.match(/(?:N[°ºO]?\s*DE\s*OC|N[°ºO]?)\D{0,10}(\d{4,12})/i)?.[1],
  ];
  return candidates.find(Boolean) || '';
};

const extractQuoteReference = (text: string) => {
  const candidates = [
    ...text.matchAll(/(?:SEGUN|SEGÚN|REF\.?|COTIZACI[ÓO]N|PRESUPUESTO|PPTO|COT-)\D{0,20}(\d{3,10})/gi),
  ].map((match) => match[1]);

  return candidates[0] || '';
};

const extractPdfLines = async (file: File) => {
  const pdfjsLib = await loadPdfJsCompat();
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableAutoFetch: true,
    disableFontFace: true,
    disableStream: true,
    isImageDecoderSupported: false,
    isOffscreenCanvasSupported: false,
    useWorkerFetch: false,
    useWasm: false,
  });
  const pdf = await loadingTask.promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const rows: Array<{ y: number; chunks: Array<{ x: number; text: string }> }> = [];

    for (const item of textContent.items as any[]) {
      const text = normalizeSpaces(item?.str || '');
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
        const line = row.chunks
          .sort((a, b) => a.x - b.x)
          .map((chunk) => chunk.text)
          .join(' ');

        const normalizedLine = normalizeSpaces(line);
        if (normalizedLine) lines.push(normalizedLine);
      });
  }

  return { lines, text: lines.join('\n') };
};

export const extractQuoteDataLocally = async (file: File): Promise<LocalQuotePdfResult> => {
  const { lines, text } = await extractPdfLines(file);
  return {
    quoteNumber: extractQuoteNumber(text),
    date: extractDate(text),
    items: extractItems(lines),
    totals: extractTotals(text),
    clientRut: pickClientRut(text, ['SEÑOR', 'SENOR', 'CLIENTE', 'RAZÓN SOCIAL', 'RAZON SOCIAL']) || '',
    rawText: text,
    source: 'local-pdf',
  };
};

export const extractPurchaseOrderDataLocally = async (file: File): Promise<LocalPurchaseOrderPdfResult> => {
  const { lines, text } = await extractPdfLines(file);
  return {
    ocNumber: extractOcNumber(text),
    date: extractDate(text),
    items: extractItems(lines),
    totals: extractTotals(text),
    quoteReference: extractQuoteReference(text),
    clientRut: pickClientRut(text, ['RUT', 'EMPRESA', 'RAZÓN SOCIAL', 'RAZON SOCIAL']) || '',
    rawText: text,
    source: 'local-pdf',
  };
};

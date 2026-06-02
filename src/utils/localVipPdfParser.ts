import { loadPdfJsCompat, pdfJsWorkerSrc } from '@/utils/loadPdfJsCompat';
import { createWorker } from 'tesseract.js';

export interface LocalVipPdfItem {
  patente: string;
  detail: string;
  amount: number;
  quantity?: number;
  serviceDate?: string | null;
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
  budgetReference: string;
  clientRut: string;
  rawText: string;
  source: 'local-pdf';
}

const normalizeSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeRut = (value: string) => value.replace(/[.\s-]/g, '').toUpperCase();
const normalizeIdentifier = (value: string) => value.replace(/\s+/g, '').toUpperCase();
const parseAmount = (value: string) => {
  const raw = value.trim();
  if (!raw) return 0;

  const normalized = raw.replace(/[^\d.,-]/g, '');

  if (/,(\d{2})$/.test(normalized)) {
    const integerPart = normalized.split(',')[0] ?? '';
    const digits = integerPart.replace(/[^\d-]/g, '').replace(/\./g, '');
    return digits ? Number.parseInt(digits, 10) : 0;
  }

  if (/\.(\d{2})$/.test(normalized)) {
    const integerPart = normalized.split('.')[0] ?? '';
    const digits = integerPart.replace(/[^\d-]/g, '').replace(/,/g, '');
    return digits ? Number.parseInt(digits, 10) : 0;
  }

  const digits = normalized.replace(/[^\d-]/g, '');
  return digits ? Number.parseInt(digits, 10) : 0;
};

const collectMatches = (text: string, pattern: RegExp) => {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    matches.push(match);

    if (match[0] === '') {
      regex.lastIndex += 1;
    }
  }

  return matches;
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
  const matches = collectMatches(text, /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g);
  for (const match of matches) {
    const date = formatIsoDate(match[1], match[2], match[3]);
    if (date) return date;
  }
  return null;
};

const PLATE_REGEX = /(?:^|[^A-Z0-9])([A-Z]{4}-?\d{2}|[A-Z]{2}-?\d{4})(?=$|[^A-Z0-9])/g;
const VIN_REGEX = /(?:^|[^A-Z0-9])([A-HJ-NPR-Z0-9]{16,17})(?=$|[^A-Z0-9])/g;
const EMBEDDED_VIN_REGEX = /(?:^|[^A-Z0-9])(?:[A-Z]{2,20})?([A-HJ-NPR-Z0-9]{16,17})(?=$|[^A-Z0-9])/g;
const SHORT_CODE_REGEX = /(?:^|[^A-Z0-9])([A-Z]{2,}[A-Z0-9]*\d+[A-Z0-9]*)(?=$|[^A-Z0-9])/g;
const AMOUNT_REGEX = /\$?\s?\d{1,3}(?:\.\d{3})+(?:,\d+)?|\$?\s?\d{4,}/g;
const RUT_REGEX = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g;
const SERVICE_KEYWORDS = [
  'SERVICIO',
  'GRUA',
  'GRÚA',
  'REMOLQUE',
  'TRASLADO',
  'ASISTENCIA',
  'RESCATE',
  'RETIRO',
  'INGRESO',
  'SALIDA',
  'VEHICULO',
  'VEHÍCULO',
  'AUTO',
  'CAMION',
  'CAMIÓN',
  'CAMIONETA',
  'TOWING',
  'MOVE',
];

const normalizeDetailForCompare = (value: string) =>
  normalizeSpaces(value)
    .toUpperCase()
    .replace(/[.,;:()]/g, ' ')
    .replace(/\b(?:PATENTE|PLACA|PPU|VIN|CHASIS)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hasServiceKeyword = (value: string) => {
  const upper = value.toUpperCase();
  for (let index = 0; index < SERVICE_KEYWORDS.length; index += 1) {
    if (upper.includes(SERVICE_KEYWORDS[index])) return true;
  }
  return false;
};

const isWeakDetail = (detail: string, patente: string) => {
  const normalizedDetail = normalizeDetailForCompare(detail).replace(/[-\s]/g, '');
  const normalizedPatente = normalizeIdentifier(patente).replace(/-/g, '');
  return !normalizedDetail || normalizedDetail === normalizedPatente || normalizedDetail.length < 8;
};

const getItemScore = (item: LocalVipPdfItem) => {
  let score = 0;
  if (item.amount > 0) score += 100;
  if (hasServiceKeyword(item.detail)) score += 20;
  if (!isWeakDetail(item.detail, item.patente)) score += 10;
  score += Math.min(item.detail.length, 40);
  return score;
};

const areItemsMergeable = (left: LocalVipPdfItem, right: LocalVipPdfItem) => {
  const leftPatente = normalizeIdentifier(left.patente).replace(/-/g, '');
  const rightPatente = normalizeIdentifier(right.patente).replace(/-/g, '');
  if (leftPatente !== rightPatente) return false;
  if (left.amount !== right.amount) return false;

  const leftDetail = normalizeDetailForCompare(left.detail);
  const rightDetail = normalizeDetailForCompare(right.detail);
  if (leftDetail === rightDetail) return true;
  if (isWeakDetail(left.detail, left.patente) || isWeakDetail(right.detail, right.patente)) return true;
  return leftDetail.includes(rightDetail) || rightDetail.includes(leftDetail);
};

const finalizeItems = (items: LocalVipPdfItem[]) => {
  const normalizedItems = items
    .map((item) => ({
      ...item,
      patente: normalizeIdentifier(item.patente),
      detail: normalizeSpaces(item.detail),
    }))
    .filter((item) => item.patente);

  const positiveAmountsByPatente = new Set(
    normalizedItems
      .filter((item) => item.amount > 0)
      .map((item) => item.patente.replace(/-/g, '')),
  );

  const filteredItems = normalizedItems.filter((item) => {
    const normalizedPatente = item.patente.replace(/-/g, '');
    if (item.amount <= 0 && positiveAmountsByPatente.has(normalizedPatente)) {
      return hasServiceKeyword(item.detail) && !isWeakDetail(item.detail, item.patente);
    }

    if (item.amount <= 0 && !hasServiceKeyword(item.detail)) return false;
    return true;
  });

  const deduped: LocalVipPdfItem[] = [];

  for (let index = 0; index < filteredItems.length; index += 1) {
    const item = filteredItems[index];
    const existingIndex = deduped.findIndex((existing) => areItemsMergeable(existing, item));

    if (existingIndex === -1) {
      deduped.push(item);
      continue;
    }

    if (getItemScore(item) > getItemScore(deduped[existingIndex])) {
      deduped[existingIndex] = item;
    }
  }

  return deduped;
};

const extractIdentifiers = (line: string) => {
  const upper = line.toUpperCase();
  const values = new Set<string>();

  // No extraer identificadores desde líneas que contengan RUT del cliente.
  // El RUT chileno no debe confundirse con patente.
  if (/R\.?U\.?T\.?/.test(upper)) return [];
  const rutMatches = upper.match(RUT_REGEX) || [];
  const rutDigits = new Set(rutMatches.map((r) => r.replace(/[^\dkK]/g, '').toUpperCase()));

  const patterns = [PLATE_REGEX, VIN_REGEX, EMBEDDED_VIN_REGEX];

  for (let patternIndex = 0; patternIndex < patterns.length; patternIndex += 1) {
    const matches = collectMatches(upper, patterns[patternIndex]);
    for (let matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
      const identifier = normalizeIdentifier(matches[matchIndex][1] || matches[matchIndex][0] || '');
      if (!identifier) continue;
      if (identifier.length >= 16 && !/[A-Z]/.test(identifier)) continue;
      // Rechazar si coincide con un RUT detectado en la misma línea
      const idDigits = identifier.replace(/[^\dkK]/g, '').toUpperCase();
      if (idDigits && rutDigits.has(idDigits)) continue;
      values.add(identifier);
    }
  }

  if (values.size === 0) {
    const shortMatches = collectMatches(upper, SHORT_CODE_REGEX);
    for (let i = 0; i < shortMatches.length; i += 1) {
      const id = normalizeIdentifier(shortMatches[i][1] || '');
      if (id.length >= 6 && id.length <= 10 && /[A-Z]/.test(id) && /\d/.test(id)) {
        const idDigits = id.replace(/[^\dkK]/g, '').toUpperCase();
        if (idDigits && rutDigits.has(idDigits)) continue;
        values.add(id);
      }
    }
  }

  return Array.from(values);
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

  const amounts = collectMatches(text, AMOUNT_REGEX)
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

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (shouldSkipLine(line)) continue;

    const windowLines = [line, lines[index + 1], lines[index + 2]].filter(Boolean) as string[];
    const mergedLine = normalizeSpaces(windowLines.join(' '));
    const identifiers = extractIdentifiers(mergedLine);
    if (identifiers.length === 0) continue;

    const amounts = collectMatches(mergedLine, AMOUNT_REGEX)
      .map((match) => parseAmount(match[0]))
      .filter((value) => value > 0);

    const quantity = extractQuantity(mergedLine);
    const amount = amounts.length > 0 ? amounts[amounts.length - 1] : 0;
    const detailSource = amount > 0 ? mergedLine : line;
    const detail = cleanDetail(detailSource) || normalizeSpaces(detailSource);
    if (amount <= 0 && !hasServiceKeyword(detail)) continue;
    const distributedAmount = identifiers.length > 1 && amount > 0 ? Math.round(amount / identifiers.length) : amount;

    for (const patente of identifiers) {
      const alreadyExists = items.some(
        (item) => item.patente === patente && item.detail === detail && item.amount === distributedAmount,
      );
      if (alreadyExists) continue;

      items.push({
        patente,
        detail,
        amount: distributedAmount,
        quantity,
      });
    }
  }

  return finalizeItems(items);
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
  const candidates = collectMatches(
    text,
    /(?:SEGUN|SEGÚN|REF\.?|COTIZACI[ÓO]N|COT-)\D{0,20}(\d{3,10})/gi,
  ).map((match) => match[1]);

  return candidates[0] || '';
};

const extractBudgetReference = (text: string) => {
  const candidates = collectMatches(
    text,
    /(?:PRESUPUESTO|PPTO\.?|PRES\.?)\s*N?[°ºo]?\s*(\d{3,10})/gi,
  ).map((match) => match[1]);
  return candidates[0] || '';
};

const extractDateFromDetail = (detail: string): string | null => {
  const m = detail.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (!m) return null;
  return formatIsoDate(m[1], m[2], m[3]);
};

const renderPdfPageToDataUrl = async (page: any, scale: number) => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  if (!context) return null;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL('image/png');
};

const extractPdfTextWithOcr = async (pdf: any) => {
  const maxPages = Math.min(4, Number(pdf?.numPages || 0) || 0);
  if (maxPages === 0) return '';

  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    worker = await createWorker('eng', 1, {
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.0/dist/worker.min.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0',
    });
    const chunks: string[] = [];

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const dataUrl = await renderPdfPageToDataUrl(page, 2);
      if (!dataUrl) continue;
      const result = await worker.recognize(dataUrl);
      const rawText = result?.data?.text || '';
      if (rawText.trim()) chunks.push(rawText);
    }

    return chunks.join('\n');
  } finally {
    if (worker) {
      try { await worker.terminate(); } catch (error) { void error; }
    }
  }
};

const extractPdfLines = async (file: File) => {
  const pdfjsLib = await loadPdfJsCompat();
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfJsWorkerSrc;
  }
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  const baseParams = {
    data,
    disableAutoFetch: true,
    disableFontFace: true,
    disableStream: true,
    isImageDecoderSupported: false,
    isOffscreenCanvasSupported: false,
    useWorkerFetch: false,
    useWasm: false,
  } as any;

  let pdf: any;
  try {
    pdf = await pdfjsLib.getDocument({ ...baseParams, disableWorker: false }).promise;
  } catch (error) {
    pdf = await pdfjsLib.getDocument({ ...baseParams, disableWorker: true }).promise;
  }
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const rows: Array<{ y: number; chunks: Array<{ x: number; text: string }> }> = [];
    const items = Array.isArray(textContent.items) ? textContent.items : Array.from(textContent.items || []);

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index] as any;
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

  let text = lines.join('\n');

  if (extractItems(lines).length === 0) {
    const ocrText = await extractPdfTextWithOcr(pdf);
    const normalizedOcrText = ocrText.trim();
    if (normalizedOcrText) {
      const ocrLines = normalizedOcrText
        .split(/\r?\n/)
        .map((line) => normalizeSpaces(line))
        .filter(Boolean);
      text = normalizedOcrText;
      return { lines: ocrLines, text };
    }
  }

  return { lines, text };
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
  const items = extractItems(lines).map((item) => ({
    ...item,
    serviceDate: extractDateFromDetail(item.detail),
  }));
  return {
    ocNumber: extractOcNumber(text),
    date: extractDate(text),
    items,
    totals: extractTotals(text),
    quoteReference: extractQuoteReference(text),
    budgetReference: extractBudgetReference(text),
    clientRut: pickClientRut(text, ['RUT', 'EMPRESA', 'RAZÓN SOCIAL', 'RAZON SOCIAL']) || '',
    rawText: text,
    source: 'local-pdf',
  };
};

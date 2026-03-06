import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Client } from '@/types';
import { toTitleCase } from '@/lib/utils';

export type DocumentType = 'factura' | 'nota_credito' | 'nota_debito';

export interface ParsedInvoiceRow {
  item: string;
  emitido: string;
  documento: string;
  folio: string;
  fecha: string;
  rut: string;
  codigoCliente: string;
  razonSocial: string;
  direccionCliente: string;
  formaPago: string;
  neto: number;
  iva: number;
  tasaIva: number;
  total: number;
  observacion: string;
  pagado: string;
  fechaCreacion: string;
  fechaVencimiento: string;
  correo: string;
  documentType?: DocumentType;
}

export interface ProcessedInvoice {
  folio: string;
  numeroFiscal: string;
  rut: string;
  razonSocial: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  iva: number;
  total: number;
  status: 'paid' | 'sent' | 'overdue';
  isPaid: boolean;
  notes: string;
  clientId?: string;
  clientMatch?: 'exact' | 'multiple' | 'none';
  matchedClients?: Client[];
  documentType: DocumentType;
}

export interface UnmatchedClient {
  rut: string;
  razonSocial: string;
  address?: string;
  email?: string;
  invoiceCount: number;
  totalAmount: number;
  resolution: 'create' | 'assign' | 'ignore' | 'pending';
  assignedClientId?: string;
  suggestion?: {
    clientId: string;
    name: string;
    score: number;
  };
}

export interface ImportPreview {
  matched: ProcessedInvoice[];
  unmatched: ProcessedInvoice[];
  duplicates: ProcessedInvoice[];
  unmatchedClients: UnmatchedClient[];
  totalInvoices: number;
  totalAmount: number;
  skippedNonFactura: number;
  creditNoteCount: number;
  debitNoteCount: number;
  facturaCount: number;
}

// Normalize RUT for comparison (keep only digits and K)
const normalizeRut = (rut: string): string => {
  return rut.replace(/[^0-9Kk]/g, '').trim().toUpperCase();
};

// Parse number handling Chilean format and parenthesized negatives: (181000) → -181000
const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = String(value).trim();
  // Check for parenthesized negative: (123456)
  const parenMatch = str.match(/^\((.+)\)$/);
  if (parenMatch) {
    const inner = parenMatch[1].replace(/\./g, '').replace(',', '.').trim();
    const num = Number(inner);
    return isNaN(num) ? 0 : -num;
  }
  const cleaned = str.replace(/\./g, '').replace(',', '.').trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

// Parse date from various formats to YYYY-MM-DD
const parseDate = (dateVal: any): string | null => {
  if (!dateVal) return null;

  // Handle Excel serial numbers
  if (typeof dateVal === 'number') {
    const date = new Date((dateVal - 25569) * 86400 * 1000);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  const dateStr = String(dateVal).trim();
  
  // Try ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // Try DD-MM-YYYY, DD/MM/YYYY, DD-MM-YY, DD/MM/YY
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    let day: string, month: string, year: string;
    
    if (parts[0].length <= 2 && (parts[2].length === 4 || parts[2].length === 2)) {
      [day, month, year] = parts;
      // Handle 2-digit year
      if (year.length === 2) {
        const y = parseInt(year, 10);
        year = (y <= 50 ? '20' : '19') + year;
      }
    } else if (parts[0].length === 4 && parts[2].length <= 2) {
      [year, month, day] = parts;
    } else {
      return null;
    }
    
    const m = month.padStart(2, '0');
    const d = day.padStart(2, '0');
    
    const date = new Date(`${year}-${m}-${d}`);
    if (!isNaN(date.getTime())) {
      return `${year}-${m}-${d}`;
    }
  }
  
  return null;
};

// Determine invoice status
const determineStatus = (pagado: string, fechaVencimiento: any): 'paid' | 'sent' | 'overdue' => {
  if (pagado?.toUpperCase() === 'SI') return 'paid';
  
  if (fechaVencimiento) {
    const dueDateStr = parseDate(fechaVencimiento);
    if (dueDateStr) {
      const due = new Date(dueDateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);
      const dueTime = due.getTime() + (due.getTimezoneOffset() * 60000);
      const todayTime = today.getTime();
      if (dueTime < todayTime) return 'overdue';
    }
  }
  return 'sent';
};

// ──────────────────────────────────────────────────────────
// Libro de Ventas parser (section-based XLS/XLSX)
// ──────────────────────────────────────────────────────────

const SECTION_MAP: Record<string, DocumentType> = {
  'FACTURA ELECTRONICA': 'factura',
  'NOTA DE CREDITO ELECTRONICA': 'nota_credito',
  'NOTA DE DEBITO ELECTRONICA': 'nota_debito',
};

/**
 * Detect if a raw sheet looks like a "Libro de Ventas" format
 * by searching for known section headers in the first rows.
 */
const isLibroDeVentas = (rawRows: any[][]): boolean => {
  const searchRows = rawRows.slice(0, 30);
  for (const row of searchRows) {
    const joined = row.map(c => String(c ?? '')).join(' ').toUpperCase();
    if (joined.includes('LIBRO DE VENTAS') || joined.includes('FACTURA ELECTRONICA')) {
      return true;
    }
  }
  return false;
};

/**
 * Find header row index by looking for a row that contains "FOLIO" and "R.U.T" (or similar).
 */
const findHeaderRow = (rawRows: any[][]): { headerIdx: number; colMap: Record<string, number> } | null => {
  for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
    const row = rawRows[i];
    const upper = row.map(c => String(c ?? '').toUpperCase().trim());
    const folioIdx = upper.findIndex(c => c === 'FOLIO');
    const rutIdx = upper.findIndex(c => c.includes('R.U.T') || c === 'RUT');
    if (folioIdx >= 0 && rutIdx >= 0) {
      // Build column map
      const colMap: Record<string, number> = {};
      upper.forEach((val, idx) => {
        if (val.includes('Nº') || val === 'N°' || val === 'NO' || val === '#') colMap['num'] = idx;
        if (val === 'FOLIO') colMap['folio'] = idx;
        if (val === 'FECHA') colMap['fecha'] = idx;
        if (val.includes('RAZON SOCIAL') || val.includes('CLIENTE')) colMap['razonSocial'] = idx;
        if (val.includes('R.U.T') || val === 'RUT') colMap['rut'] = idx;
        if (val === 'EXENTO') colMap['exento'] = idx;
        if (val === 'NETO') colMap['neto'] = idx;
        if (val.includes('I.V.A') && !val.includes('PLAZO') && !val.includes('TERCERO')) colMap['iva'] = idx;
        if (val === 'TOTAL') colMap['total'] = idx;
      });
      return { headerIdx: i, colMap };
    }
  }
  return null;
};

const parseLibroDeVentasXLSX = (rawRows: any[][]): ParsedInvoiceRow[] => {
  const headerInfo = findHeaderRow(rawRows);
  if (!headerInfo) return [];

  const { headerIdx, colMap } = headerInfo;
  const dataRows = rawRows.slice(headerIdx + 1);

  let currentDocType: DocumentType | null = null;
  const results: ParsedInvoiceRow[] = [];

  for (const row of dataRows) {
    // Check if this is a section header row
    const joinedUpper = row.map(c => String(c ?? '').trim()).join(' ').toUpperCase();
    
    // Skip total/subtotal rows
    if (joinedUpper.includes('TOTAL GENERAL') || joinedUpper.includes('TOTAL ')) {
      // But first check if it's a section start before the subtotal check
    }

    // Detect section headers
    let foundSection = false;
    for (const [sectionName, docType] of Object.entries(SECTION_MAP)) {
      if (joinedUpper.includes(sectionName)) {
        currentDocType = docType;
        foundSection = true;
        break;
      }
    }
    if (foundSection) continue;

    // Skip if no document type set yet
    if (!currentDocType) continue;

    // Skip total/subtotal rows
    if (joinedUpper.includes('TOTAL GENERAL') || joinedUpper.match(/^\s*0\s+/)) continue;

    // Extract folio - must be a valid number
    const folioVal = colMap['folio'] !== undefined ? row[colMap['folio']] : null;
    const folioStr = String(folioVal ?? '').trim();
    if (!folioStr || isNaN(Number(folioStr))) continue;

    // Extract fields
    const fecha = colMap['fecha'] !== undefined ? row[colMap['fecha']] : '';
    const razonSocial = colMap['razonSocial'] !== undefined ? String(row[colMap['razonSocial']] ?? '').trim() : '';
    const rut = colMap['rut'] !== undefined ? String(row[colMap['rut']] ?? '').trim() : '';
    const neto = colMap['neto'] !== undefined ? parseNumber(row[colMap['neto']]) : 0;
    const iva = colMap['iva'] !== undefined ? parseNumber(row[colMap['iva']]) : 0;
    const total = colMap['total'] !== undefined ? parseNumber(row[colMap['total']]) : 0;

    if (!rut || !razonSocial) continue;

    results.push({
      item: '',
      emitido: '',
      documento: currentDocType === 'factura' ? 'FACTURA ELECTRONICA' : 
                 currentDocType === 'nota_credito' ? 'NOTA DE CREDITO ELECTRONICA' :
                 'NOTA DE DEBITO ELECTRONICA',
      folio: folioStr,
      fecha: String(fecha ?? ''),
      rut,
      codigoCliente: '',
      razonSocial,
      direccionCliente: '',
      formaPago: '',
      neto,
      iva,
      tasaIva: 19,
      total,
      observacion: '',
      pagado: '',
      fechaCreacion: '',
      fechaVencimiento: '',
      correo: '',
      documentType: currentDocType,
    });
  }

  return results;
};

// ──────────────────────────────────────────────────────────
// CSV parser (original columnar format)
// ──────────────────────────────────────────────────────────

export const parseCSVFile = (file: File): Promise<ParsedInvoiceRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      delimiter: ';',
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data as Record<string, any>[];
        
        const findVal = (row: any, keys: string[]) => {
          for (const key of keys) {
            const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
            if (foundKey) return row[foundKey];
          }
          return '';
        };

        const dataRows = rows.map(row => ({
          item: findVal(row, ['Item', 'N°', 'No', '#']),
          emitido: findVal(row, ['Emitido', 'Emision', 'Fecha Emision']),
          documento: findVal(row, ['Documento', 'Tipo DTE', 'Tipo Documento']),
          folio: findVal(row, ['Folio', 'Numero', 'N° Folio']),
          fecha: findVal(row, ['Fecha', 'Fecha Emision', 'F. Emis']),
          rut: findVal(row, ['RUT', 'R.U.T.', 'Rut Cliente']),
          codigoCliente: findVal(row, ['Codigo', 'Cod. Cliente']),
          razonSocial: findVal(row, ['Razon Social', 'Cliente', 'Nombre']),
          direccionCliente: findVal(row, ['Direccion', 'Domicilio']),
          formaPago: findVal(row, ['Forma Pago', 'F. Pago']),
          neto: parseNumber(findVal(row, ['Neto', 'Monto Neto'])),
          iva: parseNumber(findVal(row, ['IVA', 'Monto IVA'])),
          tasaIva: parseNumber(findVal(row, ['Tasa IVA', '% IVA'])),
          total: parseNumber(findVal(row, ['Total', 'Monto Total'])),
          observacion: findVal(row, ['Observacion', 'Glosa', 'Nota']),
          pagado: findVal(row, ['Pagado', 'Estado Pago']),
          fechaCreacion: findVal(row, ['Fecha Creacion', 'Creado']),
          fechaVencimiento: findVal(row, ['Fecha Vencimiento', 'Vencimiento', 'F. Venc']),
          correo: findVal(row, ['Correo', 'Email', 'Email Cliente']),
        }));
        resolve(dataRows);
      },
      error: (error) => reject(error),
    });
  });
};

// ──────────────────────────────────────────────────────────
// XLSX parser with auto-detection
// ──────────────────────────────────────────────────────────

export const parseXLSXFile = (file: File): Promise<ParsedInvoiceRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Get raw rows (array of arrays) for format detection
        const rawRows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });
        
        // Auto-detect: Libro de Ventas format?
        if (isLibroDeVentas(rawRows)) {
          console.log('Detected Libro de Ventas format');
          const parsed = parseLibroDeVentasXLSX(rawRows);
          resolve(parsed);
          return;
        }

        // Fallback: original columnar format
        console.log('Using columnar format parser');
        const rows = XLSX.utils.sheet_to_json<any>(firstSheet);
        
        const findVal = (row: any, keys: string[]) => {
          for (const key of keys) {
            if (row[key] !== undefined) return row[key];
            const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
            if (foundKey) return row[foundKey];
          }
          return '';
        };
        
        const dataRows = rows.map(row => ({
          item: String(findVal(row, ['Item', 'N°', 'No', '#']) || ''),
          emitido: String(findVal(row, ['Emitido', 'Emision']) || ''),
          documento: String(findVal(row, ['Documento', 'Tipo DTE', 'Tipo Documento']) || ''),
          folio: String(findVal(row, ['Folio', 'Numero', 'N° Folio']) || ''),
          fecha: String(findVal(row, ['Fecha', 'Fecha Emision', 'F. Emis']) || ''),
          rut: String(findVal(row, ['RUT', 'R.U.T.', 'Rut Cliente']) || ''),
          codigoCliente: String(findVal(row, ['Codigo', 'Cod. Cliente']) || ''),
          razonSocial: String(findVal(row, ['Razon Social', 'Cliente', 'Nombre']) || ''),
          direccionCliente: String(findVal(row, ['Direccion', 'Domicilio']) || ''),
          formaPago: String(findVal(row, ['Forma Pago', 'F. Pago']) || ''),
          neto: parseNumber(findVal(row, ['Neto', 'Monto Neto'])),
          iva: parseNumber(findVal(row, ['IVA', 'Monto IVA'])),
          tasaIva: parseNumber(findVal(row, ['Tasa IVA', '% IVA'])),
          total: parseNumber(findVal(row, ['Total', 'Monto Total'])),
          observacion: String(findVal(row, ['Observacion', 'Glosa', 'Nota']) || ''),
          pagado: String(findVal(row, ['Pagado', 'Estado Pago']) || ''),
          fechaCreacion: String(findVal(row, ['Fecha Creacion', 'Creado']) || ''),
          fechaVencimiento: String(findVal(row, ['Fecha Vencimiento', 'Vencimiento', 'F. Venc']) || ''),
          correo: String(findVal(row, ['Correo', 'Email', 'Email Cliente']) || ''),
        }));
        resolve(dataRows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// ──────────────────────────────────────────────────────────
// Process parsed rows against existing clients and invoices
// ──────────────────────────────────────────────────────────

const getDocumentType = (row: ParsedInvoiceRow): DocumentType => {
  if (row.documentType) return row.documentType;
  const doc = row.documento?.toUpperCase() || '';
  if (doc.includes('NOTA DE CREDITO')) return 'nota_credito';
  if (doc.includes('NOTA DE DEBITO')) return 'nota_debito';
  if (doc.includes('FACTURA')) return 'factura';
  return 'factura'; // default
};

const getFolioPrefix = (docType: DocumentType): string => {
  switch (docType) {
    case 'nota_credito': return 'HIST-NC';
    case 'nota_debito': return 'HIST-ND';
    default: return 'HIST-F';
  }
};

const getDocumentLabel = (docType: DocumentType): string => {
  switch (docType) {
    case 'nota_credito': return 'Nota de Crédito';
    case 'nota_debito': return 'Nota de Débito';
    default: return 'Factura';
  }
};

export const processInvoiceRows = (
  rows: ParsedInvoiceRow[],
  clients: Client[],
  existingNumerosFiscales: Set<string>
): ImportPreview => {
  // If rows have documentType set (Libro de Ventas), process all of them.
  // Otherwise (old columnar format), filter to FACTURA ELECTRONICA only.
  const hasDocTypeField = rows.some(r => r.documentType);
  
  let processable: ParsedInvoiceRow[];
  let skippedNonFactura: number;
  
  if (hasDocTypeField) {
    // Libro de Ventas: all rows are already filtered by the parser
    processable = rows;
    skippedNonFactura = 0;
  } else {
    // Old format: filter only known document types
    processable = rows.filter(r => {
      const doc = r.documento?.toUpperCase() || '';
      return doc.includes('FACTURA ELECTRONICA') || doc.includes('NOTA DE CREDITO') || doc.includes('NOTA DE DEBITO');
    });
    skippedNonFactura = rows.length - processable.length;
  }

  const matched: ProcessedInvoice[] = [];
  const unmatched: ProcessedInvoice[] = [];
  const duplicates: ProcessedInvoice[] = [];
  const unmatchedClientsMap = new Map<string, UnmatchedClient>();
  
  let facturaCount = 0;
  let creditNoteCount = 0;
  let debitNoteCount = 0;

  for (const row of processable) {
    const docType = getDocumentType(row);
    const normalizedRut = normalizeRut(row.rut);
    const issueDate = parseDate(row.fecha) || '';
    const dueDate = parseDate(row.fechaVencimiento) || issueDate;
    const status = determineStatus(row.pagado, row.fechaVencimiento);
    const prefix = getFolioPrefix(docType);

    // Count by type
    if (docType === 'factura') facturaCount++;
    else if (docType === 'nota_credito') creditNoteCount++;
    else if (docType === 'nota_debito') debitNoteCount++;

    const processed: ProcessedInvoice = {
      folio: `${prefix}-${row.folio}`,
      numeroFiscal: row.folio,
      rut: row.rut,
      razonSocial: toTitleCase(row.razonSocial),
      issueDate,
      dueDate,
      subtotal: row.neto,
      iva: row.iva,
      total: row.total,
      status,
      isPaid: row.pagado?.toUpperCase() === 'SI',
      notes: `Importación historial — ${getDocumentLabel(docType)}${row.observacion ? ` — ${row.observacion}` : ''}`.trim(),
      documentType: docType,
    };

    // Check duplicates by numero_fiscal
    if (existingNumerosFiscales.has(row.folio)) {
      duplicates.push(processed);
      continue;
    }

    // Match client by RUT
    const matchingClients = clients.filter(c => normalizeRut(c.rut) === normalizedRut);

    if (matchingClients.length >= 1) {
      processed.clientId = matchingClients[0].id;
      processed.clientMatch = matchingClients.length > 1 ? 'multiple' : 'exact';
      if (matchingClients.length > 1) {
        processed.matchedClients = matchingClients;
      }
      matched.push(processed);
    } else {
      processed.clientMatch = 'none';
      unmatched.push(processed);
      if (!unmatchedClientsMap.has(normalizedRut)) {
        unmatchedClientsMap.set(normalizedRut, {
          rut: row.rut,
          razonSocial: toTitleCase(row.razonSocial),
          address: toTitleCase(row.direccionCliente || ''),
          email: row.correo || '',
          invoiceCount: 0,
          totalAmount: 0,
          resolution: 'pending',
        });
      }
      const uc = unmatchedClientsMap.get(normalizedRut)!;
      uc.invoiceCount++;
      uc.totalAmount += row.total;
    }
  }

  return {
    matched,
    unmatched,
    duplicates,
    unmatchedClients: Array.from(unmatchedClientsMap.values()),
    totalInvoices: processable.length,
    totalAmount: processable.reduce((sum, r) => sum + r.total, 0),
    skippedNonFactura,
    facturaCount,
    creditNoteCount,
    debitNoteCount,
  };
};

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Client } from '@/types';

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
}

export interface UnmatchedClient {
  rut: string;
  razonSocial: string;
  invoiceCount: number;
  totalAmount: number;
  resolution: 'create' | 'assign' | 'ignore' | 'pending';
  assignedClientId?: string;
}

export interface ImportPreview {
  matched: ProcessedInvoice[];
  unmatched: ProcessedInvoice[];
  duplicates: ProcessedInvoice[];
  unmatchedClients: UnmatchedClient[];
  totalInvoices: number;
  totalAmount: number;
  skippedNonFactura: number;
}

// Normalize RUT for comparison (remove dots, keep dash)
const normalizeRut = (rut: string): string => {
  return rut.replace(/[^0-9Kk]/g, '').trim().toUpperCase();
};

// Parse date from DD-MM-YYYY format
const parseDateDMY = (dateStr: string): string | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  const d = new Date(`${year}-${month}-${day}`);
  if (isNaN(d.getTime())) return null;
  return `${year}-${month}-${day}`;
};

// Determine invoice status
const determineStatus = (pagado: string, fechaVencimiento: string): 'paid' | 'sent' | 'overdue' => {
  if (pagado?.toUpperCase() === 'SI') return 'paid';
  
  if (fechaVencimiento) {
    const dueDate = parseDateDMY(fechaVencimiento);
    if (dueDate) {
      const due = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);
      if (due < today) return 'overdue';
    }
  }
  return 'sent';
};

// Parse number from string (handles Chilean format)
const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/\./g, '').replace(',', '.').trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

// Parse CSV file
export const parseCSVFile = (file: File): Promise<ParsedInvoiceRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      delimiter: ';',
      header: false,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data as string[][];
        // Skip header row
        const dataRows = rows.slice(1).map(row => ({
          item: row[0] || '',
          emitido: row[1] || '',
          documento: row[2] || '',
          folio: row[3] || '',
          fecha: row[4] || '',
          rut: row[5] || '',
          codigoCliente: row[6] || '',
          razonSocial: row[7] || '',
          direccionCliente: row[8] || '',
          formaPago: row[12] || '',
          neto: parseNumber(row[17]),
          iva: parseNumber(row[18]),
          tasaIva: parseNumber(row[19]),
          total: parseNumber(row[26]),
          observacion: row[30] || '',
          pagado: row[31] || '',
          fechaCreacion: row[37] || '',
          fechaVencimiento: row[41] || '',
          correo: row[42] || '',
        }));
        resolve(dataRows);
      },
      error: (error) => reject(error),
    });
  });
};

// Parse XLSX file
export const parseXLSXFile = (file: File): Promise<ParsedInvoiceRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(firstSheet, { header: 1 });
        
        const dataRows = (rows as any[][]).slice(1).map(row => ({
          item: String(row[0] || ''),
          emitido: String(row[1] || ''),
          documento: String(row[2] || ''),
          folio: String(row[3] || ''),
          fecha: String(row[4] || ''),
          rut: String(row[5] || ''),
          codigoCliente: String(row[6] || ''),
          razonSocial: String(row[7] || ''),
          direccionCliente: String(row[8] || ''),
          formaPago: String(row[12] || ''),
          neto: parseNumber(row[17]),
          iva: parseNumber(row[18]),
          tasaIva: parseNumber(row[19]),
          total: parseNumber(row[26]),
          observacion: String(row[30] || ''),
          pagado: String(row[31] || ''),
          fechaCreacion: String(row[37] || ''),
          fechaVencimiento: String(row[41] || ''),
          correo: String(row[42] || ''),
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

// Process parsed rows against existing clients and invoices
export const processInvoiceRows = (
  rows: ParsedInvoiceRow[],
  clients: Client[],
  existingNumerosFiscales: Set<string>
): ImportPreview => {
  // Filter only FACTURA ELECTRONICA
  const facturas = rows.filter(r => r.documento?.toUpperCase().includes('FACTURA ELECTRONICA'));
  const skippedNonFactura = rows.length - facturas.length;

  const matched: ProcessedInvoice[] = [];
  const unmatched: ProcessedInvoice[] = [];
  const duplicates: ProcessedInvoice[] = [];
  const unmatchedClientsMap = new Map<string, UnmatchedClient>();

  for (const row of facturas) {
    const normalizedRut = normalizeRut(row.rut);
    const issueDate = parseDateDMY(row.fecha) || '';
    const dueDate = parseDateDMY(row.fechaVencimiento) || issueDate;
    const status = determineStatus(row.pagado, row.fechaVencimiento);

    const processed: ProcessedInvoice = {
      folio: `HIST-${row.folio}`,
      numeroFiscal: row.folio,
      rut: row.rut,
      razonSocial: row.razonSocial,
      issueDate,
      dueDate,
      subtotal: row.neto,
      iva: row.iva,
      total: row.total,
      status,
      isPaid: row.pagado?.toUpperCase() === 'SI',
      notes: `Importación historial 2025 — ${row.observacion || ''}`.trim(),
    };

    // Check duplicates by numero_fiscal
    if (existingNumerosFiscales.has(row.folio)) {
      duplicates.push(processed);
      continue;
    }

    // Match client by RUT
    const matchingClients = clients.filter(c => normalizeRut(c.rut) === normalizedRut);

    if (matchingClients.length >= 1) {
      // RUT is the primary key for matching, even when multiple departments exist
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
          razonSocial: row.razonSocial,
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
    totalInvoices: facturas.length,
    totalAmount: facturas.reduce((sum, r) => sum + r.total, 0),
    skippedNonFactura,
  };
};

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Supplier } from '@/types/suppliers';
import { stringSimilarity, toTitleCase } from '@/lib/utils';

export type PurchaseDocumentType = 'factura' | 'nota_credito' | 'nota_debito' | 'factura_exenta';

export interface ParsedPurchaseRow {
  documento: string;
  folio: string;
  fecha: string;
  rut: string;
  razonSocial: string;
  neto: number;
  iva: number;
  total: number;
  descripcion: string; // Equivalent to observacion
  pagado: string;
  fechaVencimiento: string;
  documentType?: PurchaseDocumentType;
}

export interface ProcessedPurchase {
  invoice_number: string; // folio
  rut: string;
  razonSocial: string;
  issueDate: string;
  dueDate: string;
  net_amount: number;
  tax_amount: number;
  amount: number; // total
  status: 'paid' | 'pending' | 'overdue';
  description: string;
  supplierId?: string;
  supplierMatch?: 'exact' | 'multiple' | 'none';
  matchedSuppliers?: Supplier[];
  documentType: PurchaseDocumentType;
}

export interface UnmatchedSupplier {
  rut: string;
  razonSocial: string;
  invoiceCount: number;
  totalAmount: number;
  resolution: 'create' | 'assign' | 'ignore' | 'pending';
  assignedSupplierId?: string;
  suggestion?: {
    supplierId: string;
    name: string;
    score: number;
  };
}

export interface PurchaseImportPreview {
  matched: ProcessedPurchase[];
  unmatched: ProcessedPurchase[];
  duplicates: ProcessedPurchase[];
  unmatchedSuppliers: UnmatchedSupplier[];
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

// Parse number handling Chilean format and parenthesized negatives
const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = String(value).trim();
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

  if (typeof dateVal === 'number') {
    const date = new Date((dateVal - 25569) * 86400 * 1000);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  const dateStr = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    let day: string, month: string, year: string;
    if (parts[0].length <= 2 && (parts[2].length === 4 || parts[2].length === 2)) {
      [day, month, year] = parts;
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
const determineStatus = (pagado: string, fechaVencimiento: any): 'paid' | 'pending' | 'overdue' => {
  if (pagado?.toUpperCase() === 'SI' || pagado?.toUpperCase() === 'PAGADO') return 'paid';
  
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
  return 'pending';
};

export const parseCSVFile = (file: File): Promise<ParsedPurchaseRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map((row: any) => ({
          documento: row['Tipo Doc'] || row['Documento'] || '',
          folio: row['Folio'] || row['Numero'] || '',
          fecha: row['Fecha Emision'] || row['Fecha Docto'] || row['Fecha'] || '',
          rut: row['RUT Proveedor'] || row['RUT'] || '',
          razonSocial: row['Razon Social'] || row['Proveedor'] || '',
          neto: parseNumber(row['Monto Neto'] || row['Neto']),
          iva: parseNumber(row['Monto IVA'] || row['IVA']),
          total: parseNumber(row['Monto Total'] || row['Total']),
          descripcion: row['Descripcion'] || row['Observacion'] || '',
          pagado: row['Pagado'] || '',
          fechaVencimiento: row['Fecha Vencimiento'] || row['Vencimiento'] || '',
        }));
        resolve(rows);
      },
      error: (error) => reject(error),
    });
  });
};

export const parseXLSXFile = (file: File): Promise<ParsedPurchaseRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Simple column mapping if not using complex logic
        // For now, let's assume a standard format or simple header search
        // We can reuse findHeaderRow logic if needed, but simplified for now
        
        // Find header row
        let headerRowIdx = -1;
        let colMap: any = {};
        
        for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
            const row = rawRows[i].map(c => String(c).toUpperCase().trim());
            if (row.includes('FOLIO') && (row.includes('RUT') || row.includes('R.U.T'))) {
                headerRowIdx = i;
                row.forEach((col: string, idx: number) => {
                    if (col === 'FOLIO') colMap.folio = idx;
                    if (col.includes('RUT') || col === 'R.U.T') colMap.rut = idx;
                    if (col.includes('RAZON') || col.includes('PROVEEDOR')) colMap.razonSocial = idx;
                    if (col === 'FECHA' || col.includes('EMISION')) colMap.fecha = idx;
                    if (col.includes('NETO')) colMap.neto = idx;
                    if (col.includes('IVA') && !col.includes('RET')) colMap.iva = idx;
                    if (col.includes('TOTAL')) colMap.total = idx;
                    if (col.includes('VENCIMIENTO')) colMap.vencimiento = idx;
                    if (col.includes('TIPO') || col.includes('DOC')) colMap.documento = idx;
                });
                break;
            }
        }

        if (headerRowIdx === -1) {
             // Fallback to simple conversion if headers not found
             resolve([]);
             return;
        }

        const rows: ParsedPurchaseRow[] = [];
        
        // Track current document section type for "Libro de Compras" format
        let currentDocType = 'FACTURA';
        
        // Keywords that indicate section headers or non-data rows
        const sectionKeywords = ['FACTURA ELECTRONICA', 'FACTURA NO AFECTA', 'FACTURA EXENTA', 
          'NOTA DE CREDITO', 'NOTA DE DEBITO', 'BOLETA', 'IMPUESTOS', 'CODIGO', 'DESCRIPCION',
          'PERIODO LIBRO', 'TOTAL GENERAL'];
        const skipKeywords = ['TOTAL', 'IMPUESTOS', 'CODIGO', 'PERIODO', 'Página'];
        
        for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;
            
            // Join all cells to check for section headers and skip keywords
            const rowText = row.map((c: any) => String(c || '').trim()).join(' ').toUpperCase();
            
            // Skip empty rows (all cells empty)
            if (rowText.replace(/\s/g, '').length === 0) continue;
            
            // Detect document type section changes
            if (rowText.includes('NOTA DE CREDITO') || rowText.includes('NOTA CREDITO')) {
                currentDocType = 'NOTA CREDITO';
                continue;
            }
            if (rowText.includes('NOTA DE DEBITO') || rowText.includes('NOTA DEBITO')) {
                currentDocType = 'NOTA DEBITO';
                continue;
            }
            if (rowText.includes('FACTURA NO AFECTA') || rowText.includes('FACTURA EXENTA') || rowText.includes('EXENTA ELECTRONICA')) {
                currentDocType = 'FACTURA EXENTA';
                continue;
            }
            if (rowText.includes('FACTURA ELECTRONICA') || rowText.includes('FACTURA AFECTA')) {
                currentDocType = 'FACTURA';
                continue;
            }
            
            // Skip rows that contain section keywords but no valid folio
            if (sectionKeywords.some(kw => rowText.includes(kw))) continue;
            
            // Skip total rows (check ALL columns, not just first)
            if (skipKeywords.some(kw => rowText.includes(kw))) continue;
            
            // Extract values from mapped columns
            const folio = String(row[colMap.folio] || '').trim();
            const rut = String(row[colMap.rut] || '').trim();
            const total = parseNumber(row[colMap.total]);
            
            // Skip rows with empty folio or RUT (these are non-data rows)
            if (!folio || !rut || folio === 'undefined' || rut === 'undefined') continue;
            
            // Skip rows with zero total (summary/empty rows)
            if (total === 0) continue;
            
            // Determine document type: use section tracking or column if available
            let documento = currentDocType;
            if (colMap.documento !== undefined && row[colMap.documento]) {
                documento = String(row[colMap.documento]).trim();
            }

            rows.push({
                folio,
                rut,
                razonSocial: String(row[colMap.razonSocial] || ''),
                fecha: row[colMap.fecha],
                neto: parseNumber(row[colMap.neto]),
                iva: parseNumber(row[colMap.iva]),
                total,
                documento,
                fechaVencimiento: row[colMap.vencimiento],
                descripcion: '',
                pagado: ''
            });
        }
        resolve(rows);

      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const processPurchaseRows = (
  rows: ParsedPurchaseRow[],
  suppliers: Supplier[],
  existingInvoiceKeys: Set<string> // Changed from existingInvoiceNumbers
): PurchaseImportPreview => {
  const matched: ProcessedPurchase[] = [];
  const unmatched: ProcessedPurchase[] = [];
  const duplicates: ProcessedPurchase[] = [];
  const unmatchedSuppliersMap = new Map<string, UnmatchedSupplier>();

  let skippedNonFactura = 0;
  let creditNoteCount = 0;
  let debitNoteCount = 0;
  let facturaCount = 0;

  for (const row of rows) {
    // Determine doc type
    let docType: PurchaseDocumentType = 'factura';
    const docUpper = row.documento.toUpperCase();
    if (docUpper.includes('CREDITO') || docUpper.includes('NC')) {
      docType = 'nota_credito';
      creditNoteCount++;
    } else if (docUpper.includes('DEBITO') || docUpper.includes('ND')) {
      docType = 'nota_debito';
      debitNoteCount++;
    } else if (docUpper.includes('EXENTA')) {
      docType = 'factura_exenta';
      facturaCount++;
    } else {
      facturaCount++;
    }

    // Clean data
    const rut = normalizeRut(row.rut);
    const issueDate = parseDate(row.fecha) || new Date().toISOString().split('T')[0];
    const dueDate = parseDate(row.fechaVencimiento) || issueDate;
    const folio = row.folio.trim();

    if (!folio || !rut) continue;

    const uniqueKey = `${rut}-${folio}`;
    const isDuplicate = existingInvoiceKeys.has(uniqueKey);
    
    // Find supplier
    const matchedSupplier = suppliers.find(s => normalizeRut(s.rut || '') === rut);
    
    // Status
    const status = determineStatus(row.pagado, row.fechaVencimiento);

    const processed: ProcessedPurchase = {
      invoice_number: folio,
      rut,
      razonSocial: toTitleCase(row.razonSocial),
      issueDate,
      dueDate,
      net_amount: row.neto,
      tax_amount: row.iva,
      amount: row.total,
      status,
      description: row.descripcion,
      supplierId: matchedSupplier?.id,
      supplierMatch: matchedSupplier ? 'exact' : 'none',
      matchedSuppliers: matchedSupplier ? [matchedSupplier] : [],
      documentType: docType
    };

    if (isDuplicate) {
        duplicates.push(processed);
    } else if (matchedSupplier) {
        matched.push(processed);
    } else {
        unmatched.push(processed);
        
        // Track unmatched suppliers
        if (!unmatchedSuppliersMap.has(rut)) {
            unmatchedSuppliersMap.set(rut, {
                rut,
                razonSocial: processed.razonSocial,
                invoiceCount: 0,
                totalAmount: 0,
                resolution: 'pending'
            });
        }
        const us = unmatchedSuppliersMap.get(rut)!;
        us.invoiceCount++;
        us.totalAmount += processed.amount;
    }
  }

  return {
    matched,
    unmatched,
    duplicates,
    unmatchedSuppliers: Array.from(unmatchedSuppliersMap.values()),
    totalInvoices: matched.length + unmatched.length + duplicates.length,
    totalAmount: [...matched, ...unmatched].reduce((sum, inv) => sum + inv.amount, 0),
    skippedNonFactura,
    creditNoteCount,
    debitNoteCount,
    facturaCount
  };
};

import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import { businessClock } from '@/utils/businessClock';
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { getCraneTypeLabel } from '@/utils/craneType';
import { formatVehicleInfo } from '@/utils/statusHelpers';
import { type Service } from '@/types';
import { type Settings } from '@/types/settings';
import { fetchCompanyData, type CompanyData } from './companyDataFetcher';

export const IVA_RATE = 0.19;
export const QUOTE_VALIDITY_DAYS = 15;
export const DEFAULT_COMMERCIAL_TERMS =
  'Forma de pago: según acuerdo comercial vigente con el cliente. Los valores están expresados en pesos chilenos y sujetos a confirmación operativa.';

export const PDF_COLORS = {
  ink: [34, 40, 49] as [number, number, number],
  slate: [99, 115, 129] as [number, number, number],
  line: [203, 213, 225] as [number, number, number],
  panel: [248, 250, 252] as [number, number, number],
  accent: [22, 78, 99] as [number, number, number],
  accentSoft: [232, 244, 248] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

export interface CommercialDocumentContext {
  company: CompanyData;
  emissionDate: string;
}

export interface FinancialSummary {
  serviceNet: number;
  custodyNet: number;
  excessNet: number;
  subtotalNet: number;
  iva: number;
  total: number;
}

const readBlobAsDataUrl = (blob: Blob): Promise<string | null> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });

const loadImageAsDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await readBlobAsDataUrl(await response.blob());
  } catch {
    return null;
  }
};

const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 200, height: 80 });
    img.src = dataUrl;
  });

export const formatDocumentCurrency = (value: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value || 0)));

export const formatDocumentDate = (value?: string | null) => {
  if (!value) return '-';

  try {
    const parsed = safeParseDateOnly(value);
    return businessClock.format(parsed, 'dd/MM/yyyy');
  } catch {
    return value;
  }
};

export const formatDocumentDateTime = (date?: string | null, time?: string | null) => {
  const formattedDate = formatDocumentDate(date);
  return time ? `${formattedDate} ${time}` : formattedDate;
};

export const formatText = (value?: string | number | null) => {
  if (value === null || value === undefined) return '-';
  const text = String(value).trim();
  return text || '-';
};

export const addDaysToBusinessDate = (date: string, days: number) => {
  const parsed = safeParseDateOnly(date);
  parsed.setDate(parsed.getDate() + days);
  return businessClock.format(parsed, 'yyyy-MM-dd');
};

export const buildFinancialSummary = (
  service: Service,
  serviceNet: number,
): FinancialSummary => {
  const custodyNet = Number(service.custodyTotalAmount || 0);
  const excessNet = service.hasExcess ? Number(service.excessAmount || 0) : 0;
  const subtotalNet = serviceNet + custodyNet + excessNet;
  const iva = Math.round(subtotalNet * IVA_RATE);
  return {
    serviceNet,
    custodyNet,
    excessNet,
    subtotalNet,
    iva,
    total: subtotalNet + iva,
  };
};

export const resolvePrimaryOperator = (service: Service | (Service & { operators?: Array<{ role?: string; operator?: Service['operator'] }> })) => {
  const operators = (service as { operators?: Array<{ role?: string; operator?: Service['operator'] }> }).operators;
  if (operators && operators.length > 0) {
    return operators.find((entry) => entry.role === 'Principal')?.operator || operators[0]?.operator || null;
  }
  return service.operator || null;
};

export const buildCraneLabel = (service: Service) => {
  if (!service.crane) return '-';
  const typeLabel = service.crane.type ? getCraneTypeLabel(service.crane.type) : '';
  return [service.crane.licensePlate, `${service.crane.brand} ${service.crane.model}`.trim(), typeLabel]
    .filter(Boolean)
    .join(' · ');
};

export const buildVehicleLabel = (service: Service) => {
  const visible = formatVehicleInfo(service);
  const patent = service.licensePlate ? `Patente ${service.licensePlate}` : null;
  return [visible, patent].filter(Boolean).join(' · ') || '-';
};

export const fetchCommercialDocumentContext = async (
  settings: Settings,
): Promise<CommercialDocumentContext> => {
  const company = await fetchCompanyData(settings.company);
  return {
    company,
    emissionDate: businessClock.format(businessClock.now(), 'dd/MM/yyyy'),
  };
};

export const addLetterhead = async (
  doc: jsPDF,
  context: CommercialDocumentContext,
  options: { title: string; documentNumber: string; secondaryLine?: string },
): Promise<number> => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 16;

  doc.setFillColor(...PDF_COLORS.accent);
  doc.rect(0, 0, pageWidth, 8, 'F');

  const logoDataUrl = context.company.logoUrl ? await loadImageAsDataUrl(context.company.logoUrl) : null;
  let textStartX = marginX;

  if (logoDataUrl) {
    const { width, height } = await getImageDimensions(logoDataUrl);
    const renderHeight = 18;
    const renderWidth = (width / height) * renderHeight;
    doc.addImage(logoDataUrl, 'PNG', marginX, 14, renderWidth, renderHeight);
    textStartX = marginX + renderWidth + 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_COLORS.ink);
  doc.setFontSize(15);
  doc.text(formatText(context.company.businessName), textStartX, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.slate);
  const companyLines = [
    `RUT: ${formatText(context.company.rut)}`,
    formatText(context.company.address),
    [context.company.phone ? `Tel: ${context.company.phone}` : '', context.company.email ? `Email: ${context.company.email}` : '']
      .filter(Boolean)
      .join(' · '),
  ].filter((line) => line && line !== '-');

  let infoY = 23;
  companyLines.forEach((line) => {
    doc.text(line, textStartX, infoY);
    infoY += 4.2;
  });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_COLORS.accent);
  doc.setFontSize(16);
  doc.text(options.title, pageWidth - marginX, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_COLORS.ink);
  doc.setFontSize(9);
  doc.text(options.documentNumber, pageWidth - marginX, 24, { align: 'right' });
  doc.text(`Emisión: ${context.emissionDate}`, pageWidth - marginX, 28.5, { align: 'right' });

  if (options.secondaryLine) {
    doc.setTextColor(...PDF_COLORS.slate);
    doc.text(options.secondaryLine, pageWidth - marginX, 33, { align: 'right' });
  }

  doc.setDrawColor(...PDF_COLORS.line);
  doc.line(marginX, 39, pageWidth - marginX, 39);

  return 45;
};

export const addSectionTable = (
  doc: jsPDF,
  startY: number,
  title: string,
  rows: Array<[string, string]>,
  columnWidths?: { label?: number; value?: number },
) => {
  autoTable(doc, {
    startY,
    head: [[title, '']],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: PDF_COLORS.accent,
      textColor: PDF_COLORS.white,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      textColor: PDF_COLORS.ink,
      fontSize: 9,
    },
    styles: {
      lineColor: PDF_COLORS.line,
      lineWidth: 0.1,
      cellPadding: 2.6,
      valign: 'middle',
    },
    columnStyles: {
      0: {
        cellWidth: columnWidths?.label ?? 46,
        fontStyle: 'bold',
        fillColor: PDF_COLORS.panel,
        textColor: PDF_COLORS.slate,
      },
      1: {
        cellWidth: columnWidths?.value ?? 132,
      },
    },
    margin: { left: 16, right: 16 },
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
};

export const addLineItemsTable = (
  doc: jsPDF,
  startY: number,
  title: string,
  rows: RowInput[],
  footerRows?: RowInput[],
) => {
  autoTable(doc, {
    startY,
    head: [['Glosa', 'Cantidad', 'Valor Unitario', 'Total Neto']],
    body: rows,
    foot: footerRows,
    theme: 'grid',
    styles: {
      fontSize: 9,
      lineColor: PDF_COLORS.line,
      lineWidth: 0.1,
      cellPadding: 2.6,
      textColor: PDF_COLORS.ink,
    },
    headStyles: {
      fillColor: PDF_COLORS.accent,
      textColor: PDF_COLORS.white,
      fontStyle: 'bold',
      fontSize: 9.5,
    },
    footStyles: {
      fillColor: PDF_COLORS.panel,
      textColor: PDF_COLORS.ink,
      fontStyle: 'bold',
      fontSize: 9,
    },
    margin: { left: 16, right: 16 },
    columnStyles: {
      0: { cellWidth: 96 },
      1: { cellWidth: 22, halign: 'right' },
      2: { cellWidth: 34, halign: 'right' },
      3: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: ({ pageNumber, settings: tableSettings }) => {
      if (pageNumber === 1 && tableSettings.startY === startY) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...PDF_COLORS.ink);
        doc.text(title, 16, startY - 2.5);
      }
    },
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
};

export const addSummaryTable = (
  doc: jsPDF,
  startY: number,
  title: string,
  rows: RowInput[],
  footerRows?: RowInput[],
) => {
  autoTable(doc, {
    startY,
    head: [[title, 'Monto']],
    body: rows,
    foot: footerRows,
    theme: 'grid',
    styles: {
      fontSize: 9,
      lineColor: PDF_COLORS.line,
      lineWidth: 0.1,
      cellPadding: 2.6,
      textColor: PDF_COLORS.ink,
    },
    headStyles: {
      fillColor: PDF_COLORS.accent,
      textColor: PDF_COLORS.white,
      fontStyle: 'bold',
    },
    footStyles: {
      fillColor: PDF_COLORS.accentSoft,
      textColor: PDF_COLORS.ink,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 118, fontStyle: 'bold' },
      1: { cellWidth: 56, halign: 'right' },
    },
    margin: { left: 20, right: 16 },
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
};

export const addFooter = (doc: jsPDF, note: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...PDF_COLORS.line);
    doc.line(16, pageHeight - 14, pageWidth - 16, pageHeight - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.slate);
    doc.text(note, 16, pageHeight - 8.5);
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - 16, pageHeight - 8.5, { align: 'right' });
  }
};

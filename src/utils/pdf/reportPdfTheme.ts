import jsPDF from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
import { businessClock } from '@/utils/businessClock';

applyPlugin(jsPDF);

export const DEFAULT_REPORT_LOGO_URL =
  'https://jqszxljtfuknhuvuheko.supabase.co/storage/v1/object/public/company-assets/public/logo-9431b8dc-aa03-47c4-abac-e5b0cb843772-1783457114194-logo%20512x512.png?t=1784935057516';
export const LOCAL_REPORT_LOGO_URL = '/logo-gruas-5-norte.png';

export const REPORT_PDF_COLORS = {
  primary: [108, 160, 60] as [number, number, number],
  primaryDark: [82, 128, 43] as [number, number, number],
  ink: [28, 28, 28] as [number, number, number],
  muted: [105, 105, 105] as [number, number, number],
  line: [198, 205, 194] as [number, number, number],
  soft: [244, 248, 238] as [number, number, number],
  total: [232, 240, 222] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  warning: [198, 96, 20] as [number, number, number],
};

export interface ReportCompany {
  name?: string | null;
  taxId?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
}

interface AutoTableDefaultsDocument extends jsPDF {
  autoTableSetDefaults?: (defaults: Record<string, unknown>) => void;
}

const blobToDataUrl = (blob: Blob): Promise<string | null> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });

const loadImage = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
};

const loadFirstAvailableImage = async (urls: Array<string | null | undefined>) => {
  const uniqueUrls = [...new Set(urls.filter((url): url is string => Boolean(url)))];
  for (const url of uniqueUrls) {
    const image = await loadImage(url);
    if (image) return image;
  }
  return null;
};

const imageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = () => resolve({ width: 160, height: 80 });
    image.src = dataUrl;
  });

const imageFormat = (dataUrl: string): 'PNG' | 'JPEG' =>
  dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';

export const applyReportTableDefaults = (doc: jsPDF) => {
  (doc as AutoTableDefaultsDocument).autoTableSetDefaults?.({
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: REPORT_PDF_COLORS.ink,
      lineColor: REPORT_PDF_COLORS.line,
      lineWidth: 0.1,
      cellPadding: 2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: REPORT_PDF_COLORS.primary,
      textColor: REPORT_PDF_COLORS.white,
      fontStyle: 'normal',
    },
    footStyles: {
      fillColor: REPORT_PDF_COLORS.total,
      textColor: REPORT_PDF_COLORS.ink,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: REPORT_PDF_COLORS.soft,
    },
  });
};

export const addReportHeader = async (
  doc: jsPDF,
  company: ReportCompany,
  logoUrl?: string | null,
): Promise<number> => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const bandHeight = 28;

  applyReportTableDefaults(doc);

  doc.setFillColor(...REPORT_PDF_COLORS.primary);
  doc.rect(0, 0, pageWidth, bandHeight, 'F');

  const logoUrls = logoUrl === null
    ? []
    : [logoUrl, company.logo, DEFAULT_REPORT_LOGO_URL, LOCAL_REPORT_LOGO_URL];
  let textX = margin;

  if (logoUrls.length > 0) {
    const logo = await loadFirstAvailableImage(logoUrls);
    if (logo) {
      try {
        const dimensions = await imageDimensions(logo);
        const logoInset = 1.5;
        const maxHeight = 17;
        const maxWidth = 31;
        const scale = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height);
        const width = dimensions.width * scale;
        const height = dimensions.height * scale;
        doc.addImage(
          logo,
          imageFormat(logo),
          margin + logoInset,
          (bandHeight - height) / 2,
          width,
          height,
        );
        textX = margin + logoInset + width + 7;
      } catch {
        // El nombre de la empresa mantiene el encabezado legible si el logo no puede embeberse.
      }
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...REPORT_PDF_COLORS.white);
  doc.text(company.name || 'Grúas 5 Norte', textX, 13);

  const identity = [
    company.taxId ? `RUT: ${company.taxId}` : '',
    company.address || '',
    company.phone || '',
    company.email || '',
  ].filter(Boolean).join(' · ');

  if (identity) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const availableWidth = Math.max(30, pageWidth - textX - margin);
    const line = doc.splitTextToSize(identity, availableWidth)[0];
    doc.text(line, textX, 19);
  }

  doc.setTextColor(...REPORT_PDF_COLORS.ink);
  doc.setFont('helvetica', 'normal');
  return 38;
};

export interface ReportFooterOptions {
  leftLines?: string[];
  generatedAt?: string;
}

export const addReportFooter = (doc: jsPDF, options: ReportFooterOptions = {}) => {
  const totalPages = doc.getNumberOfPages();
  const generatedAt = options.generatedAt || businessClock.format(businessClock.now(), 'dd/MM/yyyy HH:mm');

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const lineY = pageHeight - 16;

    doc.setDrawColor(...REPORT_PDF_COLORS.primaryDark);
    doc.setLineWidth(0.25);
    doc.line(margin, lineY, pageWidth - margin, lineY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...REPORT_PDF_COLORS.muted);

    const leftLines = (options.leftLines || []).slice(0, 2);
    leftLines.forEach((line, index) => {
      const wrapped = doc.splitTextToSize(line, Math.max(60, pageWidth * 0.55))[0];
      doc.text(wrapped, margin, lineY + 4 + index * 3.5);
    });

    doc.text(
      `Generado: ${generatedAt} · Página ${page} de ${totalPages}`,
      pageWidth - margin,
      lineY + 7.5,
      { align: 'right' },
    );
  }
};

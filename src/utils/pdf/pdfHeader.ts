import { businessClock } from '@/utils/businessClock';
import jsPDF from 'jspdf';
import { InspectionPDFData } from './pdfTypes';
import {
  applyReportTableDefaults,
  DEFAULT_REPORT_LOGO_URL,
  LOCAL_REPORT_LOGO_URL,
  REPORT_PDF_COLORS,
} from './reportPdfTheme';

const C = {
  green:      REPORT_PDF_COLORS.primary,
  greenLight: REPORT_PDF_COLORS.soft,
  gray:       [80, 80, 80]    as [number, number, number],
  grayLight:  [245, 245, 245] as [number, number, number],
  black:      [20, 20, 20]    as [number, number, number],
  white:      REPORT_PDF_COLORS.white,
};

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 100, height: 50 });
    img.src = base64;
  });

export const addPDFHeader = async (doc: jsPDF, data: InspectionPDFData): Promise<number> => {
  applyReportTableDefaults(doc);
  const isFinal = data.isFinal ?? false;
  const isInSitu = data.isInSitu ?? false;

  // ── Banda superior de color ───────────────────────────────────────────────
  doc.setFillColor(...C.green);
  doc.rect(0, 0, PAGE_W, 28, 'F');

  // ── Logo en la banda ─────────────────────────────────────────────────────
  let logoEndX = MARGIN;
  try {
    const logoBase64 = (data.companyData.logoUrl
      ? await loadImageAsBase64(data.companyData.logoUrl)
      : null)
      || await loadImageAsBase64(DEFAULT_REPORT_LOGO_URL)
      || await loadImageAsBase64(LOCAL_REPORT_LOGO_URL);
    if (logoBase64) {
      const { width: w, height: h } = await getImageDimensions(logoBase64);
      const scale = Math.min(31 / w, 17 / h);
      const logoW = w * scale;
      const logoH = h * scale;
      doc.addImage(logoBase64, 'PNG', MARGIN + 1.5, (28 - logoH) / 2, logoW, logoH);
      logoEndX = MARGIN + 1.5 + logoW + 7;
    }
  } catch { /* sin logo */ }

  // ── Nombre empresa en la banda ────────────────────────────────────────────
  doc.setTextColor(...C.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyData?.businessName || 'Grúas 5 Norte', logoEndX, 13);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `RUT: ${data.companyData?.rut || ''} · ${data.companyData?.address || ''} · Tel: ${data.companyData?.phone || ''}`,
    logoEndX, 21
  );

  // ── Tipo de documento (esquina derecha) ───────────────────────────────────
  const docLabel = isInSitu
    ? 'ACTA DE SERVICIO'
    : isFinal
      ? 'INFORME FINAL DE SERVICIO'
      : 'REPORTE DE INSPECCIÓN PRE-SERVICIO';
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.white);
  doc.text(docLabel, PAGE_W - MARGIN, 16, { align: 'right' });

  const y = 36;

  // ── Barra de metadatos: Folio / Fecha / Badge de estado ──────────────────
  doc.setFillColor(...C.grayLight);
  doc.rect(MARGIN, y, CONTENT_W, 10, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.rect(MARGIN, y, CONTENT_W, 10, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.green);
  doc.text(`Folio: ${data.service.folio || 'N/A'}`, MARGIN + 4, y + 6.5);

  const now = businessClock.format(businessClock.now(), 'dd/MM/yyyy HH:mm');
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado: ${now}`, PAGE_W / 2, y + 6.5, { align: 'center' });

  const badgeLabel = isInSitu ? 'SERVICIO COMPLETADO' : isFinal ? 'DOCUMENTO FINAL' : 'PRE-SERVICIO';
  const badgeColor: [number, number, number] = isInSitu
    ? REPORT_PDF_COLORS.primaryDark
    : isFinal
      ? REPORT_PDF_COLORS.primaryDark
      : [180, 100, 0];
  doc.setFillColor(...badgeColor);
  doc.roundedRect(PAGE_W - MARGIN - 38, y + 1.5, 36, 7, 2, 2, 'F');
  doc.setTextColor(...C.white);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(badgeLabel, PAGE_W - MARGIN - 20, y + 6.5, { align: 'center' });

  return y + 18;
};

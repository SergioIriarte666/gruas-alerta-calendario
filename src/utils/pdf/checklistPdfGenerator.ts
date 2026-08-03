/**
 * Generador ÚNICO de los PDF de checklist. Un solo motor para las dos
 * plantillas: lo que cambia entre el pre-operacional y el de fatiga lo resuelve
 * buildChecklistPdfPlan, no un segundo generador.
 *
 * Reutiliza el motor (jsPDF + jspdf-autotable) y los helpers de layout del acta
 * de inspección: addPDFHeader, drawSignatureBox y addReportFooter. Son
 * documentos probatorios de la misma empresa.
 *
 * Renderiza SIEMPRE desde items_snapshot: un PDF regenerado dentro de dos años
 * sale idéntico al que se firmó.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPDFHeader, PDF_HEADER_BADGE_COLORS } from './pdfHeader';
import { addReportFooter, REPORT_PDF_COLORS } from './reportPdfTheme';
import { drawSignatureBox } from './pdfSignatures';
import { fetchCompanyData, type CompanyData } from './companyDataFetcher';
import {
  buildChecklistPdfPlan,
  type ChecklistPdfContext,
  type ChecklistPdfPlan,
  type ChecklistPdfSource,
} from './checklistPdfPlan';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ChecklistPDF');

const MARGIN = 14;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

const C = {
  green: REPORT_PDF_COLORS.primary,
  greenDark: REPORT_PDF_COLORS.primaryDark,
  soft: REPORT_PDF_COLORS.soft,
  white: REPORT_PDF_COLORS.white,
  ink: [20, 20, 20] as [number, number, number],
  gray: [120, 120, 120] as [number, number, number],
  danger: [180, 50, 50] as [number, number, number],
};

const lastAutoTableY = (doc: jsPDF): number =>
  (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 0;

const sectionHeading = (doc: jsPDF, title: string, y: number): number => {
  doc.setFillColor(...C.green);
  doc.rect(MARGIN, y, 6, 9, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.green);
  doc.text(title.toUpperCase(), MARGIN + 10, y + 6.5);
  return y + 12;
};

/** Antecedentes en dos columnas de etiqueta/valor. */
const addAntecedents = (doc: jsPDF, plan: ChecklistPdfPlan, y: number): number => {
  if (plan.antecedents.length === 0) return y;

  let cursor = sectionHeading(doc, 'Antecedentes', y);

  const rows: Array<[string, string, string, string]> = [];
  for (let i = 0; i < plan.antecedents.length; i += 2) {
    const left = plan.antecedents[i];
    const right = plan.antecedents[i + 1] ?? ['', ''];
    rows.push([left[0], left[1], right[0], right[1]]);
  }

  autoTable(doc, {
    startY: cursor,
    body: rows,
    theme: 'grid',
    styles: { cellPadding: 2.2, fontSize: 8, textColor: C.ink },
    columnStyles: {
      0: { cellWidth: 34, fontStyle: 'bold', fillColor: REPORT_PDF_COLORS.soft },
      1: { cellWidth: 57 },
      2: { cellWidth: 34, fontStyle: 'bold', fillColor: REPORT_PDF_COLORS.soft },
      3: { cellWidth: 57 },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  cursor = lastAutoTableY(doc) + 8;
  return cursor;
};

/**
 * Tabla de ítems. CADA SECCIÓN dibuja su propia cabecera con las columnas que le
 * corresponden: en un mismo pre-operacional la sección documental lleva
 * VIGENTE / NO VIGENTE / N/A y las de estado físico BUENO / MALO / NO APLICA.
 */
const addSections = (doc: jsPDF, plan: ChecklistPdfPlan, y: number): number => {
  let cursor = y;

  plan.sections.forEach((section) => {
    const pageHeight = doc.internal.pageSize.height;
    if (cursor > pageHeight - 60) {
      doc.addPage();
      cursor = 20;
    }

    cursor = sectionHeading(doc, section.title, cursor);

    const head = plan.hasItemObservationColumn
      ? [['N°', 'Ítem', section.columns.positive, section.columns.negative, section.columns.na, 'OBSERVACIONES']]
      : [['N°', 'Ítem', section.columns.positive, section.columns.negative, section.columns.na]];

    const body = section.rows.map((row) => {
      const marks = [0, 1, 2].map((column) => (row.markedColumn === column ? 'X' : ''));
      return plan.hasItemObservationColumn
        ? [String(row.index), row.label, ...marks, '']
        : [String(row.index), row.label, ...marks];
    });

    // Las columnas de respuesta se dimensionan para que "NO VIGENTE" y
    // "NO APLICA (N/A)" quepan enteros: el rótulo nunca se abrevia.
    const answerColW = 24;
    const obsW = plan.hasItemObservationColumn ? 34 : 0;
    const labelW = CONTENT_W - 10 - answerColW * 3 - obsW;

    autoTable(doc, {
      startY: cursor,
      head,
      body,
      theme: 'grid',
      styles: { cellPadding: 2, fontSize: 7.5, textColor: C.ink, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: labelW },
        2: { cellWidth: answerColW, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: answerColW, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: answerColW, halign: 'center', fontStyle: 'bold' },
        ...(plan.hasItemObservationColumn ? { 5: { cellWidth: obsW, fontSize: 7 } } : {}),
      },
      headStyles: {
        fillColor: REPORT_PDF_COLORS.primary,
        textColor: REPORT_PDF_COLORS.white,
        fontStyle: 'bold',
        fontSize: 6.8,
        halign: 'center',
        valign: 'middle',
      },
      alternateRowStyles: { fillColor: REPORT_PDF_COLORS.soft },
      didParseCell: (hook) => {
        if (hook.section !== 'body') return;
        if (hook.column.index === 3 && hook.cell.text[0] === 'X') {
          // La respuesta negativa se lee de un vistazo: es la que obliga a actuar.
          hook.cell.styles.textColor = C.danger;
        }
        if (hook.column.index === 2 && hook.cell.text[0] === 'X') {
          hook.cell.styles.textColor = REPORT_PDF_COLORS.primaryDark;
        }
      },
      margin: { left: MARGIN, right: MARGIN },
    });

    cursor = lastAutoTableY(doc) + 7;
  });

  return cursor;
};

const addObservations = (doc: jsPDF, plan: ChecklistPdfPlan, y: number): number => {
  if (!plan.observations) return y;

  let cursor = y;
  const pageHeight = doc.internal.pageSize.height;
  if (cursor > pageHeight - 50) {
    doc.addPage();
    cursor = 20;
  }

  cursor = sectionHeading(doc, 'Observaciones generales', cursor);

  const lines = doc.splitTextToSize(plan.observations, CONTENT_W - 8);
  const boxH = Math.max(16, lines.length * 4.5 + 8);

  doc.setFillColor(...C.soft);
  doc.rect(MARGIN, cursor, CONTENT_W, boxH, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.rect(MARGIN, cursor, CONTENT_W, boxH, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.ink);
  doc.text(lines, MARGIN + 4, cursor + 6);

  return cursor + boxH + 8;
};

/** Pregunta de cierre del pre-operacional, con SÍ/NO marcado. */
const addClosingQuestion = (doc: jsPDF, plan: ChecklistPdfPlan, y: number): number => {
  if (!plan.closingQuestion) return y;

  let cursor = y;
  const pageHeight = doc.internal.pageSize.height;
  if (cursor > pageHeight - 40) {
    doc.addPage();
    cursor = 20;
  }

  const boxH = 18;
  doc.setDrawColor(...C.green);
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, cursor, CONTENT_W, boxH, 'S');
  doc.setLineWidth(0.2);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.greenDark);
  doc.text(plan.closingQuestion.text, MARGIN + 4, cursor + 11);

  const answer = plan.closingQuestion.answer;
  const drawOption = (label: string, x: number, marked: boolean) => {
    doc.setDrawColor(...C.ink);
    doc.rect(x, cursor + 6.5, 5, 5, 'S');
    if (marked) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(label === 'SI' ? C.greenDark : C.danger));
      doc.text('X', x + 2.5, cursor + 10.3, { align: 'center' });
    }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.ink);
    doc.setFontSize(8.5);
    doc.text(label, x + 7, cursor + 10.5);
  };

  drawOption('SI', PAGE_W - MARGIN - 42, answer === 'SI');
  drawOption('NO', PAGE_W - MARGIN - 20, answer === 'NO');

  if (answer === null) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.text('Sin respuesta registrada', MARGIN + 4, cursor + 16);
  }

  return cursor + boxH + 10;
};

const addSignatures = (doc: jsPDF, plan: ChecklistPdfPlan, y: number): number => {
  let cursor = y;
  const pageHeight = doc.internal.pageSize.height;
  if (cursor > pageHeight - 80) {
    doc.addPage();
    cursor = 20;
  }

  cursor = sectionHeading(doc, 'Firmas', cursor);

  // Un solo firmante ocupa media plana, no la plana entera: el ancho sale del
  // número real de bloques, así que no queda un recuadro estirado ni un hueco.
  const gap = 5;
  const columns = Math.max(plan.signatures.length, 2);
  const boxW = (CONTENT_W - gap * (columns - 1)) / columns;

  let maxH = 0;
  plan.signatures.forEach((block, index) => {
    const h = drawSignatureBox(doc, block, MARGIN + index * (boxW + gap), cursor, boxW);
    maxH = Math.max(maxH, h);
  });

  return cursor + maxH + 6;
};

const addFooterNote = (doc: jsPDF, plan: ChecklistPdfPlan, y: number): number => {
  if (!plan.footerNote) return y;

  let cursor = y;
  const pageHeight = doc.internal.pageSize.height;
  if (cursor > pageHeight - 30) {
    doc.addPage();
    cursor = 20;
  }

  const lines = doc.splitTextToSize(plan.footerNote, CONTENT_W - 8);
  const boxH = lines.length * 4.5 + 7;

  doc.setFillColor(...C.soft);
  doc.rect(MARGIN, cursor, CONTENT_W, boxH, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...C.ink);
  doc.text(lines, MARGIN + 4, cursor + 5.5);

  return cursor + boxH + 6;
};

export interface GenerateChecklistPdfInput {
  checklist: ChecklistPdfSource;
  context: ChecklistPdfContext;
  /** Se inyecta en los tests para no pegarle a la red. */
  companyData?: CompanyData;
}

/** Construye el documento y devuelve el jsPDF, para poder inspeccionarlo. */
export const buildChecklistPdfDocument = async (
  input: GenerateChecklistPdfInput,
): Promise<{ doc: jsPDF; plan: ChecklistPdfPlan }> => {
  const plan = buildChecklistPdfPlan(input.checklist, input.context);
  const companyData = input.companyData ?? await fetchCompanyData();

  const doc = new jsPDF();

  let cursor = await addPDFHeader(doc, companyData, {
    documentTitle: 'CHECKLIST DE SEGURIDAD',
    badge: { label: 'DOCUMENTO FIRMADO', color: PDF_HEADER_BADGE_COLORS.final },
    folio: plan.code,
    folioLabel: 'Código',
  });

  // Título del checklist bajo la barra de metadatos.
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.greenDark);
  const titleLines = doc.splitTextToSize(plan.documentTitle, CONTENT_W);
  doc.text(titleLines, MARGIN, cursor + 4);
  cursor += titleLines.length * 5 + 3;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.gray);
  doc.text(`Fecha: ${plan.performedLabel} · Versión de plantilla: ${plan.templateVersion}`, MARGIN, cursor + 3);
  cursor += 9;

  cursor = addAntecedents(doc, plan, cursor);
  cursor = addSections(doc, plan, cursor);
  cursor = addObservations(doc, plan, cursor);
  cursor = addClosingQuestion(doc, plan, cursor);
  cursor = addSignatures(doc, plan, cursor);
  addFooterNote(doc, plan, cursor);

  addReportFooter(doc, {
    leftLines: [
      `${companyData.businessName || 'Grúas 5 Norte'} · ${companyData.phone || ''}`.trim(),
      companyData.address || '',
    ].filter(Boolean),
    generatedAt: businessClock.format(businessClock.now(), 'dd/MM/yyyy HH:mm'),
  });

  return { doc, plan };
};

export const generateChecklistPDF = async (
  input: GenerateChecklistPdfInput,
): Promise<Blob> => {
  const { doc, plan } = await buildChecklistPdfDocument(input);
  logger.debug('PDF de checklist generado', {
    id: input.checklist.id,
    template: plan.templateId,
    version: plan.templateVersion,
    items: plan.totalItems,
    pages: doc.getNumberOfPages(),
  });
  return doc.output('blob');
};

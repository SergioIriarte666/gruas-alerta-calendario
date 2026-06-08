import jsPDF from 'jspdf';
import { manualChapters } from '@/data/userManualContent';

function sanitizeText(text: string): string {
  return text
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    .replace(/‘/g, "'")
    .replace(/’/g, "'")
    .replace(/…/g, '...')
    .replace(/•/g, '-')
    .replace(/ /g, ' ');
}

const hexToRgb = (hex: string) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

export function generateUserManualPDF(): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 0;

  const addPage = () => {
    doc.addPage();
    y = 20;
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 20) addPage();
  };

  // ── Portada ──────────────────────────────────────────────────────────────
  doc.setFillColor(30, 30, 30);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('NTMS', pageWidth / 2, 72, { align: 'center' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Manual de Usuario', pageWidth / 2, 85, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(180, 180, 180);
  doc.text('New Towing Software Manager', pageWidth / 2, 97, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Version 1.0  |  www.ntms.cl', pageWidth / 2, 107, { align: 'center' });

  // Línea separadora
  doc.setDrawColor(70, 70, 70);
  doc.setLineWidth(0.4);
  doc.line(marginLeft + 20, 118, pageWidth - marginRight - 20, 118);

  // Índice de capítulos en portada
  let indexY = 128;
  doc.setFontSize(8);
  for (const chapter of manualChapters) {
    const { r, g, b } = hexToRgb(chapter.color);
    doc.setTextColor(r, g, b);
    doc.text(
      sanitizeText(`Cap. ${chapter.number}  ${chapter.title}`),
      pageWidth / 2, indexY, { align: 'center' }
    );
    indexY += 8;
  }

  // Fecha generación
  const today = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(sanitizeText(`Generado el ${today}`), pageWidth / 2, pageHeight - 25, { align: 'center' });

  // ── Capítulos ─────────────────────────────────────────────────────────────
  for (const chapter of manualChapters) {
    addPage();

    const { r, g, b } = hexToRgb(chapter.color);

    // Encabezado coloreado
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageWidth, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(
      sanitizeText(`Capitulo ${chapter.number} - ${chapter.title}`),
      marginLeft, 12
    );
    y = 30;

    for (const section of chapter.sections) {
      checkPageBreak(20);

      // Título de sección
      doc.setTextColor(r, g, b);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(sanitizeText(section.title), marginLeft, y);
      y += 6;

      // Línea decorativa bajo título
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(0.5);
      doc.line(marginLeft, y, marginLeft + contentWidth, y);
      y += 7;

      // Contenido
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'normal');

      const paragraphs = section.content.split('\n').filter(p => p.trim() !== '');
      for (const paragraph of paragraphs) {
        const isNumberedStep = /^\d+\./.test(paragraph);

        if (isNumberedStep) {
          doc.setTextColor(r, g, b);
          doc.setFont('helvetica', 'bold');
          const stepLines = doc.splitTextToSize(sanitizeText(paragraph), contentWidth - 8);
          checkPageBreak(stepLines.length * 5.5 + 4);
          doc.text(stepLines, marginLeft + 4, y);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(40, 40, 40);
          y += stepLines.length * 5.5 + 3;
        } else {
          const lines = doc.splitTextToSize(sanitizeText(paragraph), contentWidth);
          checkPageBreak(lines.length * 5.5 + 4);
          doc.text(lines, marginLeft, y);
          y += lines.length * 5.5 + 3;
        }
      }

      // Separador sutil entre secciones
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(marginLeft, y + 2, marginLeft + contentWidth, y + 2);
      y += 10;
    }
  }

  // ── Pie de página en todas las páginas excepto portada ───────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text('NTMS - Manual de Usuario', marginLeft, pageHeight - 10);
    doc.text(
      `Pagina ${i - 1} de ${totalPages - 1}`,
      pageWidth - marginRight, pageHeight - 10, { align: 'right' }
    );
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 14, pageWidth - marginRight, pageHeight - 14);
  }

  doc.save('NTMS_Manual_Usuario.pdf');
}

import jsPDF from 'jspdf';
import { manualChapters } from '@/data/userManualContent';

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

  // Portada
  doc.setFillColor(30, 30, 30);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('NTMS', pageWidth / 2, 80, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Manual de Usuario', pageWidth / 2, 95, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(180, 180, 180);
  doc.text('New Towing Software Manager', pageWidth / 2, 108, { align: 'center' });
  doc.text('www.ntms.cl', pageWidth / 2, 118, { align: 'center' });
  doc.setFontSize(10);
  const today = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`Generado el ${today}`, pageWidth / 2, pageHeight - 30, { align: 'center' });

  const hexToRgb = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  });

  // Capítulos
  for (const chapter of manualChapters) {
    addPage();

    const { r, g, b } = hexToRgb(chapter.color);

    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageWidth, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Capítulo ${chapter.number} — ${chapter.title}`, marginLeft, 12);
    y = 30;

    for (const section of chapter.sections) {
      checkPageBreak(20);

      doc.setTextColor(r, g, b);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(section.title, marginLeft, y);
      y += 6;

      doc.setDrawColor(r, g, b);
      doc.setLineWidth(0.5);
      doc.line(marginLeft, y, marginLeft + contentWidth, y);
      y += 6;

      doc.setTextColor(40, 40, 40);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const paragraphs = section.content.split('\n').filter(p => p.trim() !== '');
      for (const paragraph of paragraphs) {
        const lines = doc.splitTextToSize(paragraph, contentWidth);
        checkPageBreak(lines.length * 5 + 4);
        doc.text(lines, marginLeft, y);
        y += lines.length * 5 + 3;
      }

      y += 8;
    }
  }

  // Pie de página en cada página (excepto portada)
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text('NTMS — Manual de Usuario', marginLeft, pageHeight - 10);
    doc.text(`Página ${i - 1} de ${totalPages - 1}`, pageWidth - marginRight, pageHeight - 10, { align: 'right' });
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 14, pageWidth - marginRight, pageHeight - 14);
  }

  doc.save('NTMS_Manual_Usuario.pdf');
}

import jsPDF from 'jspdf';
import { InspectionPDFData } from './pdfTypes';

const C = {
  green:     [0, 130, 100]   as [number, number, number],
  grayLight: [245, 245, 245] as [number, number, number],
  gray:      [120, 120, 120] as [number, number, number],
  black:     [20, 20, 20]    as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
};
const MARGIN = 14;
const PAGE_W = 210;

interface SignatureBlock {
  label: string;
  signature?: string;
  name?: string;
}

const drawSignatureBox = (
  doc: jsPDF,
  block: SignatureBlock,
  x: number,
  y: number,
  w: number,
): number => {
  const labelH = 8;
  const sigH = 32;
  const totalH = labelH + sigH + 8;

  // Etiqueta superior con fondo verde
  doc.setFillColor(...C.green);
  doc.roundedRect(x, y, w, labelH, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.white);
  doc.text(block.label.toUpperCase(), x + w / 2, y + 5.5, { align: 'center' });

  // Área de firma con fondo gris suave
  doc.setFillColor(...C.grayLight);
  doc.rect(x, y + labelH, w, sigH, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(x, y + labelH, w, sigH, 'S');

  if (block.signature) {
    try {
      doc.addImage(block.signature, 'PNG', x + 2, y + labelH + 2, w - 4, sigH - 4);
    } catch {
      doc.setFontSize(8);
      doc.setTextColor(...C.gray);
      doc.text('Error cargando firma', x + w / 2, y + labelH + sigH / 2, { align: 'center' });
    }
  } else {
    doc.setFontSize(7);
    doc.setTextColor(190, 190, 190);
    doc.text('Sin firma', x + w / 2, y + labelH + sigH / 2, { align: 'center' });
  }

  // Línea verde y nombre debajo
  doc.setDrawColor(...C.green);
  doc.setLineWidth(0.4);
  doc.line(x + 4, y + labelH + sigH + 4, x + w - 4, y + labelH + sigH + 4);
  doc.setLineWidth(0.2);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.black);
  doc.text(block.name || '—', x + w / 2, y + totalH + 2, { align: 'center' });

  return totalH + 6;
};

export const addDigitalSignatures = async (
  doc: jsPDF,
  data: InspectionPDFData,
  yPosition: number,
): Promise<number> => {
  const pageHeight = doc.internal.pageSize.height;

  if (yPosition > pageHeight - 80) {
    doc.addPage();
    yPosition = 20;
  }

  // Encabezado de sección con acento verde
  doc.setFillColor(...C.green);
  doc.rect(MARGIN, yPosition, 6, 10, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.green);
  doc.text('FIRMAS DIGITALES', MARGIN + 10, yPosition + 7);
  yPosition += 14;

  const blocks: SignatureBlock[] = [
    {
      label: 'Firma del Operador',
      signature: data.inspection.operatorSignature,
      name: data.inspection.operatorName || data.service.operator?.name || 'Operador',
    },
    {
      label: 'Firma del Cliente',
      signature: data.inspection.clientSignature,
      name: data.inspection.clientName || 'Cliente',
    },
    {
      label: 'Recepción del Vehículo',
      signature: data.inspection.vehicleReceptionSignature,
      name: data.inspection.receptionPersonName || 'Recepción',
    },
  ];

  const gap = 5;
  const boxW = (PAGE_W - MARGIN * 2 - gap * (blocks.length - 1)) / blocks.length;

  let maxH = 0;
  blocks.forEach((block, i) => {
    const h = drawSignatureBox(doc, block, MARGIN + i * (boxW + gap), yPosition, boxW);
    maxH = Math.max(maxH, h);
  });

  return yPosition + maxH + 8;
};

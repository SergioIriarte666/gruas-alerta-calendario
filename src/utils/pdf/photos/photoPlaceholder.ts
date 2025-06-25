
import jsPDF from 'jspdf';

export const drawPhotoPlaceholder = (
  doc: jsPDF, 
  x: number, 
  y: number, 
  width: number, 
  height: number, 
  message: string
) => {
  // Dibujar rectángulo con patrón
  doc.setDrawColor(180, 180, 180);
  doc.setFillColor(250, 250, 250);
  doc.rect(x, y, width, height, 'FD');
  
  // Dibujar X cruzada
  doc.setDrawColor(200, 200, 200);
  doc.line(x, y, x + width, y + height);
  doc.line(x + width, y, x, y + height);
  
  // Texto centrado
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const textX = x + width / 2;
  const textY = y + height / 2;
  doc.text(message, textX, textY, { align: 'center' });
  doc.text('Foto no disponible', textX, textY + 8, { align: 'center' });
};

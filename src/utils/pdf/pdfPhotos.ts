
import jsPDF from 'jspdf';

export const addPhotosSection = async (
  doc: jsPDF, 
  title: string, 
  photoNames: string[], 
  yPosition: number
): Promise<number> => {
  if (photoNames.length === 0) return yPosition;

  const pageWidth = doc.internal.pageSize.width;

  // Verificar si necesitamos nueva página
  if (yPosition > 240) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(14);
  doc.setTextColor(0, 150, 136);
  doc.text(title, 20, yPosition);
  yPosition += 10;

  let photosPerRow = 2;
  let photoWidth = (pageWidth - 60) / photosPerRow;
  let photoHeight = photoWidth * 0.75;

  for (let i = 0; i < photoNames.length; i += photosPerRow) {
    // Verificar espacio para fotos
    if (yPosition + photoHeight > 280) {
      doc.addPage();
      yPosition = 20;
    }

    for (let j = 0; j < photosPerRow && i + j < photoNames.length; j++) {
      const photoName = photoNames[i + j];
      const photoData = localStorage.getItem(`photo-${photoName}`);
      
      if (photoData) {
        try {
          const xPos = 20 + j * (photoWidth + 10);
          doc.addImage(photoData, 'JPEG', xPos, yPosition, photoWidth, photoHeight);
          
          // Agregar nombre de archivo debajo de la foto
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(photoName, xPos, yPosition + photoHeight + 5);
        } catch (error) {
          console.warn(`Error al agregar foto ${photoName}:`, error);
        }
      }
    }
    yPosition += photoHeight + 15;
  }
  yPosition += 10;

  return yPosition;
};

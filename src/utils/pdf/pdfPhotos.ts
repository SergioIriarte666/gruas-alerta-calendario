
import jsPDF from 'jspdf';
import { compressImageForPDF } from './photos/photoProcessor';
import { drawPhotoPlaceholder } from './photos/photoPlaceholder';
import { getPhotoFromStorage } from './photos/photoStorage';

export const addPhotosSection = async (
  doc: jsPDF, 
  title: string, 
  photoNames: string[], 
  yPosition: number
): Promise<number> => {
  if (!photoNames || photoNames.length === 0) {
    console.log(`No hay fotos para la sección: ${title}`);
    return yPosition;
  }

  const pageWidth = doc.internal.pageSize.width;
  console.log(`Procesando sección de fotos: ${title} con ${photoNames.length} fotos`);

  try {
    // Verificar si necesitamos nueva página
    if (yPosition > 240) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 150, 136);
    doc.text(title, 20, yPosition);
    yPosition += 15;

    let photosPerRow = 2;
    let photoWidth = (pageWidth - 60) / photosPerRow;
    let photoHeight = photoWidth * 0.75;

    let validPhotosAdded = 0;

    for (let i = 0; i < photoNames.length; i += photosPerRow) {
      // Verificar espacio para fotos
      if (yPosition + photoHeight + 20 > 280) {
        doc.addPage();
        yPosition = 20;
        
        // Repetir título en nueva página
        doc.setFontSize(14);
        doc.setTextColor(0, 150, 136);
        doc.text(`${title} (continuación)`, 20, yPosition);
        yPosition += 15;
      }

      for (let j = 0; j < photosPerRow && i + j < photoNames.length; j++) {
        const photoName = photoNames[i + j];
        const xPos = 20 + j * (photoWidth + 10);
        
        try {
          const photoData = getPhotoFromStorage(photoName);
          
          if (photoData) {
            try {
              // Comprimir imagen para PDF
              const compressedImageData = await compressImageForPDF(photoData);
              doc.addImage(compressedImageData, 'JPEG', xPos, yPosition, photoWidth, photoHeight);
              
              // Agregar borde
              doc.setDrawColor(200, 200, 200);
              doc.rect(xPos, yPosition, photoWidth, photoHeight);
              
              // Agregar timestamp en la esquina
              doc.setFontSize(7);
              doc.setTextColor(255, 255, 255);
              doc.setDrawColor(0, 0, 0);
              doc.setFillColor(0, 0, 0);
              doc.rect(xPos + 2, yPosition + photoHeight - 12, 45, 10, 'F');
              doc.text(new Date().toLocaleString('es-CL'), xPos + 4, yPosition + photoHeight - 5);
              
              validPhotosAdded++;
              console.log(`Foto agregada exitosamente: ${photoName}`);
            } catch (imageError) {
              console.error(`Error al agregar imagen ${photoName}:`, imageError);
              drawPhotoPlaceholder(doc, xPos, yPosition, photoWidth, photoHeight, 'Error al cargar');
            }
          } else {
            console.warn(`Foto no encontrada en localStorage: ${photoName}`);
            drawPhotoPlaceholder(doc, xPos, yPosition, photoWidth, photoHeight, 'Foto no disponible');
          }
          
          // Agregar nombre de archivo debajo
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          const shortName = photoName.length > 20 ? photoName.substring(0, 20) + '...' : photoName;
          doc.text(shortName, xPos, yPosition + photoHeight + 8);
        } catch (error) {
          console.error(`Error al procesar foto ${photoName}:`, error);
          drawPhotoPlaceholder(doc, xPos, yPosition, photoWidth, photoHeight, 'Error de procesamiento');
        }
      }
      yPosition += photoHeight + 20;
    }

    // Agregar resumen de fotos
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Fotos procesadas: ${validPhotosAdded} de ${photoNames.length} | Sección: ${title}`, 20, yPosition);
    yPosition += 10;

    console.log(`Sección ${title} completada. Fotos procesadas: ${validPhotosAdded}/${photoNames.length}`);
    return yPosition;
  } catch (error) {
    console.error(`Error crítico en addPhotosSection para ${title}:`, error);
    return yPosition + 50;
  }
};

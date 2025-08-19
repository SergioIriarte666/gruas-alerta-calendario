
import jsPDF from 'jspdf';
import { compressImageForPDF } from './photos/photoProcessor';
import { drawPhotoPlaceholder } from './photos/photoPlaceholder';
import { getPhotoFromStorage } from './photos/photoStorage';

export const addPhotographicSetSection = async (
  doc: jsPDF, 
  photographicSet: Array<{
    fileName: string;
    category: 'izquierdo' | 'derecho' | 'frontal' | 'trasero' | 'interior' | 'motor';
  }>, 
  yPosition: number
): Promise<number> => {
  if (!photographicSet || photographicSet.length === 0) {
    console.log('No hay fotos en el set fotográfico');
    return yPosition;
  }

  const pageWidth = doc.internal.pageSize.width;
  console.log(`Procesando Set Fotográfico con ${photographicSet.length} fotos`);

  try {
    // Verificar si necesitamos nueva página
    if (yPosition > 240) {
      doc.addPage();
      yPosition = 20;
    }

    // Título principal
    doc.setFontSize(14);
    doc.setTextColor(0, 150, 136);
    doc.text('SET FOTOGRÁFICO', 20, yPosition);
    yPosition += 15;

    // Organizar fotos por categoría
    const categoryOrder = ['izquierdo', 'derecho', 'frontal', 'trasero', 'interior', 'motor'];
    const categoryLabels = {
      'izquierdo': 'Vista Izquierda',
      'derecho': 'Vista Derecha', 
      'frontal': 'Vista Frontal',
      'trasero': 'Vista Trasera',
      'interior': 'Vista Interior',
      'motor': 'Vista Motor'
    };

    const organizedPhotos = categoryOrder.map(category => ({
      category: category as any,
      label: categoryLabels[category as keyof typeof categoryLabels],
      photo: photographicSet.find(p => p.category === category)
    })).filter(item => item.photo);

    // Configuración de layout
    const photosPerRow = 2;
    const photoWidth = (pageWidth - 60) / photosPerRow;
    const photoHeight = photoWidth * 0.75;

    let validPhotosAdded = 0;
    let currentRow = 0;

    for (let i = 0; i < organizedPhotos.length; i += photosPerRow) {
      // Verificar espacio para nueva fila de fotos
      if (yPosition + photoHeight + 40 > 280) {
        doc.addPage();
        yPosition = 20;
        
        // Repetir título en nueva página
        doc.setFontSize(14);
        doc.setTextColor(0, 150, 136);
        doc.text('SET FOTOGRÁFICO (continuación)', 20, yPosition);
        yPosition += 15;
      }

      // Procesar fotos de la fila actual
      for (let j = 0; j < photosPerRow && i + j < organizedPhotos.length; j++) {
        const item = organizedPhotos[i + j];
        const xPos = 20 + j * (photoWidth + 10);
        
        // Título de la categoría
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text(item.label, xPos, yPosition);
        
        try {
          const photoData = getPhotoFromStorage(item.photo!.fileName);
          
          if (photoData) {
            try {
              // Comprimir imagen para PDF
              const compressedImageData = await compressImageForPDF(photoData);
              doc.addImage(compressedImageData, 'JPEG', xPos, yPosition + 5, photoWidth, photoHeight);
              
              // Agregar borde
              doc.setDrawColor(200, 200, 200);
              doc.rect(xPos, yPosition + 5, photoWidth, photoHeight);
              
              // Agregar timestamp en la esquina
              doc.setFontSize(7);
              doc.setTextColor(255, 255, 255);
              doc.setDrawColor(0, 0, 0);
              doc.setFillColor(0, 0, 0);
              doc.rect(xPos + 2, yPosition + photoHeight - 7, 45, 10, 'F');
              doc.text(new Date().toLocaleString('es-CL'), xPos + 4, yPosition + photoHeight);
              
              validPhotosAdded++;
              console.log(`Foto agregada exitosamente: ${item.photo!.fileName} (${item.category})`);
            } catch (imageError) {
              console.error(`Error al agregar imagen ${item.photo!.fileName}:`, imageError);
              drawPhotoPlaceholder(doc, xPos, yPosition + 5, photoWidth, photoHeight, 'Error al cargar');
            }
          } else {
            console.warn(`Foto no encontrada: ${item.photo!.fileName}`);
            drawPhotoPlaceholder(doc, xPos, yPosition + 5, photoWidth, photoHeight, 'Foto no disponible');
          }
        } catch (error) {
          console.error(`Error al procesar foto ${item.photo!.fileName}:`, error);
          drawPhotoPlaceholder(doc, xPos, yPosition + 5, photoWidth, photoHeight, 'Error de procesamiento');
        }
      }
      
      yPosition += photoHeight + 25;
      currentRow++;
    }

    // Agregar resumen
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Set fotográfico: ${validPhotosAdded} de ${organizedPhotos.length} fotos procesadas`, 20, yPosition);
    yPosition += 10;

    console.log(`Set fotográfico completado. Fotos procesadas: ${validPhotosAdded}/${organizedPhotos.length}`);
    return yPosition;
  } catch (error) {
    console.error('Error crítico en addPhotographicSetSection:', error);
    return yPosition + 50;
  }
};

// Mantener función legacy para compatibilidad temporal
export const addPhotosSection = async (
  doc: jsPDF, 
  title: string, 
  photoNames: string[], 
  yPosition: number
): Promise<number> => {
  console.warn('addPhotosSection está deprecated, usa addPhotographicSetSection');
  return addPhotographicSetSection(doc, photoNames.map(fileName => ({
    fileName,
    category: 'frontal' // Categoría por defecto para compatibilidad
  })), yPosition);
};

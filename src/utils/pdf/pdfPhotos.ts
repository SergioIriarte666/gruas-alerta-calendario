
import jsPDF from 'jspdf';

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

  try {
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
        
        try {
          // Validar que el nombre de la foto existe
          if (!photoName || typeof photoName !== 'string') {
            console.warn(`Nombre de foto inválido: ${photoName}`);
            continue;
          }

          const photoData = localStorage.getItem(`photo-${photoName}`);
          
          if (photoData && photoData.startsWith('data:image')) {
            const xPos = 20 + j * (photoWidth + 10);
            
            // Verificar que la imagen sea válida antes de agregarla
            const img = new Image();
            img.onload = () => {
              try {
                doc.addImage(photoData, 'JPEG', xPos, yPosition, photoWidth, photoHeight);
                console.log(`Foto agregada exitosamente: ${photoName}`);
              } catch (imageError) {
                console.error(`Error al agregar imagen ${photoName}:`, imageError);
                // Dibujar placeholder en caso de error
                doc.setDrawColor(200, 200, 200);
                doc.rect(xPos, yPosition, photoWidth, photoHeight);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text('Error al cargar imagen', xPos + 10, yPosition + photoHeight / 2);
              }
            };
            
            img.onerror = () => {
              console.error(`Imagen corrupta: ${photoName}`);
              // Dibujar placeholder para imagen corrupta
              const xPos = 20 + j * (photoWidth + 10);
              doc.setDrawColor(200, 200, 200);
              doc.rect(xPos, yPosition, photoWidth, photoHeight);
              doc.setFontSize(8);
              doc.setTextColor(150, 150, 150);
              doc.text('Imagen corrupta', xPos + 10, yPosition + photoHeight / 2);
            };
            
            // Intentar cargar la imagen de forma síncrona para PDF
            doc.addImage(photoData, 'JPEG', xPos, yPosition, photoWidth, photoHeight);
            
            // Agregar nombre de archivo debajo de la foto
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(photoName, xPos, yPosition + photoHeight + 5);
            console.log(`Foto procesada: ${photoName}`);
          } else {
            console.warn(`No se encontró la foto en localStorage o formato inválido: ${photoName}`);
            // Dibujar un rectángulo placeholder
            const xPos = 20 + j * (photoWidth + 10);
            doc.setDrawColor(200, 200, 200);
            doc.rect(xPos, yPosition, photoWidth, photoHeight);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('Foto no disponible', xPos + 10, yPosition + photoHeight / 2);
            doc.text(photoName, xPos, yPosition + photoHeight + 5);
          }
        } catch (error) {
          console.error(`Error al procesar foto ${photoName}:`, error);
          // Continuar con la siguiente foto sin interrumpir el proceso
          const xPos = 20 + j * (photoWidth + 10);
          doc.setDrawColor(255, 0, 0);
          doc.rect(xPos, yPosition, photoWidth, photoHeight);
          doc.setFontSize(8);
          doc.setTextColor(255, 0, 0);
          doc.text('Error de procesamiento', xPos + 5, yPosition + photoHeight / 2);
        }
      }
      yPosition += photoHeight + 15;
    }
    yPosition += 10;

    return yPosition;
  } catch (error) {
    console.error(`Error en addPhotosSection para ${title}:`, error);
    // Retornar una posición segura en caso de error
    return yPosition + 50;
  }
};

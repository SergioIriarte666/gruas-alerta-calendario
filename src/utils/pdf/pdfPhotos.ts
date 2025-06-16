
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

    let validPhotosAdded = 0;

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
            
            try {
              // Comprimir imagen si es muy grande
              const compressedImageData = await compressImageForPDF(photoData);
              doc.addImage(compressedImageData, 'JPEG', xPos, yPosition, photoWidth, photoHeight);
              
              // Agregar watermark con timestamp
              doc.setFontSize(8);
              doc.setTextColor(255, 255, 255);
              doc.text(new Date().toLocaleString('es-CL'), xPos + 2, yPosition + photoHeight - 2);
              
              // Agregar nombre de archivo debajo de la foto
              doc.setFontSize(8);
              doc.setTextColor(100, 100, 100);
              doc.text(photoName, xPos, yPosition + photoHeight + 5);
              
              validPhotosAdded++;
              console.log(`Foto procesada exitosamente: ${photoName}`);
            } catch (imageError) {
              console.error(`Error al agregar imagen ${photoName}:`, imageError);
              // Dibujar placeholder en caso de error
              drawPhotoPlaceholder(doc, xPos, yPosition, photoWidth, photoHeight, 'Error al cargar imagen');
            }
          } else {
            console.warn(`No se encontró la foto en localStorage o formato inválido: ${photoName}`);
            // Dibujar un rectángulo placeholder
            const xPos = 20 + j * (photoWidth + 10);
            drawPhotoPlaceholder(doc, xPos, yPosition, photoWidth, photoHeight, 'Foto no disponible');
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(photoName, xPos, yPosition + photoHeight + 5);
          }
        } catch (error) {
          console.error(`Error al procesar foto ${photoName}:`, error);
          // Continuar con la siguiente foto sin interrumpir el proceso
          const xPos = 20 + j * (photoWidth + 10);
          drawPhotoPlaceholder(doc, xPos, yPosition, photoWidth, photoHeight, 'Error de procesamiento');
        }
      }
      yPosition += photoHeight + 15;
    }

    // Agregar resumen de fotos
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Total de fotos procesadas: ${validPhotosAdded} de ${photoNames.length}`, 20, yPosition);
    yPosition += 10;

    return yPosition;
  } catch (error) {
    console.error(`Error en addPhotosSection para ${title}:`, error);
    // Retornar una posición segura en caso de error
    return yPosition + 50;
  }
};

const compressImageForPDF = async (imageData: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(imageData); // Return original if compression fails
          return;
        }
        
        // Calcular nuevas dimensiones manteniendo aspect ratio
        const maxWidth = 800;
        const maxHeight = 600;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Dibujar imagen redimensionada
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convertir a JPEG con calidad reducida
        const compressedData = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedData);
      };
      
      img.onerror = () => {
        console.warn('Error comprimiendo imagen, usando original');
        resolve(imageData);
      };
      
      img.src = imageData;
    } catch (error) {
      console.warn('Error en compresión de imagen:', error);
      resolve(imageData);
    }
  });
};

const drawPhotoPlaceholder = (
  doc: jsPDF, 
  x: number, 
  y: number, 
  width: number, 
  height: number, 
  message: string
) => {
  doc.setDrawColor(200, 200, 200);
  doc.rect(x, y, width, height);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(message, x + 10, y + height / 2);
};

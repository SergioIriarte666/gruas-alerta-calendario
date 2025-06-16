
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
        
        try {
          if (!photoName || typeof photoName !== 'string') {
            console.warn(`Nombre de foto inválido: ${photoName}`);
            continue;
          }

          // Verificar múltiples posibles claves en localStorage
          let photoData = localStorage.getItem(`photo-${photoName}`);
          
          // Si no se encuentra, intentar solo con el nombre
          if (!photoData) {
            photoData = localStorage.getItem(photoName);
          }
          
          console.log(`Buscando foto: photo-${photoName}, encontrada: ${!!photoData}`);
          
          if (photoData && photoData.startsWith('data:image')) {
            const xPos = 20 + j * (photoWidth + 10);
            
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
              
              // Agregar nombre de archivo debajo
              doc.setFontSize(8);
              doc.setTextColor(100, 100, 100);
              const shortName = photoName.length > 20 ? photoName.substring(0, 20) + '...' : photoName;
              doc.text(shortName, xPos, yPosition + photoHeight + 8);
              
              validPhotosAdded++;
              console.log(`Foto agregada exitosamente: ${photoName}`);
            } catch (imageError) {
              console.error(`Error al agregar imagen ${photoName}:`, imageError);
              const xPos = 20 + j * (photoWidth + 10);
              drawPhotoPlaceholder(doc, xPos, yPosition, photoWidth, photoHeight, 'Error al cargar');
            }
          } else {
            console.warn(`Foto no encontrada en localStorage: ${photoName}`);
            const xPos = 20 + j * (photoWidth + 10);
            drawPhotoPlaceholder(doc, xPos, yPosition, photoWidth, photoHeight, 'Foto no disponible');
            
            // Agregar nombre debajo del placeholder
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            const shortName = photoName.length > 20 ? photoName.substring(0, 20) + '...' : photoName;
            doc.text(shortName, xPos, yPosition + photoHeight + 8);
          }
        } catch (error) {
          console.error(`Error al procesar foto ${photoName}:`, error);
          const xPos = 20 + j * (photoWidth + 10);
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

const compressImageForPDF = async (imageData: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.warn('No se pudo obtener contexto 2D, usando imagen original');
          resolve(imageData);
          return;
        }
        
        // Calcular nuevas dimensiones
        const maxWidth = 600;
        const maxHeight = 450;
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
        
        // Dibujar imagen optimizada
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convertir con buena calidad
        const compressedData = canvas.toDataURL('image/jpeg', 0.85);
        console.log(`Imagen comprimida: ${imageData.length} -> ${compressedData.length} caracteres`);
        resolve(compressedData);
      };
      
      img.onerror = () => {
        console.warn('Error comprimiendo imagen, usando original');
        resolve(imageData);
      };
      
      img.src = imageData;
    } catch (error) {
      console.warn('Error en compresión:', error);
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

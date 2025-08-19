import jsPDF from 'jspdf';
import { InspectionPDFData } from './pdfTypes';

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    console.log('Cargando imagen desde:', url);
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('Error al cargar imagen:', response.status);
      return null;
    }
    
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Error procesando imagen:', error);
    return null;
  }
};

const getImageDimensions = (base64: string): Promise<{width: number, height: number}> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      resolve({ width: 100, height: 50 }); // Dimensiones por defecto
    };
    img.src = base64;
  });
};

const calculateLogoDimensions = (originalWidth: number, originalHeight: number, maxWidth: number = 50, maxHeight: number = 30) => {
  // Calcular el ratio de aspecto
  const aspectRatio = originalWidth / originalHeight;
  
  let width = maxWidth;
  let height = maxWidth / aspectRatio;
  
  // Si la altura calculada excede el máximo, ajustar por altura
  if (height > maxHeight) {
    height = maxHeight;
    width = maxHeight * aspectRatio;
  }
  
  return { width, height };
};

export const addPDFHeader = async (doc: jsPDF, data: InspectionPDFData): Promise<number> => {
  const pageWidth = doc.internal.pageSize.width;
  let yPosition = 20;

  try {
    // Intentar cargar y agregar logo si está disponible
    if (data.companyData?.logoUrl) {
      try {
        console.log('Intentando cargar logo:', data.companyData.logoUrl);
        const logoBase64 = await loadImageAsBase64(data.companyData.logoUrl);
        
        if (logoBase64) {
          console.log('Logo cargado exitosamente, calculando dimensiones...');
          
          // Obtener dimensiones originales de la imagen
          const { width: originalWidth, height: originalHeight } = await getImageDimensions(logoBase64);
          console.log('Dimensiones originales:', { originalWidth, originalHeight });
          
          // Calcular dimensiones manteniendo proporciones (máximo 50x30)
          const { width: logoWidth, height: logoHeight } = calculateLogoDimensions(
            originalWidth, 
            originalHeight, 
            50, // Ancho máximo
            30  // Alto máximo
          );
          
          console.log('Dimensiones calculadas para PDF:', { logoWidth, logoHeight });
          
          // Agregar logo en la esquina superior izquierda con proporciones correctas
          doc.addImage(logoBase64, 'PNG', 20, yPosition, logoWidth, logoHeight);
          
          // Ajustar posición del texto para dar espacio al logo
          yPosition += Math.max(logoHeight + 5, 25);
        } else {
          console.warn('No se pudo cargar el logo, continuando sin él');
        }
      } catch (error) {
        console.warn('Error al procesar logo:', error);
      }
    }

    // Header principal mejorado
    doc.setFontSize(18);
    doc.setTextColor(0, 150, 136); // tms-green
    doc.text('REPORTE DE INSPECCION PRE-SERVICIO', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // Información de la empresa
    if (data.companyData) {
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(data.companyData.businessName, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`RUT: ${data.companyData.rut}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 6;
      
      doc.text(`${data.companyData.address}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;
      
      doc.text(`Tel: ${data.companyData.phone} | Email: ${data.companyData.email}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
    }

    // Línea separadora
    doc.setDrawColor(0, 150, 136);
    doc.setLineWidth(0.5);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 10;

    // Información del documento
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const now = new Date();
    const timestamp = now.toLocaleString('es-CL');
    doc.text(`Documento generado: ${timestamp}`, pageWidth - 20, yPosition, { align: 'right' });
    doc.text(`Folio: ${data.service.folio || 'N/A'}`, 20, yPosition);
    yPosition += 15;

    console.log('Header corporativo agregado correctamente');
    return yPosition;
  } catch (error) {
    console.error('Error en addPDFHeader:', error);
    return yPosition + 50; // Fallback position
  }
};
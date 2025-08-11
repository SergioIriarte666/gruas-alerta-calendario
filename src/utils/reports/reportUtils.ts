
import { Settings } from '@/types/settings';

export const createExportFileName = (prefix: string, dateFrom: string, dateTo: string): string => {
  return `${prefix}-${dateFrom}-a-${dateTo}`;
};

export const addCompanyHeader = async (doc: any, company: Settings['company'], startY: number): Promise<number> => {
  const pageWidth = doc.internal.pageSize.width;
  let yPosition = startY;

  // Logo de la empresa
  try {
    // Usar el logo desde company.logo si existe, sino usar un logo por defecto
    const logoUrl = company.logo || '/lovable-uploads/78862b77-e5f2-481b-a598-e35d7aca2690.png';
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = logoUrl;
    await new Promise((resolve, reject) => {
      img.onload = () => {
        const logoWidth = 35;
        const logoHeight = (img.height * logoWidth) / img.width;
        doc.addImage(img, 'PNG', pageWidth - 14 - logoWidth, yPosition, logoWidth, logoHeight);
        resolve(true);
      };
      img.onerror = (e) => {
        console.warn("Error loading logo for PDF, using text instead", e);
        resolve(true); // Continue without logo
      };
    });
  } catch (e) {
    console.warn("Could not add logo to PDF, using text fallback.", e);
  }
  
  // Información de la empresa
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(company.name || 'Grúas 5 Norte', 14, yPosition + 7);
  doc.setFont(undefined, 'normal');

  doc.setFontSize(9);
  doc.setTextColor(100);
  
  // Solo mostrar datos si existen
  if (company.taxId) {
    doc.text(`RUT: ${company.taxId}`, 14, yPosition + 14);
  }
  
  let nextLineY = yPosition + (company.taxId ? 19 : 14);
  
  if (company.address) {
    doc.text(company.address, 14, nextLineY);
    nextLineY += 5;
  }
  
  if (company.phone || company.email) {
    const contactInfo = [];
    if (company.phone) contactInfo.push(`Tel: ${company.phone}`);
    if (company.email) contactInfo.push(`Email: ${company.email}`);
    doc.text(contactInfo.join(' | '), 14, nextLineY);
    nextLineY += 5;
  }
  
  return nextLineY + 10;
};

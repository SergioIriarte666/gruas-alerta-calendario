
import { Settings } from '@/types/settings';
import { createLogger } from "@/lib/logger";


const logger = createLogger("reportUtils");
export const createExportFileName = (prefix: string, dateFrom: string, dateTo: string): string => {
  return `${prefix}-${dateFrom}-a-${dateTo}`;
};

export const addCompanyHeader = async (doc: any, company: Settings['company'], startY: number, logoUrl?: string | null): Promise<number> => {
  const pageWidth = doc.internal.pageSize.width;
  const yPosition = startY;

  // Logo de la empresa
  if (logoUrl !== null) {
    try {
      const finalLogoUrl = logoUrl || company.logo || '/logo-gruas-5-norte.png';
      logger.debug('📄 [REPORT-HEADER] Usando logo:', finalLogoUrl);
      
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = finalLogoUrl;
      await new Promise((resolve) => {
        img.onload = () => {
          const logoWidth = 35;
          const logoHeight = (img.height * logoWidth) / img.width;
          doc.addImage(img, 'PNG', pageWidth - 14 - logoWidth, yPosition, logoWidth, logoHeight);
          resolve(true);
        };
        img.onerror = (e) => {
          logger.warn("Error loading logo for PDF, using text instead", e);
          resolve(true);
        };
      });
    } catch (e) {
      logger.warn("Could not add logo to PDF, using text fallback.", e);
    }
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


import { Settings } from '@/types/settings';

export const createExportFileName = (prefix: string, dateFrom: string, dateTo: string): string => {
  return `${prefix}-${dateFrom}-a-${dateTo}`;
};

export const addCompanyHeader = async (doc: any, company: Settings['company'], startY: number): Promise<number> => {
  const pageWidth = doc.internal.pageSize.width;
  let yPosition = startY;

  // Logo
  if (company.logo) {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = company.logo;
      await new Promise((resolve, reject) => {
        img.onload = () => {
          const logoWidth = 35;
          const logoHeight = (img.height * logoWidth) / img.width;
          doc.addImage(img, 'PNG', pageWidth - 14 - logoWidth, yPosition, logoWidth, logoHeight);
          resolve(true);
        };
        img.onerror = (e) => {
          console.error("Error loading logo for PDF", e);
          reject(e);
        };
      });
    } catch (e) {
      console.error("Could not add logo to PDF.", e);
    }
  }
  
  // Company Info
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(company.name, 14, yPosition + 7);
  doc.setFont(undefined, 'normal');

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`RUT: ${company.taxId}`, 14, yPosition + 14);
  doc.text(company.address, 14, yPosition + 19);
  doc.text(`Tel: ${company.phone} | Email: ${company.email}`, 14, yPosition + 24);
  
  return yPosition + 40;
};

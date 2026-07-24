import { Settings } from '@/types/settings';
import type jsPDF from 'jspdf';
import {
  addReportFooter,
  addReportHeader,
  REPORT_PDF_COLORS,
  type ReportFooterOptions,
} from '@/utils/pdf/reportPdfTheme';
import { fetchCompanyData } from '@/utils/pdf/companyDataFetcher';

export { REPORT_PDF_COLORS };

export const createExportFileName = (prefix: string, dateFrom: string, dateTo: string): string => {
  return `${prefix}-${dateFrom}-a-${dateTo}`;
};

export const addCompanyHeader = async (doc: any, company: Settings['company'], startY: number, logoUrl?: string | null): Promise<number> => {
  void startY;

  if (logoUrl !== undefined) {
    return addReportHeader(doc as jsPDF, company, logoUrl);
  }

  const companyData = await fetchCompanyData(company);
  return addReportHeader(doc as jsPDF, {
    name: companyData.businessName,
    taxId: companyData.rut,
    address: companyData.address,
    phone: companyData.phone,
    email: companyData.email,
    logo: companyData.logoUrl,
  });
};

export const addStandardReportFooter = (
  doc: jsPDF,
  options?: ReportFooterOptions,
) => addReportFooter(doc, options);

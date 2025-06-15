
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Service } from '@/types';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export interface InspectionPDFData {
  service: Service;
  inspection: InspectionFormValues;
  companyData?: {
    businessName: string;
    rut: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
  };
}

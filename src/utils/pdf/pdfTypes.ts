
import { Service } from '@/types';

export interface InspectionPDFData {
  service: Service;
  inspection: {
    equipment?: string[];
    /** Estado explícito por ítem del catálogo. Ausente en inspecciones anteriores a 2026-07. */
    equipmentStatus?: Record<string, boolean>;
    vehicleObservations?: string;
    kilometraje?: string;
    combustible?: string;
    llaves?: string;
    documentacion?: string;
    operatorName?: string;
    operatorSignature?: string;
    clientSignature?: string;
    clientName?: string;
    clientRut?: string;
    vehicleReceptionSignature?: string;
    receptionPersonName?: string;
    photographicSet?: Array<{
      fileName: string;
      category: 'izquierdo' | 'derecho' | 'frontal' | 'trasero' | 'interior' | 'motor';
    }>;
  };
  companyData: {
    businessName: string;
    rut: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
  };
  isFinal?: boolean;
  isInSitu?: boolean;
}

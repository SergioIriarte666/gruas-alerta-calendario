
import { Service } from '@/types';

export interface InspectionPDFData {
  service: Service;
  inspection: {
    equipment?: string[];
    vehicleObservations?: string;
    operatorSignature?: string;
    clientSignature?: string;
    clientName?: string;
    clientRut?: string;
    photosBeforeService?: string[];
    photosClientVehicle?: string[];
    photosEquipmentUsed?: string[];
  };
  companyData: {
    businessName: string;
    rut: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
  };
}

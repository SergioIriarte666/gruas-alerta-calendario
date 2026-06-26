import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Service } from '@/types';

export type RegenerarInspeccionKind = 'initial' | 'final';

export interface ServicioConFotos {
  serviceId: string;
  folio: string;
  serviceDate: string;
  clientName: string;
  operatorName: string;
  fotosDisponibles: number;
  tieneRowInspection: boolean;
  pdfUrlActual: string | null;
  pdfRetiroUrlActual: string | null;
  ultimoEnvioWhatsappAt: string | null;
}

export interface RegenerarInspeccionFilters {
  folio: string;
  fecha: string;
  cliente: string;
}

export interface PreviewPhoto {
  path: string;
  fileName: string;
  category: 'izquierdo' | 'derecho' | 'frontal' | 'trasero' | 'interior' | 'motor';
  signedUrl: string;
  dataUrl?: string;
}

export interface InspectionPreviewData {
  service: Service;
  inspection: InspectionFormValues;
  photos: PreviewPhoto[];
  currentPdfPath: string | null;
  currentFinalPdfPath: string | null;
}

export interface RegenerarYEnviarInput {
  serviceId: string;
  kind: RegenerarInspeccionKind;
  enviarWhatsapp: boolean;
  motivo?: string;
}

export interface RegenerarYEnviarResult {
  pdfPath: string;
  signedUrl: string;
  whatsappSent: boolean;
  whatsappSkippedReason?: string;
}

export type ExternalEvidenceType =
  | 'formulario_tercero'
  | 'fotos'
  | 'factura'
  | 'orden_firmada'
  | 'otro';

export const EVIDENCE_TYPE_LABELS: Record<ExternalEvidenceType, string> = {
  formulario_tercero: 'Formulario del tercero',
  fotos: 'Fotografías',
  factura: 'Factura',
  orden_firmada: 'Orden firmada',
  otro: 'Otro',
};

export interface ExternalEvidence {
  id: string;
  serviceId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  evidenceType: ExternalEvidenceType;
  notes: string | null;
  uploadedBy: string;
  uploadedAt: string;
  createdAt: string;
}

export interface ExternalClosure {
  id: string;
  serviceId: string;
  adminUserId: string;
  adminName: string;
  adminSignature: string;
  thirdPartyProviderName: string;
  thirdPartyProviderRut: string | null;
  thirdPartyServiceSummary: string;
  closureNotes: string | null;
  pdfPath: string | null;
  emailSentTo: string[];
  emailSentAt: string | null;
  emailSendCount: number;
  closedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalClosureInput {
  serviceId: string;
  thirdPartyProviderName: string;
  thirdPartyProviderRut?: string;
  thirdPartyServiceSummary: string;
  closureNotes?: string;
  adminSignature: string;
  adminName: string;
}

export interface EvidenceUploadInput {
  serviceId: string;
  file: File;
  evidenceType: ExternalEvidenceType;
  notes?: string;
}

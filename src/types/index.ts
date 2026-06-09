

export interface Service {
  id: string;
  folio: string;
  requestDate: string;
  serviceDate: string;
  companyRut?: string;
  companyName?: string;
  startTime?: string;
  endTime?: string;
  craneMileage?: number;
  client: Client;
  purchaseOrder?: string;
  purchaseOrderNumber?: string; // Añadido para flujo especial cliente (Fase 1)
  quoteNumber?: string; // Número de cotización opcional
  vehicleBrand: string;
  vehicleModel: string;
  licensePlate: string;
  origin: string;
  destination: string;
  serviceType: ServiceType;
  value: number;
  crane: Crane | null;
  operator: Operator | null;
  operatorCommission: number;
  status: ServiceStatus;
  observations?: string;
  // Optional excess functionality
  hasExcess?: boolean;
  clientCoveredAmount?: number;
  excessAmount?: number;
  // Invoice information
  invoiceFolio?: string;
  invoiceNumeroFiscal?: string;
  // Custody fields
  custodyMode?: 'manual' | 'calendar' | 'none';
  custodyDays?: number;
  custodyDailyRate?: number;
  custodyRateType?: string;
  custodyStartDate?: string;
  custodyEndDate?: string;
  custodyVehicleType?: string;
  custodyDiscountPercentage?: number;
  custodyTotalAmount?: number;
  custodyNotes?: string;
  // Insured client name (for insurance companies)
  insuredName?: string;
  // Contact person at service location
  contactPerson?: string;
  contactPhone?: string;
  // Outsourced/Third-party service fields
  outsourcedProviderId?: string;
  outsourcedCost?: number;
  outsourcedNotes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  creatorName?: string;
}

export interface ServiceFormData {
  folio?: string;
  requestDate: string;
  serviceDate: string;
  startTime?: string;
  endTime?: string;
  craneMileage?: number;
  client: string;
  purchaseOrder?: string;
  quoteNumber?: string;
  serviceType: string;
  vehicleBrand: string;
  vehicleModel: string;
  licensePlate: string;
  origin: string;
  destination: string;
  crane?: string;
  operators?: Array<{
    id: string;
    operatorId: string;
    commission: number;
    role: string;
    hours: number;
  }>;
  value: number;
  costDetails?: Array<{
    id?: string;
    description: string;
    amount: number;
    quantity: number;
    unitPrice: number;
    notes?: string;
    category_id?: string;
    subcategory?: string;
    isExisting?: boolean;
  }>;
  markCostsPaidOnCreate?: boolean;
  hasExcess?: boolean;
  clientCoveredAmount?: number;
  excessAmount?: number;
  status: ServiceStatus;
  observations?: string;
  // Custody fields
  custodyMode?: 'manual' | 'calendar' | 'none';
  custodyDays?: number;
  custodyDailyRate?: number;
  custodyRateType?: string;
  custodyStartDate?: string;
  custodyEndDate?: string;
  custodyVehicleType?: string;
  custodyDiscountPercentage?: number;
  custodyTotalAmount?: number;
  custodyNotes?: string;
  // Insured client name (for insurance companies)
  insuredName?: string;
  // Contact person at service location
  contactPerson?: string;
  contactPhone?: string;
  // Outsourced/Third-party service fields
  outsourcedProviderId?: string;
  outsourcedCost?: number;
  outsourcedNotes?: string;
}

export interface Client {
  id: string;
  name: string;
  displayName?: string | null;
  rut: string;
  phone: string;
  email: string;
  address: string;
  department: string;
  contactName?: string;
  logoUrl?: string | null;
  billingType?: 'standard' | 'monthly';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  defaultPaymentTermId?: string;
  createdBy?: string;
  creatorName?: string;
}

export interface Crane {
  id: string;
  licensePlate: string;
  brand: string;
  model: string;
  type: CraneType;
  tollVehicleCategory?: string;
  ownerCompanyRut?: string;
  ownerCompanyName?: string;
  circulationPermitExpiry: string;
  insuranceExpiry: string;
  technicalReviewExpiry: string;
  isActive: boolean;
  status?: CraneStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  creatorName?: string;
}

export interface Operator {
  id: string;
  name: string;
  rut: string;
  phone: string;
  operatorType: 'crane_operator' | 'administrative';
  department?: string;
  position?: string;
  licenseNumber?: string;
  examExpiry?: string;
  commissionExempt?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  creatorName?: string;
}

// ── Documentos de Operadores ──────────────────────────────────────────────────

export type DocumentType =
  | 'cedula_identidad'
  | 'licencia_conducir'
  | 'examen_psicosensotecnico'
  | 'examen_altura'
  | 'seguro_vida'
  | 'contrato_trabajo';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  cedula_identidad: 'Cédula de Identidad',
  licencia_conducir: 'Licencia de Conducir',
  examen_psicosensotecnico: 'Examen Psicosensotécnico',
  examen_altura: 'Examen de Altura',
  seguro_vida: 'Seguro de Vida',
  contrato_trabajo: 'Contrato de Trabajo',
};

export const DOCUMENT_TYPES_WITH_EXPIRY: DocumentType[] = [
  'licencia_conducir',
  'examen_psicosensotecnico',
  'examen_altura',
  'seguro_vida',
];

export type DocumentStatus = 'vigente' | 'por_vencer' | 'vencido' | 'sin_fecha';

export interface OperatorDocument {
  id: string;
  operatorId: string;
  documentType: DocumentType;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  contentType?: string;
  expiryDate?: string;
  issuedDate?: string;
  notes?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OperatorDocumentInsert {
  operatorId: string;
  documentType: DocumentType;
  file: File;
  expiryDate?: string;
  issuedDate?: string;
  notes?: string;
}

export interface ServiceType {
  id: string;
  name: string;
  description?: string;
  basePrice?: number;
  isActive: boolean;
  vehicleInfoOptional: boolean;
  isOutsourced?: boolean;
  // Campos de configuración de requerimientos
  purchaseOrderRequired: boolean;
  originRequired: boolean;
  destinationRequired: boolean;
  craneRequired: boolean;
  operatorRequired: boolean;
  vehicleBrandRequired: boolean;
  vehicleModelRequired: boolean;
  licensePlateRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyData {
  id: string;
  businessName: string;
  rut: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  logo?: string;
  folioFormat: string;
  invoiceDueDays: number;
  vatPercentage: number;
  legalTexts: string;
  alertDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  folio: string;
  closureId: string;
  clientId: string;
  client?: {
    id: string;
    name: string;
    rut: string;
    email?: string;
    phone?: string;
    department?: string;
  };
  issueDate: string;
  dueDate: string;
  subtotal: number;
  vat: number;
  total: number;
  status: InvoiceStatus;
  paymentDate?: string;
  numeroFiscal?: string;
  paymentTermId?: string;
  paidAmount?: number;
  remainingAmount?: number;
  notes?: string;
  productServiceDescription: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  creatorName?: string;
}

export interface PaymentTerm {
  id: string;
  name: string;
  code: string;
  days: number;
  description?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  created_by?: string;
}

// Define closure status type for consistency (Fase 1)
export type ClosureStatus = 'open' | 'closed' | 'invoiced' | 'quoted' | 'purchase_order_pending';

export interface ServiceClosure {
  id: string;
  folio: string;
  serviceIds: string[];
  dateRange: {
    from: string;
    to: string;
  };
  clientId?: string;
  total: number;
  status: ClosureStatus;
  purchaseOrder?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  creatorName?: string;
}

// Updated to match database enums - Added new states for special client workflow (Fase 1)
export type ServiceStatus = 'pending' | 'in_progress' | 'inspection_completed' | 'completed' | 'cancelled' | 'invoiced' | 'quoted' | 'purchase_order_pending' | 'with_purchase_order' | 'failed';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type CraneType = 'light' | 'medium' | 'heavy' | 'taxi' | 'other' | 'horquilla';

export type CraneStatus = 'active' | 'inactive' | 'sold' | 'written_off';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'service' | 'document_expiry' | 'invoice_due' | 'payment';
  status: 'scheduled' | 'warning' | 'urgent' | 'completed';
  entityId: string;
  entityType: 'service' | 'crane' | 'operator' | 'invoice';
}

export interface DashboardMetrics {
  totalServices: number;
  monthlyServices: number;
  futureServices: number;
  monthlyRevenue: number;
  pendingInvoices: number;
  overdueInvoices: number;
  servicesByStatus: {
    pending: number;
    completed: number;
    cancelled: number;
  };
  upcomingExpirations: number;
  // Métricas del mes anterior para comparación
  previousMonthServices: number;
  previousMonthRevenue: number;
  servicesChange: number; // % de cambio
  revenueChange: number; // % de cambio
}

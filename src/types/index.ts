

export interface Service {
  id: string;
  folio: string;
  requestDate: string;
  serviceDate: string;
  client: Client;
  purchaseOrder?: string;
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
  custodyStartDate?: string;
  custodyEndDate?: string;
  custodyVehicleType?: string;
  custodyDiscountPercentage?: number;
  custodyTotalAmount?: number;
  custodyNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceFormData {
  folio?: string;
  requestDate: string;
  serviceDate: string;
  client: string;
  purchaseOrder?: string;
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
  hasExcess?: boolean;
  clientCoveredAmount?: number;
  excessAmount?: number;
  status: ServiceStatus;
  observations?: string;
  // Custody fields
  custodyMode?: 'manual' | 'calendar' | 'none';
  custodyDays?: number;
  custodyDailyRate?: number;
  custodyStartDate?: string;
  custodyEndDate?: string;
  custodyVehicleType?: string;
  custodyDiscountPercentage?: number;
  custodyTotalAmount?: number;
  custodyNotes?: string;
}

export interface Client {
  id: string;
  name: string;
  rut: string;
  phone: string;
  email: string;
  address: string;
  department: string;
  contactName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Crane {
  id: string;
  licensePlate: string;
  brand: string;
  model: string;
  type: CraneType;
  circulationPermitExpiry: string;
  insuranceExpiry: string;
  technicalReviewExpiry: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Operator {
  id: string;
  name: string;
  rut: string;
  phone: string;
  email?: string;
  licenseNumber: string;
  examExpiry: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceType {
  id: string;
  name: string;
  description?: string;
  basePrice?: number;
  isActive: boolean;
  vehicleInfoOptional: boolean;
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
  issueDate: string;
  dueDate: string;
  subtotal: number;
  vat: number;
  total: number;
  status: InvoiceStatus;
  paymentDate?: string;
  numeroFiscal?: string;
  createdAt: string;
  updatedAt: string;
}

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
  status: 'open' | 'closed' | 'invoiced';
  purchaseOrder?: string;
  createdAt: string;
  updatedAt: string;
}

// Updated to match database enums - Added 'inspection_completed' and 'invoiced' status
export type ServiceStatus = 'pending' | 'in_progress' | 'inspection_completed' | 'completed' | 'cancelled' | 'invoiced';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type CraneType = 'light' | 'medium' | 'heavy' | 'taxi' | 'other' | 'horquilla';

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
}
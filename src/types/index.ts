
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
  crane: Crane;
  operator: Operator;
  operatorCommission: number;
  status: ServiceStatus;
  observations?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  rut: string;
  phone: string;
  email: string;
  address: string;
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
  licenseNumber: string;
  examExpiry: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceType {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  vehicleInfoOptional?: boolean;
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
  serviceIds: string[];
  clientId: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  vat: number;
  total: number;
  status: InvoiceStatus;
  paymentDate?: string;
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
  createdAt: string;
  updatedAt: string;
}

// Updated to match database enums - Added 'invoiced' status
export type ServiceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'invoiced';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type CraneType = 'light' | 'medium' | 'heavy' | 'taxi' | 'other';

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
  activeClients: number;
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

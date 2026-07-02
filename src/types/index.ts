

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
  thirdPartyClientId?: string | null;
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

/** Variante snake_case de Service para datos sin transformar desde Supabase */
export interface ServiceSnakeCase extends Service {
  [key: string]: unknown;
  purchase_order_number?: string;
  custody_mode?: 'manual' | 'calendar' | 'none' | 'entry_exit';
  custody_days?: number;
  custody_daily_rate?: number;
  custody_rate_type?: string;
  custody_start_date?: string;
  custody_end_date?: string;
  custody_vehicle_type?: string;
  custody_discount_percentage?: number;
  custody_total_amount?: number;
  custody_notes?: string;
  insured_name?: string;
  contact_person?: string;
  contact_phone?: string;
  outsourced_provider_id?: string;
  outsourced_cost?: number;
  outsourced_notes?: string;
  // Campos snake_case de DB (no camelCase en Service)
  request_date?: string;
  service_date?: string;
  purchase_order?: string;
  quote_number?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  license_plate?: string;
  has_excess?: boolean;
  client_covered_amount?: number;
  excess_amount?: number;
  third_party_client_id?: string;
  invoice_folio?: string;
  invoice_numero_fiscal?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  creator?: { full_name?: string; email?: string };
  service_resources?: Array<{
    resource_type: string;
    resource_id: string;
    is_primary: boolean;
    resource?: { id: string; name?: string };
  }>;
  // Campos de cost_details / prefilledData
  operator_id?: string;
  operator_commission?: number;
  service_type_id?: string;
  crane_id?: string;
  client_id?: string;
  cost_center_id?: string;
  service_folio?: string;
  payment_date?: string;
  supplier_id?: string;
  supplier_invoice_id?: string;
  supplier_payment_id?: string;
  inventory_movement_id?: string;
  document_type?: string;
  document_number?: string;
  location_text?: string;
  other_reason?: string;
  purchase_quantity?: number;
  purchase_unit_cost?: number;
  immediate_consumption?: boolean;
  receipt_photo_paths?: string[];
  quickEntryId?: string;
  _source?: string;
  _processCosts?: boolean;
  // Campos de prefilledData usados en EnhancedServiceForm
  _isDuplicating?: boolean;
  _originalFolio?: string;
  clientId?: string;
  serviceTypeId?: string;
  craneId?: string;
  operators?: Array<{ id: string; operatorId: string; commission: number; name?: string; isPrimary?: boolean }>;
  inCustody?: boolean;
  custodyDetails?: {
    estimatedDays?: number;
    dailyRate?: number;
    entryDate?: string;
    exitDate?: string;
    totalAmount?: number;
  };
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
  thirdPartyClientId?: string | null;
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
  fuelTypeOverride?: string;
  baseConsumptionPerKmOverride?: number;
  loadedConsumptionFactorOverride?: number;
  towingConsumptionFactorOverride?: number;
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
  userId?: string | null;
}

// ── Desglose de ítems por servicio ───────────────────────────────────────────

export interface ServiceItem {
  id: string;
  service_id: string;
  glosa: string;
  cantidad: number;
  valor_unitario: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceItemDraft {
  id: string;
  glosa: string;
  cantidad: number;
  valor_unitario: number;
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
  filePath: string;
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
  // Flags de inspección
  requiresDetail?: boolean;
  requiresPhotoSet?: boolean;
  // Categoría operacional: define el flujo de inspección.
  serviceCategory?: 'in_situ' | 'traslado' | 'externo_tercero' | 'excedente';
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
  source?: 'sistema' | 'historico';
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
  /** Conteo real de servicios del cierre, calculado para TODOS los cierres
   *  (a diferencia de serviceIds, que en la lista global solo viene poblado
   *  para los cierres más recientes por performance). Preferir este campo
   *  al mostrar/ordenar por cantidad de servicios en listados. */
  serviceCount?: number;
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
export type ServiceStatus = 'pending' | 'in_progress' | 'inspection_completed' | 'completed' | 'cancelled' | 'invoiced' | 'partially_invoiced' | 'quoted' | 'purchase_order_pending' | 'with_purchase_order' | 'failed';

// Disputa de servicio: condición ortogonal al estado del servicio (no es un ServiceStatus).
export type DisputeType = 'item_faltante_oc' | 'patente_incorrecta' | 'monto_distinto' | 'documento_faltante' | 'otro';
export type DisputeStatus = 'open' | 'resolved';

export interface ServiceDispute {
  id: string;
  serviceId: string;
  disputeType: DisputeType;
  description: string;
  disputedAmount?: number | null;
  referenceDoc?: string | null;
  status: DisputeStatus;
  resolutionNotes?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
  resolvedBy?: string | null;
  resolvedByName?: string | null;
  resolvedAt?: string | null;
}
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

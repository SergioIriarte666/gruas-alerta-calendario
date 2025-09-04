// Re-export dynamic supplier category type
export type { SupplierCategory } from '@/hooks/useSupplierCategoryManager';

export interface Supplier {
  id: string;
  name: string;
  rut: string;
  email: string;
  phone: string;
  address: string;
  contact_name: string;
  category: string; // Now stores category ID
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  description: string;
  category: string; // Now stores category ID
  reference_number?: string;
  notes?: string;
  status: SupplierPaymentStatus;
  paid_amount?: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export type SupplierPaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface SupplierWithStats extends Supplier {
  total_payments?: number;
  pending_amount?: number;
  paid_amount?: number;
  overdue_count?: number;
}

export interface SupplierPaymentWithDetails extends SupplierPayment {
  supplier?: Supplier;
}

export interface SupplierFormData {
  name: string;
  rut: string;
  email: string;
  phone: string;
  address: string;
  contact_name: string;
  category: string;
  notes?: string;
  is_active: boolean;
}

export interface PaymentFormData {
  supplier_id: string;
  amount: number;
  due_date: string;
  description: string;
  category: string;
  reference_number?: string;
  notes?: string;
  status: SupplierPaymentStatus;
  // Campos opcionales para detalles de piezas
  part_name?: string;
  part_quantity?: number;
  part_unit_price?: number;
  crane_id?: string;
}

export interface SupplierStats {
  total_suppliers: number;
  active_suppliers: number;
  total_pending_payments: number;
  total_pending_amount: number;
  total_overdue_payments: number;
  total_overdue_amount: number;
  suppliers_by_category: Record<string, number>;
}

// Tipos para XML parsing de proveedores
export interface XMLSupplierData {
  name: string;
  rut: string;
  email: string;
  phone: string;
  address: string;
  contact_name: string;
  category: string;
  notes?: string;
  is_active: boolean;
}

// Tipos para XML parsing de documentos
export interface XMLDocumentData {
  folio: string;
  document_type: string;
  issue_date: string;
  due_date?: string;
  net_amount: number;
  vat_amount: number;
  total_amount: number;
  currency: string;
  description: string;
  supplier_rut: string;
  status?: string;
  payment_terms?: string;
  items?: XMLDocumentItem[];
}

export interface XMLDocumentItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  tax_rate?: number;
}

// Resultado de parsing completo
export interface XMLCompleteParseResult {
  success: boolean;
  suppliers: XMLSupplierData[];
  documents: XMLDocumentData[];
  errors: string[];
  warnings: string[];
  totalSuppliers: number;
  validSuppliers: number;
  totalDocuments: number;
  validDocuments: number;
}

// Datos para crear pagos automáticamente
export interface XMLSupplierPaymentData {
  supplier_rut: string;
  amount: number;
  due_date: string;
  description: string;
  category: string;
  reference_number: string;
  notes?: string;
  status: SupplierPaymentStatus;
  document_data: XMLDocumentData;
}

export interface XMLSupplierParseResult {
  success: boolean;
  data: XMLSupplierData[];
  errors: string[];
  warnings: string[];
  totalRows: number;
  validRows: number;
}

export interface XMLSupplierFieldMapping {
  xmlField: string;
  targetField: keyof XMLSupplierData;
  required: boolean;
  transform?: (value: any) => any;
}

// Export report types
export interface SupplierPaymentReportFilters {
  searchTerm?: string;
  status?: string;
  supplierId?: string;
  supplierName?: string;
  reportType: 'current' | 'future';
  daysAhead?: number; // For future payments report
  dateFrom?: string; // Fecha desde
  dateTo?: string; // Fecha hasta
  dateType?: 'due_date' | 'created_at' | 'paid_date'; // Tipo de fecha para filtrar
}
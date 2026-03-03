import { Database } from "@/integrations/supabase/types";

// Tipos base desde Supabase (única fuente de verdad)
export type Supplier = Database['public']['Tables']['suppliers']['Row'];

// SupplierPaymentStatus - definir antes de usarlo
export type SupplierPaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

// SupplierPayment - override status field to use our specific type
type SupplierPaymentBase = Database['public']['Tables']['supplier_payments']['Row'];
export interface SupplierPayment extends Omit<SupplierPaymentBase, 'status'> {
  status: SupplierPaymentStatus;
}

// Stats type (computed/aggregated data not from a single table)
export interface SupplierStats {
  total_suppliers: number;
  active_suppliers: number;
  total_pending_payments: number;
  total_pending_amount: number;
  total_overdue_payments: number;
  total_overdue_amount: number;
  suppliers_by_category: Record<string, number>;
}

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
  rut?: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_name?: string;
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
  // Nuevo: checkbox para agregar a inventario
  add_to_inventory?: boolean;
  // Campos para cuando se marca como pagado
  paid_date?: string;
  paid_amount?: number;
  // Campo para vincular con factura(s)
  supplier_invoice_id?: string;
  selected_invoice_ids?: string[];
}

// Remove duplicate SupplierStats - now defined at the top

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
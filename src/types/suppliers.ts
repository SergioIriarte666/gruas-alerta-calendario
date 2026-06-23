// Supplier type - unified on inventory_suppliers table
export interface Supplier {
  id: string;
  name: string;
  rut: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  contact_name?: string | null; // UI alias for contact_person
  category: string;
  subcategory?: string | null;
  notes?: string | null;
  payment_terms: string | null;
  default_payment_term_id?: string | null;
  credit_date?: string | null;
  delivery_time_days: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by?: string | null;
}

export interface SupplierCategory {
  id: string;
  name: string;
  label: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// SupplierPaymentStatus - definir antes de usarlo
export type SupplierPaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

// SupplierPayment - from generated types but with specific status
import { Database } from "@/integrations/supabase/types";
type SupplierPaymentBase = Database['public']['Tables']['supplier_payments']['Row'];
export interface SupplierPayment extends Omit<SupplierPaymentBase, 'status'> {
  status: SupplierPaymentStatus;
}

// SupplierInvoice definition
export interface SupplierInvoice {
  id: string;
  supplier_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  currency: string | null;
  status: string | null;
  description: string | null;
  product_service_description: string;
  tax_amount: number | null;
  net_amount: number;
  payment_terms: number | null;
  paid_amount: number | null;
  balance: number | null;
  created_at: string | null;
  updated_at: string | null;
  source_module?: string;
  xml_file_name?: string | null;
  source?: 'sistema' | 'historico';
}

export interface SupplierInvoiceWithDetails extends SupplierInvoice {
  supplier?: Supplier;
  items?: SupplierInvoiceItem[];
}

export interface SupplierInvoiceItem {
  id: string;
  supplier_invoice_id: string;
  inventory_item_id: string;
  movement_id?: string | null;
  line_number: number;
  product_code?: string | null;
  product_name?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_rate?: number | null;
  tax_amount: number;
  total_amount: number;
  created_at?: string;
  updated_at?: string;
  inventory_item?: {
    id: string;
    name: string;
    sku?: string | null;
    barcode?: string | null;
  } | null;
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
  subcategory?: string;
  notes?: string;
  is_active: boolean;
}

export interface PaymentFormData {
  supplier_id: string;
  amount: number;
  due_date: string;
  description: string;
  category: string;
  subcategory?: string;
  reference_number?: string;
  notes?: string;
  status: SupplierPaymentStatus;
  part_name?: string;
  part_quantity?: number;
  part_unit_price?: number;
  crane_id?: string;
  add_to_inventory?: boolean;
  paid_date?: string;
  paid_amount?: number;
  supplier_invoice_id?: string;
  selected_invoice_ids?: string[];
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
  subcategory?: string;
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
  /** FmaPago del SII: 1=Contado, 2=Crédito, 3=Sin costo */
  payment_method_code?: number;
  items?: XMLDocumentItem[];
}

export interface XMLDocumentItem {
  product_code?: string;
  product_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;
  tax_amount?: number;
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
  daysAhead?: number;
  dateFrom?: string;
  dateTo?: string;
  dateType?: 'due_date' | 'created_at' | 'paid_date';
}

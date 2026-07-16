import { Database } from "@/integrations/supabase/types";
import { CreatorInfo } from "./common";
import type { EntityKey } from "@/lib/entities";

export type CostCategory = Database['public']['Tables']['cost_categories']['Row'];
export type CostSubcategory = Database['public']['Tables']['cost_subcategories']['Row'];

export type Cost = Database['public']['Tables']['costs']['Row'] & {
  payment_date?: string | null;  // Agregar explícitamente para claridad
  payment_batch_id?: string | null;  // Agregar explícitamente para claridad
  cost_center_id?: string | null;
  document_type?: string | null;
  document_number?: string | null;
  cost_categories: CostCategory;
  cost_centers?: {
    id: string;
    name: string;
  } | null;
  cranes: Database['public']['Tables']['cranes']['Row'] | null;
  operators: Database['public']['Tables']['operators']['Row'] | null;
  services: (Database['public']['Tables']['services']['Row'] & {
    clients: Database['public']['Tables']['clients']['Row'];
  }) | null;
  crane_parts: {
    part_name: string;
    supplier: string;
    phone: string | null;
    quantity: number;
    unit_price: number;
    total_value: number | null;
    kilometraje: number | null;
  }[] | null;
  crane_maintenance: {
    id: string;
    description: string;
    maintenance_type: string;
    provider: string | null;
    notes: string | null;
  } | null;
  inventory_suppliers?: {
    id: string;
    name: string;
    rut: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  supplier_invoices?: {
    id: string;
    invoice_number: string | null;
    supplier_invoice_items: {
      id: string;
      line_number: number | null;
      product_name: string | null;
      description: string | null;
      quantity: number | null;
      unit_price: number | null;
      subtotal: number | null;
      tax_amount: number | null;
      total_amount: number | null;
    }[];
  } | null;
  creator?: CreatorInfo | null;
};

type CostInsertBase = Omit<Database['public']['Tables']['costs']['Insert'], 'id' | 'created_at' | 'updated_at' | 'created_by' | 'entity' | 'paid_by'>;

export type CostFormData = CostInsertBase & {
  entity: EntityKey;
  paid_by: EntityKey;
  // Campos adicionales para piezas y repuestos
  part_name?: string | null;
  supplier?: string | null;
  supplier_phone?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  kilometraje?: number | null;
  // FASE 2: Campos para sincronización con inventario
  purchase_quantity?: number | null;
  purchase_unit_cost?: number | null;
  // Campo para consumo inmediato
  immediate_consumption?: boolean;
  // NUEVA FASE: FK formal a proveedores
  supplier_id?: string | null;
};

// Interface para datos de piezas y repuestos
export interface PartsExpenseData extends CostFormData {
  subcategory: string;
  part_name: string;
  supplier: string;
  supplier_phone?: string;
  quantity: number;
  unit_price: number;
  kilometraje?: number;
}

// Tipos para XML parsing
export interface XMLCostData {
  fecha: string | Date;
  descripcion: string;
  monto: number;
  proveedor?: string;
  categoria?: string;
  subcategoria?: string;
  numeroFactura?: string;
  rut?: string;
  telefono?: string;
  cantidad?: number;
  precioUnitario?: number;
  notas?: string;
}

export interface XMLParseResult {
  success: boolean;
  data: XMLCostData[];
  errors: string[];
  warnings: string[];
  totalRows: number;
  validRows: number;
}

export interface XMLValidationError {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface XMLFieldMapping {
  xmlField: string;
  targetField: keyof XMLCostData;
  required: boolean;
  transform?: (value: any) => any;
}

export interface XMLStructure {
  rootElement: string;
  itemElement: string;
  fields: XMLFieldMapping[];
  detectedFields: string[];
}

import { Database } from "@/integrations/supabase/types";

export type CostCategory = Database['public']['Tables']['cost_categories']['Row'];

export type Cost = Database['public']['Tables']['costs']['Row'] & {
  cost_categories: CostCategory;
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
};

export type CostFormData = Omit<Database['public']['Tables']['costs']['Insert'], 'id' | 'created_at' | 'updated_at' | 'created_by'> & {
  // Campos adicionales para piezas y repuestos
  part_name?: string | null;
  supplier?: string | null;
  supplier_phone?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  kilometraje?: number | null;
};

// Constantes para las categorías de servicios
export const SERVICE_SUBCATEGORIES = [
  'Combustible',
  'Peajes', 
  'Otros'
] as const;

// Constantes para las subcategorías de mantenimiento
export const MAINTENANCE_SUBCATEGORIES = [
  'Piezas y Repuestos',
  'Mano de obra',
  'Servicios externos',
  'Otros'
] as const;

export type ServiceSubcategory = typeof SERVICE_SUBCATEGORIES[number];
export type MaintenanceSubcategory = typeof MAINTENANCE_SUBCATEGORIES[number];

// Interface para datos de servicios especializados
export interface ServiceExpenseData extends CostFormData {
  subcategory: ServiceSubcategory;
}

// Interface para datos de piezas y repuestos
export interface PartsExpenseData extends CostFormData {
  subcategory: 'Piezas y Repuestos';
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
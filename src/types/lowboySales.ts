import type { Database } from '@/integrations/supabase/types';

export type LowboySaleVehicleRow = Database['public']['Tables']['lowboy_sale_vehicles']['Row'];

/** Vehículo/maquinaria trasladado en un flete (fila del formulario). Todos opcionales. */
export type LowboySaleVehicleFormValue = {
  plate: string;
  make: string;
  model: string;
};

export type LowboySaleRow = Database['public']['Tables']['lowboy_sales']['Row'] & {
  lowboy_containers?: Array<{
    id: string;
    serial_number: string | null;
    size: string;
    sale_net_price?: number | null;
  }>;
  lowboy_sale_vehicles?: Array<{
    id: string;
    plate: string | null;
    make: string | null;
    model: string | null;
    position: number;
  }>;
  linked_rcv_records?: Array<{
    id: string;
    folio: number;
    doc_date: string;
    doc_type: number;
    counterpart_rut: string;
    counterpart_name: string | null;
    net_amount: number;
    tax_amount: number;
    total_amount: number;
  }>;
};

export type LowboySaleType = 'producto' | 'flete';
export type LowboySaleStatus =
  | 'confirmada'
  | 'ejecutada'
  | 'facturada'
  | 'pagada'
  | 'cancelada';

export const LOWBOY_SALE_TYPES: LowboySaleType[] = ['producto', 'flete'];

export const LOWBOY_SALE_STATUSES: LowboySaleStatus[] = [
  'confirmada',
  'ejecutada',
  'facturada',
  'pagada',
  'cancelada',
];

export const SALE_TYPE_LABEL: Record<LowboySaleType, string> = {
  producto: 'Producto',
  flete: 'Flete',
};

export const SALE_STATUS_LABEL: Record<LowboySaleStatus, string> = {
  confirmada: 'Confirmada',
  ejecutada: 'Ejecutada',
  facturada: 'Facturada',
  pagada: 'Pagada',
  cancelada: 'Cancelada',
};

/** Estados considerados "activos" para KPIs y orden por defecto. */
export const ACTIVE_SALE_STATUSES: LowboySaleStatus[] = ['confirmada', 'ejecutada'];

/**
 * Transición válida "hacia adelante" para cada estado (avance de una sola etapa).
 * Cancelar se maneja aparte (disponible desde confirmada/ejecutada).
 */
export const NEXT_STATUS: Partial<Record<LowboySaleStatus, LowboySaleStatus>> = {
  confirmada: 'ejecutada',
  ejecutada: 'facturada',
  facturada: 'pagada',
};

/** Orden lineal del pipeline (excluye cancelada, que es una salida lateral). */
export const PIPELINE_ORDER: LowboySaleStatus[] = ['confirmada', 'ejecutada', 'facturada', 'pagada'];

/** Helpers de transición compartidos por la tabla y el modal de detalle (fuente única). */
export const canAdvanceSale = (status: string): boolean => Boolean(NEXT_STATUS[status as LowboySaleStatus]);

export const canCancelSale = (status: string): boolean => status === 'confirmada' || status === 'ejecutada';

/** Estados "hacia adelante" a los que un admin puede saltar (omitiendo etapas). */
export const skipTargetsForStatus = (status: string): LowboySaleStatus[] => {
  const idx = PIPELINE_ORDER.indexOf(status as LowboySaleStatus);
  if (idx < 0) return [];
  const next = NEXT_STATUS[status as LowboySaleStatus];
  return PIPELINE_ORDER.slice(idx + 1).filter((s) => s !== next);
};

/** Etiqueta de la acción de avance de una etapa (ej: "Marcar ejecutada"). */
export const nextActionLabel = (status: string): string => {
  const next = NEXT_STATUS[status as LowboySaleStatus];
  return next ? `Marcar ${SALE_STATUS_LABEL[next].toLowerCase()}` : '';
};

export type LowboySaleFormValues = {
  sale_type: LowboySaleType;
  client_rut: string;
  client_name: string;
  description: string;
  origin: string;
  destination: string;
  scheduled_date: string;
  net_amount: number;
  notes: string;
  vehicles: LowboySaleVehicleFormValue[];
};

export type LowboySaleInitialStatus = 'ejecutada' | 'facturada' | 'pagada';

export type LowboySaleInitialState = {
  status: LowboySaleInitialStatus;
  executed_date: string;
};

export type CreateLowboySaleInput = {
  values: LowboySaleFormValues;
  initialState?: LowboySaleInitialState;
  containerAssignments?: LowboyContainerSaleAssignment[];
  rcvRecordId?: string;
};

export type LowboyContainerSaleAssignment = {
  container_id: string;
  sale_net_price: number;
};

export type LowboyContainerSaleAssignmentDraft = LowboyContainerSaleAssignment & {
  manuallyEdited: boolean;
};

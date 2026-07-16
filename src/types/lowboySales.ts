import type { Database } from '@/integrations/supabase/types';

export type LowboySaleRow = Database['public']['Tables']['lowboy_sales']['Row'] & {
  lowboy_containers?: Array<{
    id: string;
    serial_number: string | null;
    size: string;
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
};

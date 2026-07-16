import type { Database } from '@/integrations/supabase/types';

export type LowboyContainerSize = '20' | '40' | '40HC' | 'otro';
export type LowboyContainerType = 'dry' | 'reefer' | 'open_top' | 'flat_rack' | 'otro';
export type LowboyContainerCondition = 'nuevo' | 'seminuevo' | 'usado' | 'a_reparar';
export type LowboyContainerStatus = 'disponible' | 'reservado' | 'vendido';

export type LowboyContainerCostRow = Database['public']['Tables']['lowboy_container_costs']['Row'];
export type LowboyContainerBaseRow = Database['public']['Tables']['lowboy_containers']['Row'];

export type LowboyContainerRcvReference = Database['public']['Tables']['sii_rcv_records']['Row'];

export type LowboyContainerRow = LowboyContainerBaseRow & {
  costs: LowboyContainerCostRow[];
  sale: {
    id: string;
    client_name: string;
    client_rut: string;
    description: string;
    net_amount: number;
    status: string;
    scheduled_date: string | null;
    executed_date: string | null;
  } | null;
  purchase_rcv: LowboyContainerRcvReference | null;
};

export type LowboyContainerFormValues = {
  serial_number: string;
  size: LowboyContainerSize;
  container_type: LowboyContainerType;
  condition: LowboyContainerCondition;
  acquisition_date: string;
  supplier_rut: string;
  supplier_name: string;
  acquisition_net_cost: number;
  purchase_rcv_record_id: string;
  status: Exclude<LowboyContainerStatus, 'vendido'>;
  notes: string;
};

export type LowboyContainerCostFormValues = {
  concept: string;
  net_amount: number;
  cost_date: string;
  rcv_record_id: string;
  notes: string;
};

export const CONTAINER_SIZE_LABEL: Record<LowboyContainerSize, string> = {
  '20': "20'",
  '40': "40'",
  '40HC': "40' HC",
  otro: 'Otro',
};

export const CONTAINER_TYPE_LABEL: Record<LowboyContainerType, string> = {
  dry: 'Dry',
  reefer: 'Reefer',
  open_top: 'Open Top',
  flat_rack: 'Flat Rack',
  otro: 'Otro',
};

export const CONTAINER_CONDITION_LABEL: Record<LowboyContainerCondition, string> = {
  nuevo: 'Nuevo',
  seminuevo: 'Seminuevo',
  usado: 'Usado',
  a_reparar: 'A reparar',
};

export const CONTAINER_STATUS_LABEL: Record<LowboyContainerStatus, string> = {
  disponible: 'Disponible',
  reservado: 'Reservado',
  vendido: 'Vendido',
};

export const containerAdditionalCost = (container: LowboyContainerRow) =>
  container.costs.reduce((sum, cost) => sum + Number(cost.net_amount || 0), 0);

export const containerTotalCost = (container: LowboyContainerRow) =>
  Number(container.acquisition_net_cost || 0) + containerAdditionalCost(container);

export const containerMargin = (container: LowboyContainerRow) =>
  Number(container.sale_net_price || 0) - containerTotalCost(container);

import type { Database } from '@/integrations/supabase/types';

export type SiiRcvBaseRecordRow = Database['public']['Tables']['sii_rcv_records']['Row'];
export type SiiRcvRecordRow = SiiRcvBaseRecordRow & {
  linked_cost: {
    id: string;
    description: string;
    amount: number;
    date: string;
  } | null;
  linked_service: {
    id: string;
    folio: string;
    service_date: string;
    value: number;
    client: { id: string; name: string } | null;
  } | null;
  container_purchase_links: Array<{ id: string }>;
  container_cost_links: Array<{ id: string; container_id: string }>;
};
export type SiiRcvImportRow = Database['public']['Tables']['sii_rcv_imports']['Row'];

export type SiiBookType = 'compra' | 'venta';
export type SiiRecordSource = 'sii_import' | 'manual';

export type SiiRcvRecordFormValues = {
  book_type: SiiBookType;
  doc_type: number;
  folio: number;
  counterpart_rut: string;
  counterpart_name: string;
  doc_date: string;
  net_amount: number;
  exempt_amount: number;
  tax_amount: number;
  total_amount: number;
};

export type LowboyCostCandidate = {
  id: string;
  date: string;
  description: string;
  amount: number;
  cost_categories: { name: string } | null;
};

export type LowboyServiceCandidate = {
  id: string;
  folio: string;
  service_date: string;
  value: number;
  client: { id: string; name: string } | null;
};

/** Notas de crédito (61) restan; notas de débito (56) suman; el resto de DTEs suma. */
export const DOC_TYPE_NOTA_CREDITO = 61;
export const DOC_TYPE_NOTA_DEBITO = 56;

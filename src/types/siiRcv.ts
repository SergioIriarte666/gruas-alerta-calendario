import type { Database } from '@/integrations/supabase/types';

export type SiiRcvRecordRow = Database['public']['Tables']['sii_rcv_records']['Row'];
export type SiiRcvImportRow = Database['public']['Tables']['sii_rcv_imports']['Row'];

export type SiiBookType = 'compra' | 'venta';

/** Notas de crédito (61) restan; notas de débito (56) suman; el resto de DTEs suma. */
export const DOC_TYPE_NOTA_CREDITO = 61;
export const DOC_TYPE_NOTA_DEBITO = 56;

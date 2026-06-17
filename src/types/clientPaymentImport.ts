export interface ClientPaymentRow {
  id: string;
  referencia: string;
  monto: number;
  detalle: string;
  fechaPago: string;
}

export type ClientPaymentMatchStatus =
  | 'found'
  | 'not_found'
  | 'already_paid'
  | 'partial_mismatch'
  | 'duplicate';

export interface ValidatedClientPaymentRow extends ClientPaymentRow {
  invoice: {
    id: string;
    folio: string;
    numero_fiscal: string;
    total: number;
    remaining_amount: number;
    status: string;
    client_id: string;
  } | null;
  matchStatus: ClientPaymentMatchStatus;
  incluir: boolean;
}

export interface ClientPaymentImportError {
  referencia: string;
  error: string;
}

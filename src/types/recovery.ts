import type { Json } from '@/integrations/supabase/types';

export type RecoveryModule = 'invoices' | 'services' | 'costs' | 'inventory';
export type RecoveryStatus = 'reversible' | 'reverted' | 'blocked';

export interface RecoveryAuditEntry {
  id: string;
  operation_id: string;
  organization_id: string;
  user_id: string | null;
  module: RecoveryModule;
  action_type: string;
  source: 'individual' | 'batch' | 'import' | 'automation' | 'reversal';
  record_id: string;
  record_label: string | null;
  old_data: Record<string, Json | undefined> | null;
  new_data: Record<string, Json | undefined> | null;
  created_at: string;
  reverted_at: string | null;
  reverted_by: string | null;
  reversal_operation_id: string | null;
  reversible: boolean;
  non_reversible_reason: string | null;
  metadata: Record<string, Json | undefined>;
}

export interface RecoveryOperation {
  operationId: string;
  entries: RecoveryAuditEntry[];
  createdAt: string;
  module: RecoveryModule;
  source: RecoveryAuditEntry['source'];
  userId: string | null;
  userName: string;
  status: RecoveryStatus;
  expiresAt: string;
}

export interface RecoveryPreview {
  can_revert: boolean;
  total_records: number;
  restorable_records: number;
  blocked_records: number;
  warnings: string[];
  side_effects: string[];
  confirmation_phrase?: string;
}


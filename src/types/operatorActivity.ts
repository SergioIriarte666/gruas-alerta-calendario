import type { Database, Json } from '@/integrations/supabase/types';

export type OperatorActivityEventType =
  | 'service_assigned'
  | 'service_unassigned'
  | 'service_updated'
  | 'service_started'
  | 'inspection_saved'
  | 'delivery_ready'
  | 'delivery_evidence_saved'
  | 'service_completed'
  | 'service_cancelled'
  | 'tracking_started'
  | 'tracking_stopped'
  | 'sync_completed';

export type OperatorActivitySeverity = 'info' | 'success' | 'warning' | 'critical';

export type OperatorActivity = Omit<
  Database['public']['Tables']['operator_activity_events']['Row'],
  'event_type' | 'severity' | 'metadata'
> & {
  event_type: OperatorActivityEventType;
  severity: OperatorActivitySeverity;
  metadata: Json;
};

export interface OperatorActivityCursor {
  createdAt: string;
  id: string;
}

export type OperatorActivityConnection = 'connecting' | 'live' | 'offline' | 'error';

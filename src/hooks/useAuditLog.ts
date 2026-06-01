import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AuditOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export type AuditModule =
  | 'services'
  | 'clients'
  | 'operators'
  | 'cranes'
  | 'costs'
  | 'invoices'
  | 'settings'
  | 'users'
  | 'backup'
  | 'notifications'
  | 'other';

export interface AuditEntry {
  id: number;
  tableName: string;
  module: AuditModule;
  operation: AuditOperation;
  timestamp: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  entityId?: string;
  entityFolio?: string;
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
  changeSummary?: string | null;
  source: 'audit_log' | 'service_change_history' | 'backup_logs' | 'notification_logs';
}

export interface AuditFilters {
  dateFrom: string | null;
  dateTo: string | null;
  modules: AuditModule[];
  operations: AuditOperation[];
  userId: string | null;
  search: string;
}

export interface AuditUser {
  id: string;
  name: string;
  email: string;
}

export interface UseAuditLogResult {
  entries: AuditEntry[];
  loading: boolean;
  total: number;
  hasMore: boolean;
  availableUsers: AuditUser[];
}

export function tableToModule(tableName: string): AuditModule {
  switch (tableName) {
    case 'services':
    case 'service_change_history':
      return 'services';
    case 'clients':
    case 'company_profiles':
      return 'clients';
    case 'operators':
      return 'operators';
    case 'cranes':
      return 'cranes';
    case 'costs':
    case 'cost_change_history':
    case 'cost_categories':
      return 'costs';
    case 'invoices':
      return 'invoices';
    case 'system_settings':
    case 'company_data':
    case 'settings':
      return 'settings';
    case 'profiles':
    case 'user_roles':
    case 'user_invitations':
      return 'users';
    case 'backup_logs':
      return 'backup';
    case 'notification_logs':
    case 'whatsapp_message_log':
      return 'notifications';
    default:
      return 'other';
  }
}

const PAGE_SIZE = 50;

function applyFilters(entries: AuditEntry[], filters: AuditFilters): AuditEntry[] {
  return entries.filter((e) => {
    if (filters.dateFrom) {
      if (e.timestamp < filters.dateFrom) return false;
    }
    if (filters.dateTo) {
      const dayAfter = filters.dateTo + 'T23:59:59';
      if (e.timestamp > dayAfter) return false;
    }
    if (filters.modules.length > 0 && !filters.modules.includes(e.module)) return false;
    if (filters.operations.length > 0 && !filters.operations.includes(e.operation)) return false;
    if (filters.userId && e.userId !== filters.userId) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = [
        e.tableName,
        e.changeSummary,
        e.entityFolio,
        e.fieldName,
        e.userName,
        e.userEmail,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

let idCounter = 0;
function nextId() {
  return ++idCounter;
}

export function useAuditLog(filters: AuditFilters, page: number): UseAuditLogResult {
  const pageSize = PAGE_SIZE;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', filters, page],
    queryFn: async (): Promise<{ entries: AuditEntry[]; availableUsers: AuditUser[] }> => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const [auditResult, serviceHistResult, backupResult, notifResult] = await Promise.all([
        (supabase as any)
          .from('audit_log')
          .select(
            'id, table_name, operation, timestamp, user_id, old_data, new_data, profiles:user_id (id, full_name, email)',
          )
          .order('timestamp', { ascending: false })
          .range(from, to),

        (supabase as any)
          .from('service_change_history')
          .select(
            'id, service_id, service_folio, changed_by, changed_at, change_type, field_name, old_value, new_value, change_summary, profiles:changed_by (id, full_name, email)',
          )
          .order('changed_at', { ascending: false })
          .limit(200),

        (supabase as any)
          .from('backup_logs')
          .select('id, created_at, backup_type, status, file_size_bytes')
          .order('created_at', { ascending: false })
          .limit(200),

        (supabase as any)
          .from('notification_logs')
          .select('id, created_at, type, status, recipient')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      if (auditResult.error) console.error('audit_log error:', auditResult.error);
      if (serviceHistResult.error) console.error('service_change_history error:', serviceHistResult.error);
      if (backupResult.error) console.error('backup_logs error:', backupResult.error);
      if (notifResult.error) console.error('notification_logs error:', notifResult.error);

      const auditEntries: AuditEntry[] = (auditResult.data || []).map((r: any) => ({
        id: nextId(),
        tableName: r.table_name,
        module: tableToModule(r.table_name),
        operation: r.operation as AuditOperation,
        timestamp: r.timestamp,
        userId: r.user_id || null,
        userEmail: r.profiles?.email || null,
        userName: r.profiles?.full_name || null,
        oldData: r.old_data || null,
        newData: r.new_data || null,
        source: 'audit_log' as const,
      }));

      const serviceEntries: AuditEntry[] = (serviceHistResult.data || []).map((r: any) => ({
        id: nextId(),
        tableName: 'service_change_history',
        module: 'services' as AuditModule,
        operation: (r.change_type === 'CREATE' ? 'INSERT' : r.change_type === 'DELETE' ? 'DELETE' : 'UPDATE') as AuditOperation,
        timestamp: r.changed_at,
        userId: r.changed_by || null,
        userEmail: r.profiles?.email || null,
        userName: r.profiles?.full_name || null,
        oldData: null,
        newData: null,
        entityId: r.service_id,
        entityFolio: r.service_folio,
        fieldName: r.field_name,
        oldValue: r.old_value,
        newValue: r.new_value,
        changeSummary: r.change_summary,
        source: 'service_change_history' as const,
      }));

      const backupEntries: AuditEntry[] = (backupResult.data || []).map((r: any) => ({
        id: nextId(),
        tableName: 'backup_logs',
        module: 'backup' as AuditModule,
        operation: 'INSERT' as AuditOperation,
        timestamp: r.created_at,
        userId: null,
        userEmail: null,
        userName: 'Sistema',
        oldData: null,
        newData: {
          backup_type: r.backup_type,
          status: r.status,
          file_size_bytes: r.file_size_bytes,
        },
        changeSummary: `Backup ${r.backup_type || ''} — ${r.status || ''}`,
        source: 'backup_logs' as const,
      }));

      const notifEntries: AuditEntry[] = (notifResult.data || []).map((r: any) => ({
        id: nextId(),
        tableName: 'notification_logs',
        module: 'notifications' as AuditModule,
        operation: 'INSERT' as AuditOperation,
        timestamp: r.created_at,
        userId: null,
        userEmail: null,
        userName: 'Sistema',
        oldData: null,
        newData: { type: r.type, status: r.status, recipient: r.recipient },
        changeSummary: `${r.type || 'Notificación'} → ${r.recipient || ''}`,
        source: 'notification_logs' as const,
      }));

      const all = [...auditEntries, ...serviceEntries, ...backupEntries, ...notifEntries].sort(
        (a, b) => b.timestamp.localeCompare(a.timestamp),
      );

      const usersMap = new Map<string, AuditUser>();
      all.forEach((e) => {
        if (e.userId && e.userEmail) {
          usersMap.set(e.userId, { id: e.userId, name: e.userName || e.userEmail, email: e.userEmail });
        }
      });

      return { entries: all, availableUsers: Array.from(usersMap.values()) };
    },
    staleTime: 30_000,
  });

  const allEntries = data?.entries ?? [];
  const availableUsers = data?.availableUsers ?? [];

  const filtered = applyFilters(allEntries, filters);
  const total = filtered.length;
  const paged = filtered.slice(0, page * pageSize);
  const hasMore = filtered.length > page * pageSize;

  return {
    entries: paged,
    loading: isLoading,
    total,
    hasMore,
    availableUsers,
  };
}

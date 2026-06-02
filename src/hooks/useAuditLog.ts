import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useAuditLog");
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
  | 'activity'
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
  source: 'audit_log' | 'service_change_history' | 'backup_logs' | 'notification_logs' | 'user_activity_log';
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
    case 'user_activity_log':
      return 'activity';
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

  const { data: usersData } = useQuery({
    queryKey: ['audit-users'],
    queryFn: async (): Promise<AuditUser[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true })
        .limit(5000);

      if (error) {
        logger.error('profiles error:', error);
        return [];
      }

      return (data || []).map((r: any) => ({
        id: r.id,
        name: r.full_name || r.email || r.id,
        email: r.email || '',
      }));
    },
    staleTime: 300_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', filters, page],
    queryFn: async (): Promise<{ entries: AuditEntry[]; availableUsers: AuditUser[] }> => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const hasDateFilters = !!(filters.dateFrom || filters.dateTo);
      const scopedLimit = hasDateFilters ? 50 : 200;

      const dateToEnd = filters.dateTo ? filters.dateTo + 'T23:59:59' : null;

      let auditQuery = supabase
        .from('audit_log')
        .select(
          'id, table_name, operation, timestamp, user_id, old_data, new_data, profiles:user_id (id, full_name, email)',
        )
        .order('timestamp', { ascending: false })
        .range(from, to);
      if (filters.dateFrom) auditQuery = auditQuery.gte('timestamp', filters.dateFrom);
      if (dateToEnd) auditQuery = auditQuery.lte('timestamp', dateToEnd);
      if (filters.userId) auditQuery = auditQuery.eq('user_id', filters.userId);

      let serviceHistQuery = supabase
        .from('service_change_history')
        .select(
          'id, service_id, service_folio, changed_by, changed_at, change_type, field_name, old_value, new_value, change_summary, profiles:changed_by (id, full_name, email)',
        )
        .order('changed_at', { ascending: false })
        .limit(scopedLimit);
      if (filters.dateFrom) serviceHistQuery = serviceHistQuery.gte('changed_at', filters.dateFrom);
      if (dateToEnd) serviceHistQuery = serviceHistQuery.lte('changed_at', dateToEnd);
      if (filters.userId) serviceHistQuery = serviceHistQuery.eq('changed_by', filters.userId);

      let backupQuery = supabase
        .from('backup_logs')
        .select('id, created_at, backup_type, status, file_size_bytes')
        .order('created_at', { ascending: false })
        .limit(scopedLimit);
      if (filters.dateFrom) backupQuery = backupQuery.gte('created_at', filters.dateFrom);
      if (dateToEnd) backupQuery = backupQuery.lte('created_at', dateToEnd);

      let notifQuery = supabase
        .from('notification_logs')
        .select('id, created_at, type, status, user_id')
        .order('created_at', { ascending: false })
        .limit(scopedLimit);
      if (filters.dateFrom) notifQuery = notifQuery.gte('created_at', filters.dateFrom);
      if (dateToEnd) notifQuery = notifQuery.lte('created_at', dateToEnd);
      if (filters.userId) notifQuery = notifQuery.eq('user_id', filters.userId);

      let activityQuery = supabase
        .from('user_activity_log')
        .select('id, created_at, user_id, event_type, path, profiles:user_id (id, full_name, email)')
        .order('created_at', { ascending: false })
        .range(from, to);
      if (filters.dateFrom) activityQuery = activityQuery.gte('created_at', filters.dateFrom);
      if (dateToEnd) activityQuery = activityQuery.lte('created_at', dateToEnd);
      if (filters.userId) activityQuery = activityQuery.eq('user_id', filters.userId);

      const [auditResult, serviceHistResult, backupResult, notifResult, activityResult] = await Promise.all([
        auditQuery,
        serviceHistQuery,
        backupQuery,
        notifQuery,
        activityQuery,
      ]);

      if (auditResult.error) logger.error('audit_log error:', auditResult.error);
      if (serviceHistResult.error) logger.error('service_change_history error:', serviceHistResult.error);
      if (backupResult.error) logger.error('backup_logs error:', backupResult.error);
      if (notifResult.error) logger.error('notification_logs error:', notifResult.error);
      if (activityResult.error) logger.error('user_activity_log error:', activityResult.error);

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
        newData: { type: r.type, status: r.status, recipient: r.user_id },
        changeSummary: `${r.type || 'Notificación'} → ${r.user_id || ''}`,
        source: 'notification_logs' as const,
      }));

      const activityEntries: AuditEntry[] = (activityResult.data || []).map((r: any) => ({
        id: nextId(),
        tableName: 'user_activity_log',
        module: 'activity' as AuditModule,
        operation: 'INSERT' as AuditOperation,
        timestamp: r.created_at,
        userId: r.user_id || null,
        userEmail: r.profiles?.email || null,
        userName: r.profiles?.full_name || null,
        oldData: null,
        newData: { event_type: r.event_type, path: r.path },
        changeSummary: r.event_type,
        source: 'user_activity_log' as const,
      }));

      const all = [...auditEntries, ...serviceEntries, ...backupEntries, ...notifEntries, ...activityEntries].sort(
        (a, b) => b.timestamp.localeCompare(a.timestamp),
      );

      const usersMap = new Map<string, AuditUser>();
      all.forEach((e) => {
        if (e.userId) {
          const email = e.userEmail || '';
          const name = e.userName || e.userEmail || `Usuario ${e.userId.slice(0, 8)}`;
          usersMap.set(e.userId, { id: e.userId, name, email });
        }
      });

      return { entries: all, availableUsers: Array.from(usersMap.values()) };
    },
    staleTime: 30_000,
  });

  const allEntries = data?.entries ?? [];
  const availableUsers = usersData && usersData.length > 0 ? usersData : data?.availableUsers ?? [];

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

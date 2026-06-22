import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RecoveryAuditEntry, RecoveryModule, RecoveryPreview, RecoveryStatus } from '@/types/recovery';
import { groupRecoveryOperations } from '@/components/settings/recovery/recoveryHelpers';

const PAGE_SIZE = 40;

export interface RecoveryFilters {
  search: string;
  module: RecoveryModule | 'all';
  source: RecoveryAuditEntry['source'] | 'all';
  userId: string;
  status: RecoveryStatus | 'all';
  dateFrom: string;
  dateTo: string;
}

export function useRecoveryCenter(filters: RecoveryFilters, page: number) {
  const [entries, setEntries] = useState<RecoveryAuditEntry[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase.from('recovery_audit_entries').select('*', { count: 'exact' });
    if (filters.module !== 'all') query = query.eq('module', filters.module);
    if (filters.source !== 'all') query = query.eq('source', filters.source);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
    if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59.999`);
    if (filters.status === 'reverted') query = query.not('reverted_at', 'is', null);
    if (filters.status === 'reversible') query = query.eq('reversible', true).is('reverted_at', null);
    if (filters.status === 'blocked') query = query.eq('reversible', false).is('reverted_at', null);
    if (filters.search.trim()) {
      const safe = filters.search.trim().replace(/[%(),]/g, '');
      query = query.or(`record_label.ilike.%${safe}%,metadata->>summary.ilike.%${safe}%`);
    }
    const from = (page - 1) * PAGE_SIZE;
    const { data, error: queryError, count } = await query.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (queryError) {
      setError(queryError.message);
      setEntries([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as RecoveryAuditEntry[];
    setEntries(rows);
    setTotal(count ?? 0);
    const ids = [...new Set(rows.map((entry) => entry.user_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
      setUsers(Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile.full_name || profile.email])));
    } else setUsers({});
    setLoading(false);
  }, [filters, page]);

  useEffect(() => { void load(); }, [load]);
  const operations = useMemo(() => groupRecoveryOperations(entries, users), [entries, users]);

  const preview = (operationId: string) =>
    supabase.rpc('preview_recovery_operation', { p_operation_id: operationId }).then(({ data, error: rpcError }) => {
      if (rpcError) throw rpcError;
      return data as unknown as RecoveryPreview;
    });

  const execute = (operationId: string, confirmation: string) =>
    supabase.rpc('execute_recovery_operation', { p_operation_id: operationId, p_confirmation: confirmation }).then(({ data, error: rpcError }) => {
      if (rpcError) throw rpcError;
      return data;
    });

  return { operations, loading, error, total, pageSize: PAGE_SIZE, reload: load, preview, execute };
}


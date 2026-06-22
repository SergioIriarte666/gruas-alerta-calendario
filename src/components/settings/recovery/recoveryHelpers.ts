import { addDays } from 'date-fns';
import type { RecoveryAuditEntry, RecoveryOperation } from '@/types/recovery';

export const RECOVERY_RETENTION_DAYS = 90;

export function groupRecoveryOperations(
  entries: RecoveryAuditEntry[],
  users: Record<string, string>,
): RecoveryOperation[] {
  const grouped = new Map<string, RecoveryAuditEntry[]>();
  entries.forEach((entry) => grouped.set(entry.operation_id, [...(grouped.get(entry.operation_id) ?? []), entry]));
  return [...grouped.entries()].map(([operationId, operationEntries]) => {
    const first = operationEntries[0];
    const reverted = operationEntries.every((entry) => Boolean(entry.reverted_at));
    const blocked = operationEntries.some((entry) => !entry.reversible);
    return {
      operationId,
      entries: operationEntries,
      createdAt: first.created_at,
      module: first.module,
      source: first.source,
      userId: first.user_id,
      userName: first.user_id ? users[first.user_id] ?? 'Usuario desconocido' : 'Automatización',
      status: reverted ? 'reverted' : blocked ? 'blocked' : 'reversible',
      expiresAt: addDays(new Date(first.created_at), RECOVERY_RETENTION_DAYS).toISOString(),
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function changedFields(entry: RecoveryAuditEntry) {
  const keys = new Set([...Object.keys(entry.old_data ?? {}), ...Object.keys(entry.new_data ?? {})]);
  return [...keys].filter((key) => JSON.stringify(entry.old_data?.[key]) !== JSON.stringify(entry.new_data?.[key]));
}

export function recoveryConfirmationPhrase(count: number) {
  return `REVERTIR ${count} REGISTROS`;
}


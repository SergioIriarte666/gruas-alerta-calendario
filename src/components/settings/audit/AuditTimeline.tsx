import { AuditEntry, AuditOperation } from '@/hooks/useAuditLog';
import { formatAuditDescription, formatTimeLabel, formatDateGroupLabel, getDateKey } from './auditHelpers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

const DOT_COLOR: Record<AuditOperation, string> = {
  INSERT: 'bg-green-500',
  UPDATE: 'bg-amber-500',
  DELETE: 'bg-red-500',
};

const BADGE_COLOR: Record<AuditOperation, string> = {
  INSERT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  UPDATE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const OPERATION_LABEL: Record<AuditOperation, string> = {
  INSERT: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
};

interface AuditTimelineProps {
  entries: AuditEntry[];
  loading: boolean;
  onEntryClick: (entry: AuditEntry) => void;
  selectedEntryId: number | null;
  hasMore: boolean;
  onLoadMore: () => void;
}

export const AuditTimeline = ({
  entries,
  loading,
  onEntryClick,
  selectedEntryId,
  hasMore,
  onLoadMore,
}: AuditTimelineProps) => {
  if (loading && entries.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="mt-1 size-2 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!loading && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <ClipboardList className="mb-3 size-10 opacity-30" />
        <p className="text-sm">No hay eventos para los filtros seleccionados</p>
      </div>
    );
  }

  // Agrupar por fecha
  const groups: { dateKey: string; label: string; entries: AuditEntry[] }[] = [];
  for (const entry of entries) {
    const key = getDateKey(entry.timestamp);
    const last = groups[groups.length - 1];
    if (!last || last.dateKey !== key) {
      groups.push({ dateKey: key, label: formatDateGroupLabel(entry.timestamp), entries: [entry] });
    } else {
      last.entries.push(entry);
    }
  }

  const dotColor = (op: AuditOperation) => DOT_COLOR[op] ?? 'bg-violet-500';

  return (
    <div className="space-y-1">
      {groups.map((group) => (
        <div key={group.dateKey}>
          {/* Separador de fecha */}
          <div className="sticky top-0 z-10 -mx-1 mb-1 bg-background/90 px-1 py-1 backdrop-blur-sm">
            <span className="text-xs font-semibold capitalize text-muted-foreground">
              {group.label}
            </span>
          </div>

          <div className="space-y-0.5">
            {group.entries.map((entry) => {
              const isSelected = entry.id === selectedEntryId;
              const isSystemOrActivity =
                entry.source === 'backup_logs' ||
                entry.source === 'notification_logs' ||
                entry.source === 'user_activity_log';

              return (
                <button
                  key={`${entry.source}-${entry.id}`}
                  onClick={() => onEntryClick(entry)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/40',
                    isSelected
                      ? 'border-primary/40 bg-primary/5 border-l-2'
                      : 'border-transparent',
                  )}
                >
                  {/* Hora */}
                  <span className="w-10 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                    {formatTimeLabel(entry.timestamp)}
                  </span>

                  {/* Dot */}
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      isSystemOrActivity ? 'bg-violet-500' : dotColor(entry.operation),
                    )}
                  />

                  {/* Contenido */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {formatAuditDescription(entry)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.userEmail || entry.userName || 'sistema'} · {entry.tableName}
                    </p>
                  </div>

                  {/* Badge operación */}
                  {!isSystemOrActivity && (
                    <span
                      className={cn(
                        'ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                        BADGE_COLOR[entry.operation],
                      )}
                    >
                      {OPERATION_LABEL[entry.operation]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {hasMore && (
        <div className="pt-3 text-center">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading}>
            {loading ? 'Cargando…' : 'Cargar más'}
          </Button>
        </div>
      )}
    </div>
  );
};

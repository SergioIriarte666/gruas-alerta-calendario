import { FIELD_LABELS, SUMMARY_RESOLVED_FIELDS, formatValue } from '@/lib/serviceHistoryPresentation';
import { businessClock } from '@/utils/businessClock';

import React, { useState } from 'react';
import { useGroupedServiceChangeHistory, type ServiceChangeEntry } from '@/hooks/useServiceChangeHistory';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { es } from 'date-fns/locale';
import { History, Plus, Pencil, Trash2, User, Camera, Package, ChevronDown } from 'lucide-react';

interface ServiceChangeHistoryProps {
  serviceId: string;
}

const ITEM_FIELD_PREFIX = 'Item: ';
const isItemChange = (fieldName: string) => fieldName.startsWith(ITEM_FIELD_PREFIX);
const itemLabel = (fieldName: string) => fieldName.slice(ITEM_FIELD_PREFIX.length);

const MAX_VISIBLE_CHANGES = 5;

const getChangeTypeConfig = (changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'SNAPSHOT') => {
  switch (changeType) {
    case 'CREATE':
      return {
        icon: Plus,
        label: 'Creación',
        bgColor: 'bg-success/10',
        textColor: 'text-success',
        borderColor: 'border-success/30',
      };
    case 'UPDATE':
      return {
        icon: Pencil,
        label: 'Modificación',
        bgColor: 'bg-warning/10',
        textColor: 'text-warning',
        borderColor: 'border-warning/30',
      };
    case 'DELETE':
      return {
        icon: Trash2,
        label: 'Eliminación',
        bgColor: 'bg-danger/10',
        textColor: 'text-danger',
        borderColor: 'border-danger/30',
      };
    case 'SNAPSHOT':
      return {
        icon: Camera,
        label: 'Estado Inicial',
        bgColor: 'bg-info/10',
        textColor: 'text-info',
        borderColor: 'border-info/30',
      };
  }
};

const ChangeRow: React.FC<{ change: ServiceChangeEntry }> = ({ change }) => {
  // SNAPSHOT o CREATE nuevo: estado inicial serializado como JSON. Los CREATE
  // históricos sin JSON mantienen la presentación breve anterior.
  const hasInitialSnapshot =
    change.changeType === 'CREATE' &&
    change.fieldName === 'servicio' &&
    Boolean(change.newValue);

  if (change.changeType === 'SNAPSHOT' || hasInitialSnapshot) {
    try {
      const snapshotData = JSON.parse(change.newValue || '{}');
      const snapshotFields = Object.entries(snapshotData).filter(
        ([, value]) => value !== null && value !== ''
      );

      return (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground italic mb-2">{change.changeSummary}</p>
          {snapshotFields.map(([fieldName, value]) => (
            <div key={fieldName} className="flex items-start gap-2 rounded bg-background/60 px-2 py-1 text-xs">
              <span className="font-medium text-foreground min-w-36">
                {FIELD_LABELS[fieldName] || fieldName}:
              </span>
              <span className="text-foreground">{formatValue(fieldName, String(value))}</span>
            </div>
          ))}
        </div>
      );
    } catch {
      return (
        <div className="text-xs text-muted-foreground italic">
          {change.changeSummary || 'Estado inicial registrado'}
        </div>
      );
    }
  }

  const isItem = isItemChange(change.fieldName);
  const usesResolvedSummary = SUMMARY_RESOLVED_FIELDS.has(change.fieldName);
  const label = isItem ? itemLabel(change.fieldName) : FIELD_LABELS[change.fieldName] || change.fieldName;

  return (
    <div className="flex items-start gap-2 rounded bg-background/60 px-2 py-1.5 text-xs">
      {isItem && <Package className="mt-0.5 size-3 shrink-0 text-muted-foreground" />}
      <span className="font-medium text-foreground min-w-36">{label}:</span>
      {change.changeType === 'CREATE' ? (
        <span className="text-muted-foreground italic">
          {change.changeSummary || (isItem ? 'Item agregado' : 'Servicio creado')}
        </span>
      ) : change.changeType === 'DELETE' ? (
        <span className="text-muted-foreground italic">
          {change.changeSummary || (isItem ? 'Item eliminado' : 'Servicio eliminado')}
        </span>
      ) : usesResolvedSummary && change.changeSummary ? (
        // Los FK y los recursos guardan el resumen con nombres legibles.
        <span className="text-muted-foreground">
          {change.changeSummary.replace(/^[^:]+:\s*/, '')}
        </span>
      ) : (
        <span className="text-muted-foreground">
          <span className="line-through opacity-60">{formatValue(change.fieldName, change.oldValue)}</span>
          <span className="mx-1.5">→</span>
          <span className="font-medium text-foreground">{formatValue(change.fieldName, change.newValue)}</span>
        </span>
      )}
    </div>
  );
};

export const ServiceChangeHistory: React.FC<ServiceChangeHistoryProps> = ({ serviceId }) => {
  const { data: groupedChanges, isLoading, error } = useGroupedServiceChangeHistory(serviceId);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const toggleExpanded = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        Error al cargar el historial de cambios
      </div>
    );
  }

  if (!groupedChanges || groupedChanges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <History className="size-12 mb-4 opacity-50" />
        <p className="text-sm">No hay cambios registrados para este servicio</p>
      </div>
    );
  }

  const totalChanges = groupedChanges.reduce((acc, g) => acc + g.changes.length, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border border-l-4 border-l-warning bg-warning/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-warning/10 p-1.5">
              <History className="size-4 text-warning" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Historial de Cambios</h3>
          </div>
          <Badge variant="secondary" className="text-xs">
            {groupedChanges.length} {groupedChanges.length === 1 ? 'evento' : 'eventos'} · {totalChanges}{' '}
            {totalChanges === 1 ? 'cambio' : 'cambios'}
          </Badge>
        </div>

      <ScrollArea className="h-96">
        <div className="space-y-4 pb-4">
          {groupedChanges.map((group) => {
            const primaryChangeType = group.changes[0]?.changeType || 'UPDATE';
            const config = getChangeTypeConfig(primaryChangeType);
            const IconComponent = config.icon;
            const isExpanded = expandedEvents.has(group.eventId);
            const visibleChanges =
              isExpanded || group.changes.length <= MAX_VISIBLE_CHANGES
                ? group.changes
                : group.changes.slice(0, MAX_VISIBLE_CHANGES);
            const hiddenCount = group.changes.length - visibleChanges.length;

            return (
              <div
                key={group.eventId}
                className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-3`}
              >
                {/* Header del grupo */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <IconComponent className={`size-4 ${config.textColor}`} />
                    <span className={`text-xs font-medium ${config.textColor}`}>
                      {config.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {businessClock.format(group.date, "dd MMM yyyy, HH:mm", { locale: es })}
                    </span>
                  </div>
                </div>

                {/* Usuario */}
                <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
                  <User className="size-3" />
                  <span>{group.changerName}</span>
                  {group.changerEmail && (
                    <span className="text-muted-foreground/70">({group.changerEmail})</span>
                  )}
                </div>

                {/* Lista de cambios */}
                <div className="space-y-1.5">
                  {visibleChanges.map((change) => (
                    <ChangeRow key={change.id} change={change} />
                  ))}
                </div>

                {hiddenCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1.5 h-6 gap-1 px-2 text-xs text-muted-foreground"
                    onClick={() => toggleExpanded(group.eventId)}
                  >
                    <ChevronDown className="size-3" />
                    ver {hiddenCount} {hiddenCount === 1 ? 'cambio más' : 'cambios más'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
      </div>
    </div>
  );
};

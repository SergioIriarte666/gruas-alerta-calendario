import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, User, Plus, Pencil, Trash2, Camera } from 'lucide-react';
import { ChangeHistoryEntry, groupChangesByDateAndUser } from '@/hooks/useChangeHistory';

interface Props {
  changes: ChangeHistoryEntry[];
  isLoading?: boolean;
}

const typeMeta: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  CREATE: { label: 'Creación', icon: Plus, className: 'bg-primary/15 text-primary border-primary/30' },
  UPDATE: { label: 'Edición', icon: Pencil, className: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300' },
  DELETE: { label: 'Eliminación', icon: Trash2, className: 'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300' },
  SNAPSHOT: { label: 'Estado inicial', icon: Camera, className: 'bg-muted text-muted-foreground border-border' },
};

export const ChangeHistoryPanel: React.FC<Props> = ({ changes, isLoading }) => {
  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Cargando historial…</div>;
  }
  if (!changes || changes.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Clock className="size-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Sin registros de auditoría todavía</p>
      </div>
    );
  }

  const groups = groupChangesByDateAndUser(changes);

  return (
    <div className="space-y-4">
      {groups.map((group, idx) => (
        <Card key={idx} className="border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="size-4 text-primary" />
                <span className="font-medium text-foreground">{group.changerName}</span>
                {group.changerEmail && (
                  <span className="text-xs text-muted-foreground">({group.changerEmail})</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                {format(new Date(group.date), "dd 'de' MMMM yyyy, HH:mm", { locale: es })}
              </div>
            </div>
            <div className="space-y-2 pl-6 border-l-2 border-primary/20">
              {group.changes.map((c) => {
                const meta = typeMeta[c.changeType] ?? typeMeta.UPDATE;
                const Icon = meta.icon;
                return (
                  <div key={c.id} className="flex items-start gap-2 text-sm">
                    <Badge variant="outline" className={`${meta.className} flex items-center gap-1 shrink-0`}>
                      <Icon className="size-3" />
                      {meta.label}
                    </Badge>
                    <span className="text-foreground leading-relaxed">
                      {c.changeSummary || `${c.fieldName}: ${c.oldValue ?? '—'} → ${c.newValue ?? '—'}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
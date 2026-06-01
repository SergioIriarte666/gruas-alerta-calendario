import { useNavigate } from 'react-router-dom';
import { AuditEntry } from '@/hooks/useAuditLog';
import { useServiceChangeHistory } from '@/hooks/useServiceChangeHistory';
import { moduleLabel, moduleNavigationPath, formatTimeLabel, formatFieldLabel, formatFieldValue } from './auditHelpers';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── JsonDiff ──────────────────────────────────────────────────────────────────

interface JsonDiffProps {
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}

const JsonDiff = ({ oldData, newData }: JsonDiffProps) => {
  const allKeys = Array.from(
    new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})]),
  );

  if (allKeys.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin datos disponibles.</p>;
  }

  const rows = allKeys
    .map((key) => {
      const oldVal = oldData?.[key];
      const newVal = newData?.[key];
      const oldStr = oldVal !== undefined ? JSON.stringify(oldVal) : undefined;
      const newStr = newVal !== undefined ? JSON.stringify(newVal) : undefined;
      if (oldStr === newStr) return null;
      return {
        key,
        oldDisplay: oldVal !== undefined ? formatFieldValue(key, oldVal) : undefined,
        newDisplay: newVal !== undefined ? formatFieldValue(key, newVal) : undefined,
      };
    })
    .filter(Boolean) as { key: string; oldDisplay?: string; newDisplay?: string }[];

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin diferencias detectadas.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Campo</th>
            <th className="px-3 py-2 text-left font-medium text-red-600 dark:text-red-400">Antes</th>
            <th className="px-3 py-2 text-left font-medium text-green-600 dark:text-green-400">Después</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, oldDisplay, newDisplay }) => (
            <tr key={key} className="border-b border-border/30 last:border-0">
              <td className="px-3 py-2 text-muted-foreground">{formatFieldLabel(key)}</td>
              <td className="px-3 py-2 font-mono">
                {oldDisplay !== undefined ? (
                  <span className="rounded bg-red-50 px-1 text-red-700 dark:bg-red-900/20 dark:text-red-300">
                    {oldDisplay}
                  </span>
                ) : (
                  <span className="italic text-muted-foreground/50">—</span>
                )}
              </td>
              <td className="px-3 py-2 font-mono">
                {newDisplay !== undefined ? (
                  <span className="rounded bg-green-50 px-1 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                    {newDisplay}
                  </span>
                ) : (
                  <span className="italic text-muted-foreground/50">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── FieldChangesTab ───────────────────────────────────────────────────────────

interface FieldChangesTabProps {
  entry: AuditEntry;
}

const FieldChangesTab = ({ entry }: FieldChangesTabProps) => {
  const serviceId =
    entry.source === 'service_change_history' ? entry.entityId ?? null : null;

  const { data: changes = [], isLoading } = useServiceChangeHistory(serviceId);

  if (entry.source === 'service_change_history' && entry.fieldName) {
    // Mostrar el cambio individual del entry
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-border/50 p-3">
          <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {formatFieldLabel(entry.fieldName)}
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded bg-red-50 px-2 py-0.5 font-mono text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {formatFieldValue(entry.fieldName, entry.oldValue)}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="rounded bg-green-50 px-2 py-0.5 font-mono text-xs text-green-700 dark:bg-green-900/20 dark:text-green-300">
              {formatFieldValue(entry.fieldName, entry.newValue)}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatTimeLabel(entry.timestamp)} · {entry.userEmail || entry.userName || 'sistema'}
          </p>
        </div>

        {serviceId && (
          <>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {changes.slice(0, 20).map((c) => (
                  <div key={c.id} className="rounded-lg border border-border/40 bg-muted/20 p-3">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {formatFieldLabel(c.fieldName)}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                        {formatFieldValue(c.fieldName, c.oldValue)}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="rounded bg-green-50 px-1.5 py-0.5 font-mono text-xs text-green-700 dark:bg-green-900/20 dark:text-green-300">
                        {formatFieldValue(c.fieldName, c.newValue)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {formatTimeLabel(c.changedAt)} · {c.changerEmail || c.changerName || 'sistema'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      El historial campo a campo solo está disponible para eventos de servicios.
    </p>
  );
};

// ── AuditEntityDrawer ─────────────────────────────────────────────────────────

interface AuditEntityDrawerProps {
  entry: AuditEntry | null;
  open: boolean;
  onClose: () => void;
}

export const AuditEntityDrawer = ({ entry, open, onClose }: AuditEntityDrawerProps) => {
  const navigate = useNavigate();

  if (!entry) return null;

  const hasFieldChanges =
    entry.source === 'service_change_history' ||
    (entry.module === 'services' && !!entry.entityId);

  const title = entry.entityFolio
    ? `Historial de Servicio ${entry.entityFolio}`
    : `Historial de ${moduleLabel(entry.module)}`;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-[520px]">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex flex-wrap items-center gap-2 text-base">
            {title}
            <Badge variant="outline" className="text-xs font-normal">
              {moduleLabel(entry.module)}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-y-auto">
          <Tabs defaultValue={hasFieldChanges ? 'fields' : 'snapshot'}>
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="fields" disabled={!hasFieldChanges}>
                Cambios campo a campo
              </TabsTrigger>
              <TabsTrigger value="snapshot">Snapshot completo</TabsTrigger>
            </TabsList>

            <TabsContent value="fields" className="mt-0">
              {hasFieldChanges && <FieldChangesTab entry={entry} />}
            </TabsContent>

            <TabsContent value="snapshot" className="mt-0">
              <JsonDiff oldData={entry.oldData} newData={entry.newData} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="mt-4 shrink-0 border-t border-border/50 pt-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              navigate(moduleNavigationPath(entry.module));
              onClose();
            }}
          >
            <ExternalLink className="size-3.5" />
            Ver en {moduleLabel(entry.module)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

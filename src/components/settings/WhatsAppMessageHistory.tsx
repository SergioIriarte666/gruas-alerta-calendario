import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, RefreshCw, CheckCheck, Check, Send, XCircle, Clock, EyeOff, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type LogStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

interface LogRow {
  id: string;
  created_at: string;
  event: string | null;
  template_name: string;
  recipient_phone: string;
  status: LogStatus;
  provider_message_id: string | null;
  error_code: string | null;
  error_message: string | null;
  attempts: number | null;
  context: Record<string, unknown> | null;
  hidden_at: string | null;
}

const STATUS_META: Record<LogStatus, { label: string; icon: React.ElementType; className: string }> = {
  queued: { label: 'En cola', icon: Clock, className: 'bg-muted text-muted-foreground' },
  sent: { label: 'Enviado', icon: Send, className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  delivered: { label: 'Entregado', icon: Check, className: 'bg-primary/10 text-primary border-primary/30' },
  read: { label: 'Leído', icon: CheckCheck, className: 'bg-primary/15 text-primary border-primary/40' },
  failed: { label: 'Fallido', icon: XCircle, className: 'bg-destructive/10 text-destructive border-destructive/30' },
};

const COUNTER_STATUSES: LogStatus[] = ['delivered', 'sent', 'failed'];

const getStatusQueryValues = (status: 'all' | LogStatus): LogStatus[] => {
  if (status === 'all') return [];
  if (status === 'delivered') return ['delivered', 'read'];
  return [status];
};

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export const WhatsAppMessageHistory: React.FC = () => {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | LogStatus>('all');
  const [showHidden, setShowHidden] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<
    | { type: 'one'; id: string }
    | { type: 'bulk' }
    | { type: 'failed' }
    | null
  >(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any)
      .from('whatsapp_message_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    const statusValues = getStatusQueryValues(statusFilter);
    if (statusValues.length === 1) query = query.eq('status', statusValues[0]);
    if (statusValues.length > 1) query = query.in('status', statusValues);
    if (showHidden) {
      query = query.not('hidden_at', 'is', null);
    } else {
      query = query.is('hidden_at', null);
    }
    const { data, error } = await query;
    if (!error) setRows((data as LogRow[]) ?? []);
    setSelected(new Set());
    setLoading(false);

    // Counts independientes del filtro de estado (solo respetan visibilidad)
    const results = await Promise.all(
      COUNTER_STATUSES.map(async (s) => {
        let q = (supabase as any)
          .from('whatsapp_message_log')
          .select('id', { count: 'exact', head: true });
        const values = getStatusQueryValues(s);
        q = values.length === 1 ? q.eq('status', values[0]) : q.in('status', values);
        q = showHidden ? q.not('hidden_at', 'is', null) : q.is('hidden_at', null);
        const { count } = await q;
        return [s, count ?? 0] as const;
      })
    );
    setCounts(Object.fromEntries(results));
  }, [statusFilter, showHidden]);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const applyHide = async (ids: string[], hide: boolean) => {
    if (ids.length === 0) return;
    setActing(true);
    const { data: userRes } = await supabase.auth.getUser();
    const payload = hide
      ? { hidden_at: new Date().toISOString(), hidden_by: userRes.user?.id ?? null }
      : { hidden_at: null, hidden_by: null };
    const { error } = await (supabase as any)
      .from('whatsapp_message_log')
      .update(payload)
      .in('id', ids);
    setActing(false);
    setConfirm(null);
    if (error) {
      toast.error(hide ? 'No se pudieron ocultar' : 'No se pudieron restaurar', {
        description: error.message,
      });
      return;
    }
    toast.success(
      hide
        ? `${ids.length} mensaje${ids.length === 1 ? '' : 's'} oculto${ids.length === 1 ? '' : 's'}`
        : `${ids.length} mensaje${ids.length === 1 ? '' : 's'} restaurado${ids.length === 1 ? '' : 's'}`
    );
    await load();
  };

  const hideSelected = () => setConfirm({ type: 'bulk' });
  const hideFailed = () => setConfirm({ type: 'failed' });

  const executeConfirm = async () => {
    if (!confirm) return;
    const hide = !showHidden;
    if (confirm.type === 'one') return applyHide([confirm.id], hide);
    if (confirm.type === 'bulk') return applyHide(Array.from(selected), hide);
    if (confirm.type === 'failed') {
      const ids = rows.filter((r) => r.status === 'failed').map((r) => r.id);
      return applyHide(ids, true);
    }
  };

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && selected.size < rows.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{showHidden ? 'Mensajes ocultos' : 'Últimos 50 mensajes'}</span>
          {COUNTER_STATUSES.map((s) => (
            <Badge key={s} variant="outline" className={STATUS_META[s].className}>
              {STATUS_META[s].label}: {counts[s] ?? 0}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1">
            <Switch
              id="wa-show-hidden"
              checked={showHidden}
              onCheckedChange={setShowHidden}
            />
            <Label htmlFor="wa-show-hidden" className="text-xs cursor-pointer">
              Mostrar ocultos
            </Label>
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="queued">En cola</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="delivered">Entregado</SelectItem>
              <SelectItem value="read">Leído</SelectItem>
              <SelectItem value="failed">Fallido</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {(selected.size > 0 || (statusFilter === 'failed' && !showHidden && (counts.failed ?? 0) > 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <div className="text-xs text-foreground">
            {selected.size > 0
              ? `${selected.size} seleccionado${selected.size === 1 ? '' : 's'}`
              : `${counts.failed ?? 0} fallidos en pantalla`}
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Button
                size="sm"
                variant={showHidden ? 'outline' : 'destructive'}
                onClick={hideSelected}
                disabled={acting}
              >
                {showHidden ? <Eye className="mr-1 h-3 w-3" /> : <EyeOff className="mr-1 h-3 w-3" />}
                {showHidden ? 'Restaurar' : 'Ocultar'} seleccionados
              </Button>
            )}
            {selected.size === 0 && statusFilter === 'failed' && !showHidden && (
              <Button size="sm" variant="outline" onClick={hideFailed} disabled={acting}>
                <Trash2 className="mr-1 h-3 w-3" />
                Ocultar todos los fallidos
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleSelectAll}
                  disabled={rows.length === 0}
                  aria-label="Seleccionar todo"
                />
              </TableHead>
              <TableHead className="w-[140px]">Fecha</TableHead>
              <TableHead>Evento / Plantilla</TableHead>
              <TableHead>Destinatario</TableHead>
              <TableHead className="w-[120px]">Estado</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead className="w-[60px] text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                  {showHidden ? 'No hay mensajes ocultos.' : 'Sin mensajes registrados todavía.'}
                </TableCell>
              </TableRow>
            ) : rows.map((row) => {
              const meta = STATUS_META[row.status] ?? STATUS_META.queued;
              const Icon = meta.icon;
              const folio = (row.context as any)?.folio;
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(row.id)}
                      onCheckedChange={() => toggleSelect(row.id)}
                      aria-label="Seleccionar fila"
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(row.created_at)}</TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{row.event || '—'}</div>
                    <div className="text-muted-foreground">{row.template_name}</div>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{row.recipient_phone}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={meta.className}>
                      <Icon className="mr-1 h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.status === 'failed' ? (
                      <span className="text-destructive">
                        [{row.error_code || 'ERR'}] {row.error_message || 'Sin detalle'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {folio ? `Folio ${folio} · ` : ''}
                        {row.attempts && row.attempts > 1 ? `${row.attempts} intentos` : ''}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={showHidden ? 'Restaurar' : 'Ocultar del historial'}
                      onClick={() => setConfirm({ type: 'one', id: row.id })}
                      disabled={acting}
                    >
                      {showHidden ? (
                        <Eye className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {showHidden ? 'Restaurar mensajes' : 'Ocultar mensajes del historial'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === 'one'
                ? showHidden
                  ? 'El mensaje volverá a aparecer en el historial.'
                  : 'El mensaje se ocultará del historial pero quedará guardado en la base de datos para auditoría.'
                : confirm?.type === 'bulk'
                ? showHidden
                  ? `Se restaurarán ${selected.size} mensaje${selected.size === 1 ? '' : 's'}.`
                  : `Se ocultarán ${selected.size} mensaje${selected.size === 1 ? '' : 's'}. Quedarán guardados en la BD.`
                : `Se ocultarán todos los mensajes fallidos visibles (${(counts.failed ?? 0)}). Quedarán guardados en la BD.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeConfirm} disabled={acting}>
              {acting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {showHidden ? 'Restaurar' : 'Ocultar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

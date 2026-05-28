import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Loader2, RefreshCw, CheckCheck, Check, Send, XCircle, Clock } from 'lucide-react';

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
}

const STATUS_META: Record<LogStatus, { label: string; icon: React.ElementType; className: string }> = {
  queued: { label: 'En cola', icon: Clock, className: 'bg-muted text-muted-foreground' },
  sent: { label: 'Enviado', icon: Send, className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  delivered: { label: 'Entregado', icon: Check, className: 'bg-primary/10 text-primary border-primary/30' },
  read: { label: 'Leído', icon: CheckCheck, className: 'bg-primary/15 text-primary border-primary/40' },
  failed: { label: 'Fallido', icon: XCircle, className: 'bg-destructive/10 text-destructive border-destructive/30' },
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

  const load = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any)
      .from('whatsapp_message_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (!error) setRows((data as LogRow[]) ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: rows.length };
    rows.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Últimos 50 mensajes</span>
          {(['delivered', 'sent', 'failed'] as LogStatus[]).map((s) => (
            <Badge key={s} variant="outline" className={STATUS_META[s].className}>
              {STATUS_META[s].label}: {counts[s] ?? 0}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-2">
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

      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Fecha</TableHead>
              <TableHead>Evento / Plantilla</TableHead>
              <TableHead>Destinatario</TableHead>
              <TableHead className="w-[120px]">Estado</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  Sin mensajes registrados todavía.
                </TableCell>
              </TableRow>
            ) : rows.map((row) => {
              const meta = STATUS_META[row.status] ?? STATUS_META.queued;
              const Icon = meta.icon;
              const folio = (row.context as any)?.folio;
              return (
                <TableRow key={row.id}>
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

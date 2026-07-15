import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, ArchiveRestore, Ban, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Loader2, Search, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useRecoveryCenter, type RecoveryFilters } from '@/hooks/useRecoveryCenter';
import type { RecoveryOperation, RecoveryPreview } from '@/types/recovery';
import { changedFields, recoveryConfirmationPhrase } from './recovery/recoveryHelpers';

const defaultFilters: RecoveryFilters = { search: '', module: 'all', source: 'all', userId: '', status: 'all', dateFrom: '', dateTo: '' };
const moduleLabels = { invoices: 'Facturas', services: 'Servicios', costs: 'Costos', inventory: 'Bodega' } as const;
const sourceLabels = { individual: 'Individual', batch: 'Masiva', import: 'Importación', automation: 'Automatización', reversal: 'Reversión' } as const;

function StatusBadge({ operation }: { operation: RecoveryOperation }) {
  if (operation.status === 'reverted') return <Badge variant="outline" className="gap-1 border-sky-300 bg-sky-50 text-sky-700"><CheckCircle2 className="size-3" />Revertida</Badge>;
  if (operation.status === 'blocked') return <Badge variant="outline" className="gap-1 border-slate-300 bg-slate-100 text-slate-700"><Ban className="size-3" />No reversible</Badge>;
  return <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700"><ShieldCheck className="size-3" />Reversible</Badge>;
}

export const RecoveryCenterTab = () => {
  const { isAdmin } = useUserPermissions();
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RecoveryOperation | null>(null);
  const [preview, setPreview] = useState<RecoveryPreview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const center = useRecoveryCenter(filters, page);
  const expectedPhrase = preview ? preview.confirmation_phrase ?? recoveryConfirmationPhrase(preview.total_records) : '';
  const totalPages = Math.max(1, Math.ceil(center.total / center.pageSize));

  const users = useMemo(() => {
    const map = new Map<string, string>();
    center.operations.forEach((operation) => operation.userId && map.set(operation.userId, operation.userName));
    return [...map.entries()];
  }, [center.operations]);

  if (!isAdmin) return <Alert variant="destructive"><Ban className="size-4" /><AlertTitle>Acceso restringido</AlertTitle><AlertDescription>Solo administradores pueden consultar o ejecutar recuperaciones.</AlertDescription></Alert>;

  const updateFilter = <K extends keyof RecoveryFilters>(key: K, value: RecoveryFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const simulate = async () => {
    if (!selected) return;
    setSimulating(true);
    try { setPreview(await center.preview(selected.operationId)); }
    catch (error) { toast.error('No se pudo simular la reversión', { description: error instanceof Error ? error.message : 'Error inesperado' }); }
    finally { setSimulating(false); }
  };

  const execute = async () => {
    if (!selected || confirmation !== expectedPhrase) return;
    setExecuting(true);
    try {
      await center.execute(selected.operationId, confirmation);
      toast.success('Reversión completada y verificada', { description: `${preview?.total_records ?? 0} registros restaurados en una única transacción.` });
      setSelected(null); setPreview(null); setConfirmation('');
      await center.reload();
    } catch (error) { toast.error('La transacción fue revertida', { description: error instanceof Error ? error.message : 'Ningún dato fue modificado.' }); }
    finally { setExecuting(false); }
  };

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 px-5 py-6 text-white shadow-lg sm:px-7">
        <div className="absolute -right-12 -top-20 size-52 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><div className="mb-3 flex size-11 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/10"><ArchiveRestore className="size-5 text-amber-300" /></div><h2 className="text-2xl font-semibold tracking-tight">Centro de recuperación</h2><p className="mt-1 max-w-2xl text-sm text-slate-300">Revise, simule y revierta operaciones con validaciones de seguridad y trazabilidad completa.</p></div>
          <Badge className="w-fit border-amber-300/30 bg-amber-300/10 text-amber-200 hover:bg-amber-300/10">Retención · 90 días</Badge>
        </div>
      </div>

      <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative sm:col-span-2"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Buscar operaciones" className="pl-9" placeholder="Folio, descripción…" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} /></div>
        <Select value={filters.module} onValueChange={(value) => updateFilter('module', value as RecoveryFilters['module'])}><SelectTrigger><SelectValue placeholder="Módulo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los módulos</SelectItem><SelectItem value="invoices">Facturas</SelectItem><SelectItem value="services">Servicios</SelectItem><SelectItem value="costs">Costos</SelectItem><SelectItem value="inventory">Bodega</SelectItem></SelectContent></Select>
        <Select value={filters.source} onValueChange={(value) => updateFilter('source', value as RecoveryFilters['source'])}><SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los tipos</SelectItem>{Object.entries(sourceLabels).map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        <Select value={filters.status} onValueChange={(value) => updateFilter('status', value as RecoveryFilters['status'])}><SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="reversible">Reversible</SelectItem><SelectItem value="reverted">Revertida</SelectItem><SelectItem value="blocked">No reversible</SelectItem></SelectContent></Select>
        <Select value={filters.userId || 'all'} onValueChange={(value) => updateFilter('userId', value === 'all' ? '' : value)}><SelectTrigger><SelectValue placeholder="Usuario" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los usuarios</SelectItem>{users.map(([id,name])=><SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>
        <div><Label className="sr-only" htmlFor="recovery-from">Desde</Label><Input id="recovery-from" type="date" value={filters.dateFrom} onChange={(event)=>updateFilter('dateFrom',event.target.value)} /></div>
        <div><Label className="sr-only" htmlFor="recovery-to">Hasta</Label><Input id="recovery-to" type="date" value={filters.dateTo} onChange={(event)=>updateFilter('dateTo',event.target.value)} /></div>
      </CardContent></Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{center.total.toLocaleString('es-CL')} registros auditados</span><span>Página {page} de {totalPages}</span></div>
      {center.error && <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertDescription>{center.error}</AlertDescription></Alert>}
      <div className="space-y-3">
        {center.loading ? [...Array(4)].map((_,index)=><Skeleton key={index} className="h-28 rounded-xl" />) : center.operations.length === 0 ? <Card><CardContent className="py-14 text-center"><ArchiveRestore className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium">No hay operaciones para estos filtros</p><p className="mt-1 text-sm text-muted-foreground">La auditoría aparecerá aquí desde que se aplique la migración.</p></CardContent></Card> : center.operations.map((operation)=><button key={operation.operationId} type="button" onClick={()=>{setSelected(operation);setPreview(null);setConfirmation('');}} className="group w-full rounded-xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="flex min-w-0 gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-primary">{operation.entries.length}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{moduleLabels[operation.module]}</span><Badge variant="secondary">{sourceLabels[operation.source]}</Badge><StatusBadge operation={operation} /></div><p className="mt-1 truncate text-sm text-muted-foreground">{operation.entries.map((entry)=>entry.record_label || entry.record_id.slice(0,8)).slice(0,3).join(' · ')}</p></div></div><div className="shrink-0 text-xs text-muted-foreground sm:text-right"><p className="flex items-center gap-1 sm:justify-end"><UserRound className="size-3" />{operation.userName}</p><p className="mt-1 flex items-center gap-1 sm:justify-end"><Clock3 className="size-3" />{format(new Date(operation.createdAt), "d MMM yyyy · HH:mm", { locale: es })}</p></div></div></button>)}
      </div>
      <div className="flex justify-end gap-2"><Button variant="outline" size="sm" disabled={page===1||center.loading} onClick={()=>setPage((value)=>value-1)}><ChevronLeft className="size-4" />Anterior</Button><Button variant="outline" size="sm" disabled={page>=totalPages||center.loading} onClick={()=>setPage((value)=>value+1)}>Siguiente<ChevronRight className="size-4" /></Button></div>

      <Dialog open={Boolean(selected)} onOpenChange={(open)=>{if(!open&&!executing&&!simulating){setSelected(null);setPreview(null);setConfirmation('');}}}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Vista previa de la operación</DialogTitle><DialogDescription>{selected ? `${moduleLabels[selected.module]} · ${selected.entries.length} registros · ${selected.userName}` : ''}</DialogDescription></DialogHeader>{selected && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Card><CardHeader className="p-4 pb-1"><CardTitle className="text-xs text-muted-foreground">Registros afectados</CardTitle></CardHeader><CardContent className="p-4 pt-0 text-2xl font-semibold">{selected.entries.length}</CardContent></Card><Card><CardHeader className="p-4 pb-1"><CardTitle className="text-xs text-muted-foreground">Estado</CardTitle></CardHeader><CardContent className="p-4 pt-1"><StatusBadge operation={selected} /></CardContent></Card><Card><CardHeader className="p-4 pb-1"><CardTitle className="text-xs text-muted-foreground">Expira</CardTitle></CardHeader><CardContent className="p-4 pt-0 text-sm font-medium">{format(new Date(selected.expiresAt),'dd/MM/yyyy')}</CardContent></Card></div><div className="space-y-2"><h3 className="text-sm font-semibold">Antes / Después</h3>{selected.entries.map((entry)=><div key={entry.id} className="rounded-lg border p-3"><p className="mb-2 text-sm font-medium">{entry.record_label || entry.record_id}</p><div className="space-y-1">{changedFields(entry).slice(0,12).map((field)=><div key={field} className="grid grid-cols-[110px_1fr_1fr] gap-2 text-xs"><span className="truncate font-medium text-muted-foreground">{field}</span><code className="truncate rounded bg-rose-50 px-2 py-1 text-rose-800">{JSON.stringify(entry.old_data?.[field]) ?? '—'}</code><code className="truncate rounded bg-emerald-50 px-2 py-1 text-emerald-800">{JSON.stringify(entry.new_data?.[field]) ?? '—'}</code></div>)}</div>{entry.non_reversible_reason&&<p className="mt-2 text-xs text-destructive">{entry.non_reversible_reason}</p>}</div>)}</div>{preview ? <div className="space-y-3"><Alert variant={preview.can_revert?'default':'destructive'}><ShieldCheck className="size-4" /><AlertTitle>{preview.can_revert?'Simulación aprobada':'Reversión bloqueada'}</AlertTitle><AlertDescription>{preview.restorable_records} restaurables · {preview.blocked_records} protegidos. La simulación no modificó datos.</AlertDescription></Alert>{[...preview.warnings,...preview.side_effects].map((warning)=><p key={warning} className="flex gap-2 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />{warning}</p>)}{preview.can_revert&&<div className="space-y-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-4"><Label htmlFor="recovery-confirmation">Escriba exactamente: <strong>{expectedPhrase}</strong></Label><Input id="recovery-confirmation" autoComplete="off" value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} /></div>}</div>:<Alert><AlertTriangle className="size-4" /><AlertDescription>Ejecute la simulación para detectar pagos, cierres, dependencias y registros incompatibles.</AlertDescription></Alert>}</div>}<DialogFooter><Button variant="outline" disabled={executing||simulating} onClick={()=>{setSelected(null);setPreview(null);setConfirmation('');}}>Cancelar</Button>{!preview&&<Button disabled={executing||simulating} onClick={simulate}>{simulating?<Loader2 className="size-4 animate-spin"/>:<ShieldCheck className="size-4"/>}Simular</Button>}{preview?.can_revert&&<Button variant="destructive" disabled={executing||confirmation!==expectedPhrase} onClick={execute}>{executing?<Loader2 className="size-4 animate-spin"/>:<ArchiveRestore className="size-4"/>}{executing?'Revirtiendo…':'Confirmar reversión'}</Button>}</DialogFooter></DialogContent></Dialog>
    </div>
  );
};

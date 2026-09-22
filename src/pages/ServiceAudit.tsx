import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppPagination } from '@/components/shared/AppPagination';
import { useServiceAudit, validAuditRange } from '@/hooks/services/useServiceAudit';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, filterServiceAuditRows, formatAuditValue, serviceAuditCsv } from '@/lib/serviceAudit';
import { businessClock } from '@/utils/businessClock';
import { SUMMARY_RESOLVED_FIELDS } from '@/lib/serviceHistoryPresentation';

const PAGE_SIZE = 50;
const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const defaultDates = () => { const today = businessClock.today(); return { from: `${today.slice(0, 7)}-01`, to: today }; };

export default function ServiceAudit() {
  const [dates, setDates] = useState(defaultDates);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [client, setClient] = useState('all');
  const [actor, setActor] = useState('all');
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, isError, refetch } = useServiceAudit(dates.from, dates.to);
  const valid = validAuditRange(dates.from, dates.to);
  const rows = useMemo(() => filterServiceAuditRows(data || [], search, category, actor, client), [data, search, category, actor, client]);
  const users = useMemo(() => [...new Map((data || []).map(row => [row.userId || 'system', row.userName])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'es')), [data]);
  const clients = useMemo(() => [...new Map((data || []).flatMap(row => row.clients.map(client => [client.id, client.name] as const))).entries()].sort((a, b) => a[1].localeCompare(b[1], 'es')), [data]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const linkedFolios = new Set(rows.filter(row => row.serviceIds.length).flatMap(row => row.folios));
  const serviceCount = new Set(rows.flatMap(row => row.serviceIds.length ? row.serviceIds : row.folios.filter(folio => !linkedFolios.has(folio)).map(folio => `deleted:${folio}`))).size;
  const formatDate = (value: string) => businessClock.format(value, 'dd/MM/yyyy HH:mm:ss');
  const updateDate = (field: 'from' | 'to', value: string) => { setDates(previous => ({ ...previous, [field]: value })); setPage(1); };
  const reset = () => { setDates(defaultDates()); setSearch(''); setCategory('all'); setActor('all'); setClient('all'); setPage(1); };
  const exportReport = () => {
    const blob = new Blob([serviceAuditCsv(rows, formatDate)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `auditoria-servicios_${dates.from}_${dates.to}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/services" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Servicios</Link>
          <h1 className="dashboard-section-title flex items-center gap-2"><History className="size-6 text-primary" />Auditoría de servicios</h1>
          <p className="dashboard-section-description">Quién modificó cada servicio y sus costos, cuándo y qué cambió.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refetch()} disabled={!valid || isFetching}><RefreshCw className={`mr-2 size-4 ${isFetching ? 'animate-spin' : ''}`} />Actualizar</Button>
          <Button variant="outline" onClick={exportReport} disabled={!valid || isFetching || isError || !rows.length}><Download className="mr-2 size-4" />Descargar informe CSV</Button>
        </div>
      </div>

      <Card className="border-border/70">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="audit-date-from">Modificado desde</Label><Input id="audit-date-from" type="date" value={dates.from} onChange={e => updateDate('from', e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="audit-date-to">Modificado hasta</Label><Input id="audit-date-to" type="date" value={dates.to} onChange={e => updateDate('to', e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="audit-search">Folio o patente</Label><Input id="audit-search" type="search" placeholder="Ej.: SRV-1052 o ABCD12" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
            <div className="space-y-2"><Label htmlFor="audit-client">Cliente</Label><select id="audit-client" className={selectClass} value={client} onChange={e => { setClient(e.target.value); setPage(1); }}><option value="all">Todos los clientes</option>{clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}<option value="unknown">Cliente no identificado</option></select></div>
            <div className="space-y-2"><Label htmlFor="audit-category">Tipo de cambio</Label><select id="audit-category" className={selectClass} value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>{AUDIT_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="audit-actor">Responsable</Label><select id="audit-actor" className={selectClass} value={actor} onChange={e => { setActor(e.target.value); setPage(1); }}><option value="all">Todos los responsables</option>{users.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Fechas de modificación · Zona horaria: {businessClock.timezone()}</span>
            <Button variant="ghost" size="sm" onClick={reset}>Restablecer filtros</Button>
          </div>
          {!valid && <p role="alert" className="text-sm text-destructive">Selecciona fechas válidas. La fecha inicial debe ser anterior o igual a la final.</p>}
        </CardContent>
      </Card>

      {valid && isError ? (
        <Card><CardContent className="space-y-3 p-6 text-center"><p role="alert" className="text-destructive">No se pudo cargar el informe completo. Intenta nuevamente.</p><Button variant="outline" onClick={() => void refetch()}>Reintentar</Button></CardContent></Card>
      ) : valid && isLoading ? (
        <p role="status" className="py-12 text-center text-muted-foreground">Cargando historial del período…</p>
      ) : valid && (
        <Card className="overflow-hidden border-border/70">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-4 sm:px-5">
            <p className="text-sm font-medium" aria-live="polite">{rows.length.toLocaleString('es-CL')} cambios · {serviceCount.toLocaleString('es-CL')} servicios</p>
            <span className="text-xs text-muted-foreground">El informe descarga todos los resultados filtrados</span>
          </div>
          {!rows.length ? <p className="p-10 text-center text-muted-foreground">No hay cambios registrados para los filtros seleccionados.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Historial de servicios y costos con valores anteriores y nuevos</caption>
                <thead className="bg-muted/40 text-muted-foreground"><tr>{['Cuándo / quién', 'Servicio', 'Cambio', 'Antes', 'Después'].map(label => <th scope="col" key={label} className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr></thead>
                <tbody>{visibleRows.map(row => (
                  <tr key={row.id} className="border-t border-border/40 align-top hover:bg-muted/20">
                    <td className="px-4 py-4"><div className="whitespace-nowrap tabular-nums">{formatDate(row.date)}</div><div className="mt-1 text-xs text-muted-foreground">{row.userName}</div></td>
                    <td className="px-4 py-4"><div className="font-medium text-primary">{row.folios.join(' / ') || 'Folio no disponible'}</div><div className="mt-1 text-xs text-muted-foreground" title="Cliente de referencia del servicio; incluye ambos clientes cuando el cambio corresponde al cliente">{row.clients.map(client => client.name).join(' / ') || 'Cliente no identificado'}</div>{row.plates.length > 0 && <div className="mt-1 text-xs text-muted-foreground" title="Patentes de referencia: actual o conservadas en el cambio">{row.plates.join(' / ')}</div>}{row.currentAssociation && <p className="mt-1 text-xs text-muted-foreground">Vínculo histórico no disponible; asociación de referencia.</p>}</td>
                    <td className="min-w-48 max-w-80 break-words px-4 py-4"><div className="font-medium">{row.label}</div><Badge variant="outline" className="mt-1 text-xs">{AUDIT_ACTIONS[row.action] || row.action}</Badge>{row.summary && <p className="mt-2 text-xs text-muted-foreground">{row.summary}</p>}{SUMMARY_RESOLVED_FIELDS.has(row.field) && <p className="mt-1 text-xs text-muted-foreground">Nombres en el detalle; identificadores en antes/después.</p>}</td>
                    <td className="min-w-36 max-w-80 whitespace-pre-wrap break-words px-4 py-4 text-muted-foreground">{formatAuditValue(row, row.before)}</td>
                    <td className="min-w-36 max-w-80 whitespace-pre-wrap break-words px-4 py-4 font-medium">{formatAuditValue(row, row.after)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div className="space-y-3 border-t border-border/60 p-4">
            <AppPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
            <p className="text-xs text-muted-foreground">Se muestran los cambios conservados por el sistema y los costos con un servicio identificable. Los cambios anteriores al inicio del registro no pueden reconstruirse. Una misma operación puede modificar varios campos.</p>
          </div>
        </Card>
      )}
    </div>
  );
}

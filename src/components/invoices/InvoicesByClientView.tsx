import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Edit,
  Eye,
  FileClock,
  ReceiptText,
  Search,
  UsersRound,
} from 'lucide-react';
import type { Invoice, InvoiceStatus } from '@/types';
import { formatCurrency, cn, toTitleCase } from '@/lib/utils';
import { formatForDisplay } from '@/utils/timezoneUtils';
import {
  ClientInvoiceHealth,
  groupInvoicesByClient,
  InvoiceClientGroup,
} from '@/utils/invoicesByClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { InvoiceDetailsModal } from '@/components/invoices/InvoiceDetailsModal';

type ClientFilter = 'all' | ClientInvoiceHealth;

interface InvoicesByClientViewProps {
  invoices: Invoice[];
  onEdit: (invoice: Invoice) => void;
  onMarkAsPaid: (invoiceId: string) => void;
  getInvoiceWithDetails: (invoice: Invoice) => Invoice;
}

const statusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'border-border/70 bg-muted/50 text-foreground' },
  sent: { label: 'Pendiente', className: 'border-info/30 bg-info/10 text-info' },
  paid: { label: 'Pagada', className: 'border-success/30 bg-success/10 text-success' },
  overdue: { label: 'Vencida', className: 'border-danger/30 bg-danger/10 text-danger' },
  cancelled: { label: 'Anulada', className: 'border-warning/30 bg-warning/10 text-warning' },
};

const healthConfig: Record<ClientInvoiceHealth, {
  label: string;
  description: string;
  className: string;
  iconClassName: string;
  textClassName: string;
  icon: typeof AlertTriangle;
}> = {
  overdue: {
    label: 'Con vencidas',
    description: 'Requiere gestión de cobranza',
    className: 'border-danger/30 bg-danger/10 text-danger',
    iconClassName: 'bg-danger/10 text-danger',
    textClassName: 'text-danger',
    icon: AlertTriangle,
  },
  pending: {
    label: 'Pendiente de pago',
    description: 'Tiene facturas enviadas por cobrar',
    className: 'border-warning/30 bg-warning/10 text-warning',
    iconClassName: 'bg-warning/10 text-warning',
    textClassName: 'text-warning',
    icon: Clock3,
  },
  draft: {
    label: 'Con borradores',
    description: 'Aún no tiene cobros emitidos',
    className: 'border-border/70 bg-muted/50 text-foreground',
    iconClassName: 'bg-muted text-muted-foreground',
    textClassName: 'text-muted-foreground',
    icon: FileClock,
  },
  current: {
    label: 'Al día',
    description: 'Sin saldos pendientes',
    className: 'border-success/30 bg-success/10 text-success',
    iconClassName: 'bg-success/10 text-success',
    textClassName: 'text-success',
    icon: CheckCircle2,
  },
};

const normalizeSearch = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const getInitials = (name: string) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join('') || 'CL';

const matchesSearch = (group: InvoiceClientGroup, rawSearch: string) => {
  const search = normalizeSearch(rawSearch);
  if (!search) return true;

  const searchableValues = [
    group.clientName,
    group.clientRut,
    ...group.invoices.flatMap((invoice) => [invoice.folio, invoice.numeroFiscal || '']),
  ];

  return searchableValues.some((value) => normalizeSearch(value).includes(search));
};

const ClientMetric = ({ label, value, valueClassName }: {
  label: string;
  value: string;
  valueClassName?: string;
}) => (
  <div className="min-w-0">
    <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={cn('mt-1 truncate text-sm font-semibold tabular-nums text-foreground', valueClassName)}>
      {value}
    </p>
  </div>
);

const InvoiceRow = ({ invoice, onView, onEdit, onMarkAsPaid }: {
  invoice: Invoice;
  onView: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onMarkAsPaid: (invoiceId: string) => void;
}) => {
  const canMarkAsPaid = invoice.status === 'sent' || invoice.status === 'overdue';

  return (
    <div className="grid gap-3 border-t border-border/60 px-4 py-4 first:border-t-0 lg:grid-cols-[minmax(10rem,1.2fr)_minmax(8rem,0.8fr)_minmax(8rem,0.9fr)_minmax(8rem,0.9fr)_auto] lg:items-center lg:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{invoice.folio || 'Sin folio'}</span>
          <Badge variant="outline" className={statusConfig[invoice.status].className}>
            {statusConfig[invoice.status].label}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          N° fiscal: {invoice.numeroFiscal || 'Sin asignar'}
        </p>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Emisión</p>
        <p className="mt-1 text-sm font-medium text-foreground">{formatForDisplay(invoice.issueDate)}</p>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">
          {invoice.status === 'paid' ? 'Fecha de pago' : 'Vencimiento'}
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {invoice.status === 'paid'
            ? invoice.paymentDate ? formatForDisplay(invoice.paymentDate) : 'No registrada'
            : formatForDisplay(invoice.dueDate)}
        </p>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Total</p>
        <p className="mt-1 text-sm font-bold tabular-nums text-foreground">{formatCurrency(invoice.total)}</p>
      </div>

      <div className="flex items-center gap-2 lg:justify-end">
        <Button variant="outline" size="sm" onClick={() => onView(invoice)} title="Ver factura">
          <Eye className="size-4" />
          <span className="sr-only">Ver factura</span>
        </Button>
        {invoice.status !== 'cancelled' && (
          <Button variant="outline" size="sm" onClick={() => onEdit(invoice)} title="Editar factura">
            <Edit className="size-4" />
            <span className="sr-only">Editar factura</span>
          </Button>
        )}
        {canMarkAsPaid && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMarkAsPaid(invoice.id)}
            className="border-success/30 bg-success/10 text-success hover:bg-success/15 hover:text-success"
            title="Registrar pago"
          >
            <CheckCircle2 className="size-4" />
            <span className="hidden xl:inline">Registrar pago</span>
          </Button>
        )}
      </div>
    </div>
  );
};

export const InvoicesByClientView = ({
  invoices,
  onEdit,
  onMarkAsPaid,
  getInvoiceWithDetails,
}: InvoicesByClientViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState<ClientFilter>('all');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  const detailedInvoices = useMemo(
    () => invoices.map((invoice) => {
      const detailedInvoice = getInvoiceWithDetails(invoice);
      return {
        ...detailedInvoice,
        client: detailedInvoice.client ?? invoice.client,
      };
    }),
    [getInvoiceWithDetails, invoices],
  );
  const clientGroups = useMemo(() => groupInvoicesByClient(detailedInvoices), [detailedInvoices]);

  const visibleGroups = useMemo(() => clientGroups.filter((group) => {
    const matchesFilter = clientFilter === 'all' || group.health === clientFilter;
    return matchesFilter && matchesSearch(group, searchTerm);
  }), [clientFilter, clientGroups, searchTerm]);

  const summary = useMemo(() => clientGroups.reduce((totals, group) => ({
    overdueClients: totals.overdueClients + (group.counts.overdue > 0 ? 1 : 0),
    outstandingAmount: totals.outstandingAmount + group.outstandingAmount,
    totalPaid: totals.totalPaid + group.totalPaid,
  }), { overdueClients: 0, outstandingAmount: 0, totalPaid: 0 }), [clientGroups]);

  const toggleClient = (clientId: string) => {
    setExpandedClients((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const expandVisible = () => setExpandedClients(new Set(visibleGroups.map((group) => group.clientId)));
  const collapseAll = () => setExpandedClients(new Set());
  const allVisibleExpanded = visibleGroups.length > 0
    && visibleGroups.every((group) => expandedClients.has(group.clientId));

  if (invoices.length === 0) {
    return (
      <Card className="finance-panel border-border/70 bg-card/80 shadow-sm">
        <CardContent className="py-14 text-center">
          <UsersRound className="mx-auto mb-4 size-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Aún no hay clientes con facturas</h3>
          <p className="mt-2 text-sm text-muted-foreground">Las facturas aparecerán aquí agrupadas por cliente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="finance-panel overflow-hidden border-border/70 bg-card/80 shadow-sm">
        <CardContent className="p-0">
          <div className="border-b border-border/60 px-5 py-5 lg:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <UsersRound className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Facturas por cliente</h2>
                    <p className="text-sm text-muted-foreground">
                      Estado de cobranza y documentos de cada cliente en una sola vista.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 xl:min-w-[42rem]">
                <ClientMetric label="Clientes" value={String(clientGroups.length)} />
                <ClientMetric
                  label="Con vencidas"
                  value={String(summary.overdueClients)}
                  valueClassName={summary.overdueClients > 0 ? 'text-danger' : 'text-foreground'}
                />
                <ClientMetric
                  label="Saldo por cobrar"
                  value={formatCurrency(summary.outstandingAmount)}
                  valueClassName="text-warning"
                />
                <ClientMetric label="Total cobrado" value={formatCurrency(summary.totalPaid)} valueClassName="text-success" />
              </div>
            </div>
          </div>

          <div className="grid gap-3 bg-muted/20 px-5 py-4 md:grid-cols-[minmax(0,1fr)_13rem_auto] lg:px-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar cliente, RUT, folio o N° fiscal..."
                className="bg-background pl-9"
                aria-label="Buscar facturas por cliente"
              />
            </div>
            <Select value={clientFilter} onValueChange={(value) => setClientFilter(value as ClientFilter)}>
              <SelectTrigger className="bg-background" aria-label="Filtrar clientes por estado">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="overdue">Con vencidas</SelectItem>
                <SelectItem value="pending">Pendientes de pago</SelectItem>
                <SelectItem value="draft">Con borradores</SelectItem>
                <SelectItem value="current">Al día</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={allVisibleExpanded ? collapseAll : expandVisible}
              disabled={visibleGroups.length === 0}
              className="bg-background"
            >
              {allVisibleExpanded ? <ChevronUp /> : <ChevronDown />}
              {allVisibleExpanded ? 'Contraer' : 'Expandir'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
        <span>{visibleGroups.length} de {clientGroups.length} cliente(s)</span>
        <span className="hidden sm:inline">Prioridad: vencidas y mayor saldo pendiente</span>
      </div>

      <div className="space-y-3">
        {visibleGroups.map((group) => {
          const isExpanded = expandedClients.has(group.clientId);
          const config = healthConfig[group.health];
          const HealthIcon = config.icon;

          return (
            <Collapsible key={group.clientId} open={isExpanded} onOpenChange={() => toggleClient(group.clientId)}>
              <Card className={cn(
                'finance-panel overflow-hidden border-border/70 bg-card/80 shadow-sm transition-shadow hover:shadow-md',
                group.health === 'overdue' && 'border-danger/30',
              )}>
                <CollapsibleTrigger asChild>
                  <button type="button" className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                    <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(14rem,1.3fr)_minmax(23rem,1fr)_auto] lg:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold', config.iconClassName)}>
                          {getInitials(group.clientName)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold text-foreground">{toTitleCase(group.clientName)}</h3>
                            <Badge variant="outline" className={config.className}>{config.label}</Badge>
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="size-3" />
                            {group.clientRut || 'RUT no registrado'} · {group.invoices.length} factura(s)
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
                        <ClientMetric label="Facturado" value={formatCurrency(group.totalBilled)} />
                        <ClientMetric label="Cobrado" value={formatCurrency(group.totalPaid)} valueClassName="text-success" />
                        <ClientMetric
                          label="Por cobrar"
                          value={formatCurrency(group.outstandingAmount)}
                          valueClassName={group.outstandingAmount > 0 ? 'text-warning' : 'text-muted-foreground'}
                        />
                        <ClientMetric
                          label="Vencidas"
                          value={String(group.counts.overdue)}
                          valueClassName={group.counts.overdue > 0 ? 'text-danger' : 'text-muted-foreground'}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 lg:justify-end">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <HealthIcon className={cn('size-4', config.textClassName)} />
                          <span className="hidden xl:inline">{config.description}</span>
                        </div>
                        <div className="rounded-md border border-border/70 bg-background p-1.5 text-muted-foreground">
                          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </div>
                      </div>
                    </div>

                    <div className="flex h-1 w-full bg-muted/40" aria-hidden="true">
                      {group.counts.overdue > 0 && <div className="bg-danger" style={{ flex: group.counts.overdue }} />}
                      {group.counts.sent > 0 && <div className="bg-warning" style={{ flex: group.counts.sent }} />}
                      {group.counts.paid > 0 && <div className="bg-success" style={{ flex: group.counts.paid }} />}
                      {group.counts.draft > 0 && <div className="bg-muted-foreground/40" style={{ flex: group.counts.draft }} />}
                      {group.counts.cancelled > 0 && <div className="bg-border" style={{ flex: group.counts.cancelled }} />}
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t border-border/60 bg-muted/15">
                    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3 text-xs sm:px-5">
                      <span className="font-medium text-muted-foreground">Estados:</span>
                      {(['overdue', 'sent', 'paid', 'draft', 'cancelled'] as InvoiceStatus[]).map((status) => (
                        group.counts[status] > 0 && (
                          <Badge key={status} variant="outline" className={statusConfig[status].className}>
                            {statusConfig[status].label}: {group.counts[status]}
                          </Badge>
                        )
                      ))}
                      {group.draftAmount > 0 && (
                        <span className="ml-auto text-muted-foreground">
                          En borrador: <strong className="text-foreground">{formatCurrency(group.draftAmount)}</strong>
                        </span>
                      )}
                    </div>

                    <div className="bg-card/50">
                      {group.invoices.map((invoice) => (
                        <InvoiceRow
                          key={invoice.id}
                          invoice={invoice}
                          onView={setViewingInvoice}
                          onEdit={onEdit}
                          onMarkAsPaid={onMarkAsPaid}
                        />
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {visibleGroups.length === 0 && (
        <Card className="border-dashed border-border/70 bg-card/60">
          <CardContent className="py-12 text-center">
            <ReceiptText className="mx-auto mb-3 size-10 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">No encontramos clientes</h3>
            <p className="mt-1 text-sm text-muted-foreground">Prueba con otro término o cambia el filtro de estado.</p>
          </CardContent>
        </Card>
      )}

      <InvoiceDetailsModal
        invoice={viewingInvoice}
        isOpen={!!viewingInvoice}
        onClose={() => setViewingInvoice(null)}
      />
    </div>
  );
};

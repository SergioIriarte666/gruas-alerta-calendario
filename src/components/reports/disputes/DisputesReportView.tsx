import { useMemo, useState } from 'react';
import { subDays } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowUpDown, ArrowUp, ArrowDown, Download, AlertTriangle, Loader2 } from 'lucide-react';
import DatePickerInput from '@/components/common/DatePickerInput';
import { useClients } from '@/hooks/useClients';
import { useDisputesReport, DisputesReportFilters, DisputeReportRow } from '@/hooks/reports/useDisputesReport';
import { DISPUTE_TYPE_OPTIONS, DISPUTE_TYPE_LABELS } from '@/utils/serviceDisputeUtils';
import { exportDisputesReport } from '@/utils/reports/disputeReportExporter';
import { safeDaysSince, safeDateToDisplaySlashes, toLocalDateString } from '@/utils/timezoneUtils';
import { businessClock } from '@/utils/businessClock';
import { toTitleCase } from '@/lib/utils';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import { DisputeDetailModal } from './DisputeDetailModal';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';

const logger = createLogger('DisputesReport');

type SortField = 'disputedAmount' | 'daysOpen' | 'createdAt' | 'resolvedAt';
type SortDirection = 'asc' | 'desc';

const SortIcon = ({ field, currentSortField, sortDirection }: {
  field: SortField;
  currentSortField: SortField | null;
  sortDirection: SortDirection;
}) => {
  if (currentSortField !== field) {
    return <ArrowUpDown className="ml-1 size-3.5 text-muted-foreground" />;
  }
  return sortDirection === 'asc'
    ? <ArrowUp className="ml-1 size-3.5 text-primary" />
    : <ArrowDown className="ml-1 size-3.5 text-primary" />;
};

const daysOpenFor = (row: DisputeReportRow): number => {
  const from = row.createdAt.slice(0, 10);
  const to = row.status === 'open' ? businessClock.today() : (row.resolvedAt || businessClock.today()).slice(0, 10);
  return Math.max(0, safeDaysSince(from, to));
};

export const DisputesReportView = () => {
  const { clients = [] } = useClients();

  const [dateFrom, setDateFrom] = useState(() => toLocalDateString(subDays(businessClock.todayDate(), 90)));
  const [dateTo, setDateTo] = useState(() => toLocalDateString(businessClock.todayDate()));
  const [clientId, setClientId] = useState('all');
  const [status, setStatus] = useState<DisputesReportFilters['status']>('all');
  const [disputeType, setDisputeType] = useState<DisputesReportFilters['disputeType']>('all');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [detailDispute, setDetailDispute] = useState<DisputeReportRow | null>(null);
  const [modalService, setModalService] = useState<Service | null>(null);
  const [loadingServiceId, setLoadingServiceId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters: DisputesReportFilters = useMemo(
    () => ({ dateFrom, dateTo, clientId, status, disputeType }),
    [dateFrom, dateTo, clientId, status, disputeType]
  );

  const { rows, loading } = useDisputesReport(filters);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortField) {
      // Default: abiertas primero, más antiguas arriba (orden estable por created_at asc del query)
      return [...rows].sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1));
    }
    return [...rows].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'disputedAmount':
          comparison = (a.disputedAmount ?? a.serviceValue) - (b.disputedAmount ?? b.serviceValue);
          break;
        case 'daysOpen':
          comparison = daysOpenFor(a) - daysOpenFor(b);
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'resolvedAt':
          comparison = new Date(a.resolvedAt || 0).getTime() - new Date(b.resolvedAt || 0).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [rows, sortField, sortDirection]);

  const summary = useMemo(() => {
    const openRows = rows.filter(r => r.status === 'open');
    const resolvedRows = rows.filter(r => r.status === 'resolved');

    const openSum = openRows.reduce((sum, r) => sum + (r.disputedAmount ?? r.serviceValue), 0);
    const avgAgeOpen = openRows.length > 0
      ? Math.round(openRows.reduce((sum, r) => sum + daysOpenFor(r), 0) / openRows.length)
      : 0;

    const avgResolutionDays = resolvedRows.length > 0
      ? Math.round(resolvedRows.reduce((sum, r) => sum + daysOpenFor(r), 0) / resolvedRows.length)
      : 0;

    const countByClient = new Map<string, number>();
    rows.forEach(r => countByClient.set(r.clientName, (countByClient.get(r.clientName) || 0) + 1));
    let topClient = '—';
    let topClientCount = 0;
    countByClient.forEach((count, name) => {
      if (count > topClientCount) {
        topClientCount = count;
        topClient = name;
      }
    });

    return {
      openCount: openRows.length,
      openSum,
      avgAgeOpen,
      resolvedCount: resolvedRows.length,
      avgResolutionDays,
      topClient,
      topClientCount,
    };
  }, [rows]);

  const chartData = useMemo(() => {
    return DISPUTE_TYPE_OPTIONS.map(option => {
      const typeRows = rows.filter(r => r.disputeType === option.value);
      return {
        type: option.label,
        Abiertas: typeRows.filter(r => r.status === 'open').length,
        Resueltas: typeRows.filter(r => r.status === 'resolved').length,
      };
    }).filter(d => d.Abiertas > 0 || d.Resueltas > 0);
  }, [rows]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportDisputesReport(sortedRows, { dateFrom, dateTo });
    } catch (error) {
      logger.error('Error exporting disputes report:', error);
      toast.error('No se pudo exportar el reporte');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenService = async (row: DisputeReportRow) => {
    setLoadingServiceId(row.id);
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          id, folio, request_date, service_date, vehicle_brand, vehicle_model, license_plate,
          origin, destination, value, status, operator_commission, created_at, updated_at,
          client:clients!services_client_id_fkey(id, name, rut, phone, email, address, department, is_active),
          service_types(id, name, description, base_price, is_active, vehicle_info_optional, purchase_order_required, origin_required, destination_required, crane_required, operator_required, vehicle_brand_required, vehicle_model_required, license_plate_required, created_at, updated_at)
        `)
        .eq('id', row.serviceId)
        .single();

      if (error || !data) {
        logger.error('Error fetching service for detail modal:', error);
        toast.error('No se pudo cargar el detalle del servicio');
        return;
      }

      const service: Service = {
        id: data.id,
        folio: data.folio,
        requestDate: data.request_date || data.service_date,
        serviceDate: data.service_date,
        client: {
          id: data.client?.id || '',
          name: data.client?.name || 'Cliente desconocido',
          rut: data.client?.rut || '',
          phone: data.client?.phone || '',
          email: data.client?.email || '',
          address: data.client?.address || '',
          department: data.client?.department || 'General',
          isActive: data.client?.is_active ?? true,
          createdAt: '',
          updatedAt: '',
        },
        vehicleBrand: data.vehicle_brand || '',
        vehicleModel: data.vehicle_model || '',
        licensePlate: data.license_plate || '',
        origin: data.origin || '',
        destination: data.destination || '',
        serviceType: {
          id: data.service_types?.id || '',
          name: data.service_types?.name || '',
          description: data.service_types?.description || '',
          basePrice: data.service_types?.base_price || 0,
          isActive: data.service_types?.is_active ?? true,
          vehicleInfoOptional: data.service_types?.vehicle_info_optional || false,
          purchaseOrderRequired: data.service_types?.purchase_order_required || false,
          originRequired: data.service_types?.origin_required !== false,
          destinationRequired: data.service_types?.destination_required !== false,
          craneRequired: data.service_types?.crane_required !== false,
          operatorRequired: data.service_types?.operator_required !== false,
          vehicleBrandRequired: data.service_types?.vehicle_brand_required !== false,
          vehicleModelRequired: data.service_types?.vehicle_model_required !== false,
          licensePlateRequired: data.service_types?.license_plate_required !== false,
          createdAt: data.service_types?.created_at || '',
          updatedAt: data.service_types?.updated_at || '',
        },
        value: Number(data.value || 0),
        crane: null,
        operator: null,
        operatorCommission: Number(data.operator_commission || 0),
        status: data.status as Service['status'],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      setModalService(service);
    } catch (error) {
      logger.error('Unexpected error opening service detail:', error);
      toast.error('No se pudo cargar el detalle del servicio');
    } finally {
      setLoadingServiceId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros propios del reporte */}
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Desde</p>
            <DatePickerInput value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Hasta</p>
            <DatePickerInput value={dateTo} onChange={setDateTo} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Cliente</p>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients.filter(c => c.isActive).sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                  <SelectItem key={c.id} value={c.id}>{toTitleCase(c.name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Estado</p>
            <Select value={status} onValueChange={(v) => setStatus(v as DisputesReportFilters['status'])}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="open">Abiertas</SelectItem>
                <SelectItem value="resolved">Resueltas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Tipo de disputa</p>
            <Select value={disputeType} onValueChange={(v) => setDisputeType(v as DisputesReportFilters['disputeType'])}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {DISPUTE_TYPE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto">
            <Button onClick={handleExport} disabled={exporting || rows.length === 0} size="sm" className="h-9 gap-2">
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards de resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Disputas Abiertas</p>
            <div className="text-lg sm:text-2xl font-bold mt-1 text-warning-text">{summary.openCount}</div>
            <p className="text-xs sm:text-xs text-muted-foreground mt-0.5">${summary.openSum.toLocaleString('es-CL')}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Antigüedad Promedio (abiertas)</p>
            <div className="text-lg sm:text-2xl font-bold mt-1 text-foreground">{summary.avgAgeOpen} días</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Resueltas en el Período</p>
            <div className="text-lg sm:text-2xl font-bold mt-1 text-success-text">{summary.resolvedCount}</div>
            <p className="text-xs sm:text-xs text-muted-foreground mt-0.5">Promedio {summary.avgResolutionDays} días</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Cliente con Más Disputas</p>
            <div className="text-sm sm:text-lg font-bold mt-1 text-foreground truncate">{summary.topClient}</div>
            {summary.topClientCount > 0 && (
              <p className="text-xs sm:text-xs text-muted-foreground mt-0.5">{summary.topClientCount} disputa(s)</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico por tipo, apilado por estado */}
      {chartData.length > 0 && (
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Disputas por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="Abiertas" stackId="disputas" fill="hsl(var(--warning))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Resueltas" stackId="disputas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabla principal */}
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground text-base">Servicios en Disputa ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando disputas...</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <AlertTriangle className="size-10 text-muted-foreground/60" />
              <p className="font-medium text-foreground">No se encontraron disputas</p>
              <p className="text-sm text-muted-foreground">Ajusta los filtros para ver otros resultados.</p>
            </div>
          ) : (
            <TooltipProvider>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Folio</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('disputedAmount')}>
                        <div className="flex items-center">Monto <SortIcon field="disputedAmount" currentSortField={sortField} sortDirection={sortDirection} /></div>
                      </TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('daysOpen')}>
                        <div className="flex items-center">Días Abierta <SortIcon field="daysOpen" currentSortField={sortField} sortDirection={sortDirection} /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('createdAt')}>
                        <div className="flex items-center">Creación <SortIcon field="createdAt" currentSortField={sortField} sortDirection={sortDirection} /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('resolvedAt')}>
                        <div className="flex items-center">Resolución <SortIcon field="resolvedAt" currentSortField={sortField} sortDirection={sortDirection} /></div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map(row => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-accent/20"
                        onClick={() => setDetailDispute(row)}
                      >
                        <TableCell>
                          <button
                            type="button"
                            className="font-medium text-primary hover:underline disabled:opacity-50"
                            disabled={loadingServiceId === row.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenService(row);
                            }}
                          >
                            {loadingServiceId === row.id ? 'Cargando...' : row.serviceFolio}
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{toTitleCase(row.clientName)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{DISPUTE_TYPE_LABELS[row.disputeType]}</Badge>
                        </TableCell>
                        <TableCell className="max-w-56">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate text-muted-foreground cursor-help">{row.description}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">{row.description}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.referenceDoc || '-'}</TableCell>
                        <TableCell className="font-medium text-foreground">
                          ${(row.disputedAmount ?? row.serviceValue).toLocaleString('es-CL')}
                        </TableCell>
                        <TableCell>
                          <Badge className={row.status === 'open'
                            ? 'border border-warning/30 bg-warning-soft text-warning-text hover:bg-warning-soft'
                            : 'border border-success/30 bg-success-soft text-success-text hover:bg-success-soft'}
                          >
                            {row.status === 'open' ? 'Abierta' : 'Resuelta'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{daysOpenFor(row)}</TableCell>
                        <TableCell className="text-muted-foreground">{safeDateToDisplaySlashes(row.createdAt.slice(0, 10))}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.resolvedAt ? safeDateToDisplaySlashes(row.resolvedAt.slice(0, 10)) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      <DisputeDetailModal dispute={detailDispute} onOpenChange={(open) => !open && setDetailDispute(null)} />

      {modalService && (
        <ServiceDetailsModal
          service={modalService}
          isOpen={!!modalService}
          onClose={() => setModalService(null)}
        />
      )}
    </div>
  );
};

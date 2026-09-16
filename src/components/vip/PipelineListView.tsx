import { differenceInCalendarDates } from '@/utils/calendarDate';
import { parseDateValue } from '@/utils/calendarDate';
import { businessClock } from '@/utils/businessClock';
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BarChart3,
  Search,
  ChevronDown,
  ChevronRight,
  DollarSign,
  TrendingUp,
  Calendar,
  FileText,
  Clock,
  Eye,
  Edit,
  Car,
  Hash,
  CheckSquare,
  ChevronUp,
  ChevronsUpDown,
  Filter,
  X,
  Download,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { AdvancedServiceFilters } from '@/components/services/AdvancedServiceFilters';
import { useAdvancedFilters } from '@/hooks/useAdvancedFilters';
import { Service, ServiceStatus } from '@/types';

import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { BatchUpdateModal, BatchUpdateData } from './BatchUpdateModal';
import { PipelineExportModal } from './PipelineExportModal';
import { PipelineBatchActionBar } from './PipelineBatchActionBar';
import { PipelineClosureActionBar } from '@/components/pipeline/PipelineClosureActionBar';
import { usePipelineServiceExport } from '@/hooks/vip/usePipelineServiceExport';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { getVipPipelineDisplayStatus } from '@/utils/vipPipelineStatus';
import { toTitleCase } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useOpenServiceDisputes } from '@/hooks/services/useServiceDisputes';
import { MarkServiceDisputeModal } from '@/components/services/disputes/MarkServiceDisputeModal';
import { ResolveServiceDisputeModal } from '@/components/services/disputes/ResolveServiceDisputeModal';
import { DISPUTE_TYPE_LABELS } from '@/utils/serviceDisputeUtils';

interface SubGroupConfig {
  fieldExtractor: (s: Service) => string;
  emptyLabel: string;
  prefix: string;
  badgeColor: string;
  badgeBg: string;
}

// `quote_number` y `purchase_order` conviven en la base como NULL y como cadena
// vacía: ambos significan "sin documento" y deben caer en el mismo subgrupo.
const subGroupValue = (value?: string | null) => value?.trim() || '';

const getSubGroupConfig = (status: ServiceStatus): SubGroupConfig => {
  switch (status) {
    case 'quoted':
    case 'purchase_order_pending':
      return {
        fieldExtractor: (s) => subGroupValue(s.quoteNumber),
        emptyLabel: 'Sin Cotización',
        prefix: '',
        badgeColor: 'text-primary',
        badgeBg: 'bg-primary/10'
      };
    case 'invoiced':
    case 'partially_invoiced':
      return {
        fieldExtractor: (s) => subGroupValue(s.invoiceNumeroFiscal),
        emptyLabel: 'Sin Factura',
        prefix: '',
        badgeColor: 'text-success-text',
        badgeBg: 'bg-success/10'
      };
    default:
      return {
        fieldExtractor: (s) => subGroupValue(s.purchaseOrderNumber) || subGroupValue(s.purchaseOrder),
        emptyLabel: 'Sin O.C.',
        prefix: '',
        badgeColor: 'text-info-text',
        badgeBg: 'bg-info/10'
      };
  }
};

interface POSubGroup {
  poNumber: string;
  services: Service[];
  totalValue: number;
}

const groupByField = (services: Service[], config: SubGroupConfig, sortField?: SortField, sortDirection?: SortDirection, clientId?: string): POSubGroup[] => {
  const map: Record<string, POSubGroup> = {};
  services.forEach(s => {
    const val = config.fieldExtractor(s) || config.emptyLabel;
    if (!map[val]) map[val] = { poNumber: val, services: [], totalValue: 0 };
    map[val].services.push(s);
    map[val].totalValue += getDisplayServiceValue(s, clientId);
  });
  return Object.values(map).sort((a, b) => {
    // "Sin X" groups always go last
    if (a.poNumber === config.emptyLabel) return 1;
    if (b.poNumber === config.emptyLabel) return -1;

    const dir = sortDirection === 'asc' ? 1 : -1;

    switch (sortField) {
      case 'serviceDate': {
        const aDate = Math.max(...a.services.map(s => parseDateValue(s.serviceDate).getTime()));
        const bDate = Math.max(...b.services.map(s => parseDateValue(s.serviceDate).getTime()));
        return (aDate - bDate) * dir;
      }
      case 'value':
        return (a.totalValue - b.totalValue) * dir;
      case 'folio': {
        const aFolio = a.services[0]?.folio || '';
        const bFolio = b.services[0]?.folio || '';
        return aFolio.localeCompare(bFolio) * dir;
      }
      case 'serviceType': {
        const aType = String(a.services[0]?.serviceType || '');
        const bType = String(b.services[0]?.serviceType || '');
        return aType.localeCompare(bType) * dir;
      }
      case 'daysInStatus': {
        const now = businessClock.now().getTime();
        const aAvg = a.services.reduce((sum, s) => sum + (now - parseDateValue(s.serviceDate).getTime()), 0) / a.services.length;
        const bAvg = b.services.reduce((sum, s) => sum + (now - parseDateValue(s.serviceDate).getTime()), 0) / b.services.length;
        return (aAvg - bAvg) * dir;
      }
      default:
        // For quoteNumber, purchaseOrder, invoiceNumeroFiscal: alphabetical by group label
        return a.poNumber.localeCompare(b.poNumber) * dir;
    }
  });
};

// 'disputed' es un grupo 100% de UI: no existe como estado en la base ni en ServiceStatus.
const DISPUTED_GROUP_STATUS = 'disputed' as const;
type PipelineGroupStatus = ServiceStatus | typeof DISPUTED_GROUP_STATUS;

interface ServiceGroup {
  status: PipelineGroupStatus;
  title: string;
  services: Service[];
  totalValue: number;
  averageDays: number;
  color: string;
  textColor: string;
  sortingDate: Date | null;
  sortingDateLabel: string;
}

interface PipelineListViewProps {
  services: Service[];
  loading: boolean;
  clientId: string;
  clientName: string;
  onServiceUpdate: () => void;
  onServiceSelect?: (service: Service) => void;
  onServiceEdit?: (service: Service) => void;
  onBatchUpdate?: (updates: BatchUpdateData) => Promise<void>;
}

type SortField = 'folio' | 'serviceType' | 'serviceDate' | 'value' | 'daysInStatus' | 'quoteNumber' | 'purchaseOrder' | 'invoiceNumeroFiscal';
type SortDirection = 'asc' | 'desc';

// Definir los estados del pipeline con estilos neutros del sistema de diseño
const PIPELINE_STATUSES = [
  {
    id: 'pending' as ServiceStatus,
    title: 'Programados',
    description: 'Servicios confirmados y programados',
    color: 'bg-secondary text-secondary-foreground',
    textColor: 'text-foreground'
  },
  {
    id: 'in_progress' as ServiceStatus,
    title: 'En Progreso',
    description: 'Servicios ejecutándose actualmente',
    color: 'bg-secondary text-secondary-foreground',
    textColor: 'text-foreground'
  },
  {
    id: 'completed' as ServiceStatus,
    title: 'Completados',
    description: 'Servicios finalizados exitosamente',
    color: 'bg-secondary text-secondary-foreground',
    textColor: 'text-foreground'
  },
  {
    id: 'failed' as ServiceStatus,
    title: 'Fallidos',
    description: 'Servicios que no pudieron completarse',
    color: 'bg-secondary text-secondary-foreground',
    textColor: 'text-foreground'
  },
  {
    id: 'quoted' as ServiceStatus,
    title: 'Cotizados',
    description: 'Servicios con cotización enviada',
    color: 'bg-secondary text-secondary-foreground',
    textColor: 'text-foreground'
  },
  {
    id: 'purchase_order_pending' as ServiceStatus,
    title: 'Esperando O.C.',
    description: 'Aguardando orden de compra del cliente',
    color: 'bg-secondary text-secondary-foreground',
    textColor: 'text-foreground'
  },
  {
    id: 'with_purchase_order' as ServiceStatus,
    title: 'Con Orden de Compra',
    description: 'Servicios con orden de compra recibida',
    color: 'bg-secondary text-secondary-foreground',
    textColor: 'text-foreground'
  },
  {
    id: 'partially_invoiced' as ServiceStatus,
    title: 'Parcialmente Facturado',
    description: 'Servicios con un cierre facturado, falta el otro',
    color: 'bg-warning/10 text-warning-text',
    textColor: 'text-warning-text'
  },
  {
    id: 'invoiced' as ServiceStatus,
    title: 'Facturados',
    description: 'Servicios facturados y cerrados',
    color: 'bg-secondary text-secondary-foreground',
    textColor: 'text-foreground'
  }
];

export const PipelineListView: React.FC<PipelineListViewProps> = ({
  services,
  loading,
  clientId,
  clientName,
  onServiceUpdate: _onServiceUpdate,
  onServiceSelect,
  onServiceEdit,
  onBatchUpdate
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<PipelineGroupStatus>>(new Set([DISPUTED_GROUP_STATUS]));
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set(['__all__']));
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [sortField, setSortField] = useState<SortField>('serviceDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [disputeModalService, setDisputeModalService] = useState<Service | null>(null);
  const [resolveModalService, setResolveModalService] = useState<Service | null>(null);

  const serviceIds = useMemo(() => services.map(s => s.id), [services]);
  const { openDisputesByServiceId } = useOpenServiceDisputes(serviceIds);

  // Hook para filtros avanzados
  const {
    isOpen: isAdvancedFiltersOpen,
    setIsOpen: setIsAdvancedFiltersOpen,
    filters: advancedFilters,
    hasActiveFilters,
    applyAdvancedFilters,
    clearFilters: clearAdvancedFilters,
    updateFilters: updateAdvancedFilters
  } = useAdvancedFilters();

  // Hook para exportación del pipeline
  const { exportToPDF, exportToExcel } = usePipelineServiceExport(
    services,
    toTitleCase(clientName),
    clientId
  );

  // Función para ordenar servicios
  const sortServices = (services: Service[]): Service[] => {
    return [...services].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'folio':
          aValue = a.folio || '';
          bValue = b.folio || '';
          break;
        case 'serviceType':
          aValue = a.serviceType.name || '';
          bValue = b.serviceType.name || '';
          break;
        case 'serviceDate':
          aValue = parseFromDatabase(a.serviceDate);
          bValue = parseFromDatabase(b.serviceDate);
          break;
        case 'value':
          aValue = getDisplayServiceValue(a, clientId);
          bValue = getDisplayServiceValue(b, clientId);
          break;
        case 'daysInStatus':
          aValue = differenceInCalendarDates(businessClock.today(), a.serviceDate);
          bValue = differenceInCalendarDates(businessClock.today(), b.serviceDate);
          break;
        case 'quoteNumber':
          aValue = a.quoteNumber || '';
          bValue = b.quoteNumber || '';
          break;
        case 'purchaseOrder':
          aValue = a.purchaseOrderNumber || a.purchaseOrder || '';
          bValue = b.purchaseOrderNumber || b.purchaseOrder || '';
          break;
        case 'invoiceNumeroFiscal':
          aValue = a.invoiceNumeroFiscal || '';
          bValue = b.invoiceNumeroFiscal || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Aplicar filtros avanzados y agrupar servicios por estado
  const serviceGroups = useMemo(() => {
    // Aplicar filtros avanzados primero
    const filteredServices = applyAdvancedFilters(services, { searchTerm, statusFilter: 'all' });

    // Los servicios con disputa abierta se excluyen de su grupo de estado real
    // y se reagrupan en el grupo virtual "En Disputa" (100% de UI).
    const disputedServices = filteredServices.filter(s => openDisputesByServiceId.has(s.id));
    const nonDisputedServices = filteredServices.filter(s => !openDisputesByServiceId.has(s.id));

    const groupedServices = nonDisputedServices.reduce((groups, service) => {
      const status = getVipPipelineDisplayStatus(service);
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(service);
      return groups;
    }, {} as Record<ServiceStatus, Service[]>);

    const statusGroups = PIPELINE_STATUSES
      .map(statusConfig => {
        const statusServices = groupedServices[statusConfig.id] || [];
        const totalValue = statusServices.reduce((sum, s) => sum + getDisplayServiceValue(s, clientId), 0);
        const averageDays = statusServices.length > 0
          ? statusServices.reduce((sum, s) => {
              const days = differenceInCalendarDates(businessClock.today(), s.serviceDate);
              return sum + days;
            }, 0) / statusServices.length
          : 0;

        // Calcular fecha de ordenamiento según el estado
        let sortingDate: Date | null = null;
        let sortingDateLabel = '';

        if (statusServices.length > 0) {
          switch (statusConfig.id) {
            case 'pending':
              // Para programados: mostrar la fecha más próxima
              sortingDate = statusServices
                .map(s => parseFromDatabase(s.serviceDate))
                .sort((a, b) => a.getTime() - b.getTime())[0];
              sortingDateLabel = 'Próximo';
              break;
            case 'completed':
            case 'failed':
              // Para completados y fallidos: mostrar la fecha más reciente
              sortingDate = statusServices
                .map(s => parseFromDatabase(s.serviceDate))
                .sort((a, b) => b.getTime() - a.getTime())[0];
              sortingDateLabel = 'Último';
              break;
            case 'invoiced':
              // Para facturados: mostrar la fecha más reciente
              sortingDate = statusServices
                .map(s => parseFromDatabase(s.serviceDate))
                .sort((a, b) => b.getTime() - a.getTime())[0];
              sortingDateLabel = 'Último';
              break;
            default:
              // Para otros estados: mostrar la fecha más reciente
              sortingDate = statusServices
                .map(s => parseFromDatabase(s.serviceDate))
                .sort((a, b) => b.getTime() - a.getTime())[0];
              sortingDateLabel = 'Reciente';
          }
        }

        return {
          status: statusConfig.id,
          title: statusConfig.title,
          services: sortServices(statusServices),
          totalValue,
          averageDays: Math.round(averageDays),
          color: statusConfig.color,
          textColor: statusConfig.textColor,
          sortingDate,
          sortingDateLabel
        } as ServiceGroup;
      })
      .filter(group => group.services.length > 0);

    if (disputedServices.length === 0) {
      return statusGroups;
    }

    const disputedTotalValue = disputedServices.reduce((sum, s) => {
      const dispute = openDisputesByServiceId.get(s.id);
      const amount = dispute?.disputedAmount ?? getDisplayServiceValue(s, clientId);
      return sum + amount;
    }, 0);

    const disputedGroup: ServiceGroup = {
      status: DISPUTED_GROUP_STATUS,
      title: 'En Disputa',
      services: sortServices(disputedServices),
      totalValue: disputedTotalValue,
      averageDays: 0,
      color: 'bg-warning/15 text-warning-text',
      textColor: 'text-warning-text',
      sortingDate: null,
      sortingDateLabel: ''
    };

    return [disputedGroup, ...statusGroups];
  }, [services, searchTerm, sortField, sortDirection, advancedFilters, applyAdvancedFilters, clientId, openDisputesByServiceId]);

  const toggleGroup = (status: ServiceStatus) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(status)) {
      newExpanded.delete(status);
    } else {
      newExpanded.add(status);
    }
    setExpandedGroups(newExpanded);
  };

  const expandAll = () => {
    setExpandedGroups(new Set(serviceGroups.map(g => g.status)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const handleServiceSelection = (serviceId: string, checked: boolean) => {
    // Servicios en disputa no son seleccionables para batch ni para crear cierre
    if (checked && openDisputesByServiceId.has(serviceId)) return;
    const newSelected = new Set(selectedServices);
    if (checked) {
      newSelected.add(serviceId);
    } else {
      newSelected.delete(serviceId);
    }
    setSelectedServices(newSelected);
  };

  const handleSelectAll = (groupServices: Service[], checked: boolean) => {
    const newSelected = new Set(selectedServices);
    groupServices.forEach(service => {
      if (checked) {
        if (openDisputesByServiceId.has(service.id)) return;
        newSelected.add(service.id);
      } else {
        newSelected.delete(service.id);
      }
    });
    setSelectedServices(newSelected);
  };

  const handleBatchUpdate = async (updates: BatchUpdateData) => {
    if (onBatchUpdate) {
      await onBatchUpdate(updates);
      setSelectedServices(new Set()); // Limpiar selección después de actualizar
    }
  };

  // Handlers para filtros avanzados
  const handleApplyAdvancedFilters = () => {
    setIsAdvancedFiltersOpen(false);
  };

  const handleClearAdvancedFilters = () => {
    clearAdvancedFilters();
    setIsAdvancedFiltersOpen(false);
  };

  const handleExport = (format: 'pdf' | 'excel', options: { includeStatuses?: ServiceStatus[]; includeAllStatuses?: boolean }) => {
    if (format === 'pdf') {
      exportToPDF(options);
    } else {
      exportToExcel(options);
    }
  };

  const selectedServicesArray = useMemo(
    () => services.filter(s => selectedServices.has(s.id)),
    [services, selectedServices]
  );

  // Calcular suma total de servicios seleccionados
  const selectedTotalValue = useMemo(() =>
    selectedServicesArray.reduce((sum, s) => sum + getDisplayServiceValue(s, clientId), 0),
    [selectedServicesArray, clientId]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="size-4 text-muted-foreground" />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="size-4 text-primary" />
      : <ChevronDown className="size-4 text-primary" />;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {getSortIcon(field)}
      </div>
    </TableHead>
  );

  const getStatusBadge = (status: ServiceStatus) => {
    const statusConfig = PIPELINE_STATUSES.find(s => s.id === status);
    if (!statusConfig) return null;

    return (
      <Badge variant="secondary">
        {statusConfig.title}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-muted-foreground">
            Cargando pipeline de servicios...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de acciones para servicios seleccionados */}
      {selectedServices.size > 0 && (
        <PipelineBatchActionBar
          selectedCount={selectedServices.size}
          totalAmount={selectedTotalValue}
          onBatchUpdate={() => setShowBatchModal(true)}
          onClearSelection={() => setSelectedServices(new Set())}
        />
      )}

      {/* Header and Search */}
      <Card className="bg-card border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <BarChart3 className="size-5" />
            Pipeline de Servicios por Estado
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                placeholder="Buscar por folio, tipo, cotización, orden de compra, N° fiscal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card border-border text-foreground"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAdvancedFiltersOpen(true)}
                className="relative"
              >
                <Filter className="size-4 mr-2" />
                Más Filtros
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 size-2 bg-primary rounded-full"></span>
                )}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAdvancedFilters}
                >
                  <X className="size-4" />
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expandir Todo
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Contraer Todo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportModal(true)}
                className="bg-primary/5 border-primary/20 hover:bg-primary/10"
              >
                <Download className="size-4 mr-2" />
                Exportar
              </Button>
              {selectedServices.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBatchModal(true)}
                >
                  <Hash className="size-4 mr-2" />
                  Actualizar por Lotes ({selectedServices.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <div>
                <div className="text-2xl font-bold text-foreground">{services.length}</div>
                <div className="text-sm text-muted-foreground">Total servicios</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {serviceGroups.length}
                </div>
                <div className="text-sm text-muted-foreground">Estados activos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="size-4 text-primary" />
              <div>
                <div className="text-2xl font-bold text-foreground">
                  ${services.reduce((sum, s) => sum + getDisplayServiceValue(s, clientId), 0).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Valor total pipeline</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grouped Services */}
      <div className="space-y-2">
        {serviceGroups.length === 0 ? (
          <Card className="bg-card border">
            <CardContent className="p-8 text-center text-muted-foreground">
              <BarChart3 className="size-12 mx-auto mb-4 opacity-50" />
              <p>No se encontraron servicios en el pipeline</p>
              <p className="text-sm mt-2">
                {searchTerm ? 'Intenta con diferentes términos de búsqueda' : 'Agrega servicios para ver el pipeline'}
              </p>
            </CardContent>
          </Card>
        ) : (
          serviceGroups.map((group) => {
            const isDisputedGroup = group.status === DISPUTED_GROUP_STATUS;

            return (
            <Collapsible
              key={group.status}
              open={expandedGroups.has(group.status)}
              onOpenChange={() => toggleGroup(group.status)}
            >
              <Card className={isDisputedGroup ? 'bg-card border-warning/40' : 'bg-card border'}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedGroups.has(group.status) ? (
                          <ChevronDown className="size-4 text-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-foreground" />
                        )}
                        <div className="flex items-center gap-2">
                          {isDisputedGroup ? (
                            <AlertTriangle className="size-4 text-warning-text" />
                          ) : (
                            <Checkbox
                              checked={group.services.every(s => selectedServices.has(s.id))}
                              onCheckedChange={(checked) => handleSelectAll(group.services, checked as boolean)}
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge className={`${group.color} ${group.textColor} border-0`}>
                                {group.title}
                              </Badge>
                            </div>
                            {!isDisputedGroup && (
                              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <Clock className="size-3" />
                                  Promedio: {group.averageDays} días
                                </span>
                                {group.sortingDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="size-3" />
                                    {group.sortingDateLabel}: {formatForDisplay(group.sortingDate)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-foreground">
                          ${group.totalValue.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {group.services.length} servicio{group.services.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {isDisputedGroup ? (
                      <TooltipProvider>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-muted-foreground w-12">
                                <CheckSquare className="size-4 opacity-40" />
                              </TableHead>
                              <TableHead className="text-muted-foreground">Folio</TableHead>
                              <TableHead className="text-muted-foreground">Tipo de Servicio</TableHead>
                              <TableHead className="text-muted-foreground">Estado Real</TableHead>
                              <TableHead className="text-muted-foreground">Fecha</TableHead>
                              <TableHead className="text-muted-foreground">Valor</TableHead>
                              <TableHead className="text-muted-foreground">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.services.map(service => {
                              const dispute = openDisputesByServiceId.get(service.id);
                              const realStatus = getVipPipelineDisplayStatus(service);
                              const isExcessView = Boolean(
                                service.hasExcess &&
                                clientId &&
                                service.thirdPartyClientId === clientId
                              );
                              return (
                                <TableRow key={service.id} className="border-muted">
                                  <TableCell>
                                    <Checkbox checked={false} disabled />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                                      <span>{service.folio}</span>
                                      {isExcessView && (
                                        <Badge className="h-5 border border-warning/30 bg-warning-soft px-1.5 text-xs text-warning hover:bg-warning-soft">
                                          Excedente
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-foreground">{service.serviceType.name}</div>
                                  </TableCell>
                                  <TableCell>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-2 cursor-help">
                                          {getStatusBadge(realStatus)}
                                          <AlertTriangle className="size-3.5 text-warning-text" />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <p className="font-medium">
                                          {dispute ? DISPUTE_TYPE_LABELS[dispute.disputeType] : 'En disputa'}
                                        </p>
                                        {dispute?.description && <p>{dispute.description}</p>}
                                        {dispute?.referenceDoc && <p>Referencia: {dispute.referenceDoc}</p>}
                                        {dispute?.disputedAmount != null && (
                                          <p>Monto en disputa: ${dispute.disputedAmount.toLocaleString('es-CL')}</p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-sm text-muted-foreground">
                                      {formatForDisplay(service.serviceDate)}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="font-medium text-foreground">
                                      ${getDisplayServiceValue(service, clientId).toLocaleString()}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onServiceSelect?.(service)}
                                        className="size-8 p-0 text-info-text hover:text-info-text"
                                        title="Ver detalles del servicio"
                                      >
                                        <Eye className="size-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setResolveModalService(service)}
                                        className="size-8 p-0 text-success-text hover:text-success-text"
                                        title="Resolver disputa"
                                      >
                                        <CheckCircle2 className="size-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TooltipProvider>
                    ) : (() => {
                      const subGroupConfig = getSubGroupConfig(group.status as ServiceStatus);
                      const poSubGroups = groupByField(group.services, subGroupConfig, sortField, sortDirection, clientId);
                      const hasMultiplePOs = poSubGroups.length > 1;

                      const renderServiceRow = (service: Service) => {
                        const daysInStatus = differenceInCalendarDates(businessClock.today(), service.serviceDate);
                        const isExcessView = Boolean(
                          service.hasExcess &&
                          clientId &&
                          service.thirdPartyClientId === clientId
                        );
                        return (
                          <TableRow key={service.id} className="border-muted">
                            <TableCell>
                              <Checkbox
                                checked={selectedServices.has(service.id)}
                                onCheckedChange={(checked) => handleServiceSelection(service.id, checked as boolean)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 font-medium text-foreground">
                                <span>{service.folio}</span>
                                {isExcessView && (
                                  <Badge className="h-5 border border-warning/30 bg-warning-soft px-1.5 text-xs text-warning hover:bg-warning-soft">
                                    Excedente
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-foreground">{service.serviceType.name}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground">
                                {formatForDisplay(service.serviceDate)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Car className="size-3" />
                                <span className="text-sm">
                                  {service.licensePlate || 'Sin vehículo'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-foreground">
                                ${getDisplayServiceValue(service, clientId).toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {daysInStatus} días
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {service.quoteNumber ? (
                                <code className="text-xs bg-muted px-1 rounded text-primary font-bold">
                                  {service.quoteNumber}
                                </code>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {(service.purchaseOrderNumber || service.purchaseOrder) ? (
                                <code className="text-xs bg-muted px-1 rounded text-info-text font-bold">
                                  {service.purchaseOrderNumber || service.purchaseOrder}
                                </code>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {service.invoiceNumeroFiscal ? (
                                <code className="text-xs bg-muted px-1 rounded text-success-text font-bold">
                                  {service.invoiceNumeroFiscal}
                                </code>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onServiceSelect?.(service)}
                                  className="size-8 p-0 text-info-text hover:text-info-text"
                                  title="Ver detalles del servicio"
                                >
                                  <Eye className="size-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onServiceEdit?.(service)}
                                  className="size-8 p-0 text-success-text hover:text-success-text"
                                  title="Editar servicio"
                                >
                                  <Edit className="size-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDisputeModalService(service)}
                                  className="size-8 p-0 text-warning-text hover:text-warning-text"
                                  title="Marcar en disputa"
                                >
                                  <AlertTriangle className="size-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      };

                      const tableHeader = (
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-muted-foreground w-12">
                              <CheckSquare className="size-4" />
                            </TableHead>
                            <SortableHeader field="folio">Folio</SortableHeader>
                            <SortableHeader field="serviceType">Tipo de Servicio</SortableHeader>
                            <SortableHeader field="serviceDate">Fecha</SortableHeader>
                            <TableHead className="text-muted-foreground">Patente Vehículo</TableHead>
                            <SortableHeader field="value">Valor</SortableHeader>
                            <SortableHeader field="daysInStatus">Días en Estado</SortableHeader>
                            <SortableHeader field="quoteNumber">Cotización</SortableHeader>
                            <SortableHeader field="purchaseOrder">Orden de Compra</SortableHeader>
                            <SortableHeader field="invoiceNumeroFiscal">N° Fiscal</SortableHeader>
                            <TableHead className="text-muted-foreground">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                      );

                      if (!hasMultiplePOs) {
                        return (
                          <Table>
                            {tableHeader}
                            <TableBody>
                              {group.services.map(renderServiceRow)}
                            </TableBody>
                          </Table>
                        );
                      }

                      const togglePO = (poKey: string) => {
                        setExpandedPOs(prev => {
                          const next = new Set(prev);
                          // On first interaction, remove the __all__ marker and expand all individually
                          if (next.has('__all__')) {
                            next.delete('__all__');
                            poSubGroups.forEach(sg => {
                              const key = `${group.status}-${sg.poNumber}`;
                              next.add(key);
                            });
                          }
                          if (next.has(poKey)) {
                            next.delete(poKey);
                          } else {
                            next.add(poKey);
                          }
                          return next;
                        });
                      };

                      const isPOExpanded = (poKey: string) => expandedPOs.has('__all__') || expandedPOs.has(poKey);

                      return (
                        <Table>
                          {tableHeader}
                          <TableBody>
                            {poSubGroups.map(subGroup => {
                              const poKey = `${group.status}-${subGroup.poNumber}`;
                              const isExpanded = isPOExpanded(poKey);
                              const subGroupSelectedCount = subGroup.services.filter(s => selectedServices.has(s.id)).length;
                              const subGroupAllSelected = subGroupSelectedCount === subGroup.services.length;
                              const subGroupSomeSelected = subGroupSelectedCount > 0 && !subGroupAllSelected;
                              const subGroupCheckedState: boolean | 'indeterminate' = subGroupAllSelected
                                ? true
                                : (subGroupSomeSelected ? 'indeterminate' : false);

                              return (
                                <React.Fragment key={subGroup.poNumber}>
                                  <TableRow
                                    className="bg-muted/30 hover:bg-muted/50 cursor-pointer border-muted"
                                    onClick={() => togglePO(poKey)}
                                  >
                                    <TableCell
                                      className="w-12 cursor-default"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Checkbox
                                        checked={subGroupCheckedState}
                                        onCheckedChange={(checked) => handleSelectAll(subGroup.services, checked === true)}
                                        aria-label={`Seleccionar todos los servicios de ${subGroup.poNumber}`}
                                      />
                                    </TableCell>
                                    <TableCell colSpan={10}>
                                      <div className="flex items-center justify-between py-0.5">
                                        <div className="flex items-center gap-2">
                                          {isExpanded ? (
                                            <ChevronDown className="size-3.5 text-muted-foreground" />
                                          ) : (
                                            <ChevronRight className="size-3.5 text-muted-foreground" />
                                          )}
                                          {subGroup.poNumber === subGroupConfig.emptyLabel ? (
                                            <span className="text-sm font-medium text-muted-foreground">{subGroupConfig.emptyLabel}</span>
                                          ) : (
                                            <code className={`text-sm font-bold ${subGroupConfig.badgeColor} ${subGroupConfig.badgeBg} px-2 py-0.5 rounded`}>
                                              {subGroupConfig.prefix}{subGroup.poNumber}
                                            </code>
                                          )}
                                          {subGroupSelectedCount > 0 && (
                                            <Badge variant="outline" className="text-xs text-primary border-primary/30">
                                              {subGroupSelectedCount}/{subGroup.services.length} seleccionados
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                          <span className="font-medium text-foreground">
                                            ${subGroup.totalValue.toLocaleString()}
                                          </span>
                                          <span className="text-muted-foreground">
                                            {subGroup.services.length} servicio{subGroup.services.length !== 1 ? 's' : ''}
                                          </span>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && subGroup.services.map(renderServiceRow)}
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      );
                    })()}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
            );
          })
          )}
      </div>

      {/* Barra de acciones para ir a crear el cierre en el módulo Cierres */}
      {selectedServices.size > 0 && (
        <PipelineClosureActionBar
          selectedCount={selectedServices.size}
          totalAmount={selectedTotalValue}
          onCreateClosure={() => navigate('/closures')}
          onClearSelection={() => setSelectedServices(new Set())}
        />
      )}

      {/* Batch Update Modal */}
      <BatchUpdateModal
        open={showBatchModal}
        onOpenChange={setShowBatchModal}
        selectedServices={selectedServicesArray}
        onBatchUpdate={handleBatchUpdate}
        clientId={clientId}
        clientName={clientName}
      />

      {/* Modal de Filtros Avanzados */}
      <AdvancedServiceFilters
        isOpen={isAdvancedFiltersOpen}
        onClose={() => setIsAdvancedFiltersOpen(false)}
        filters={advancedFilters}
        onFiltersChange={updateAdvancedFilters}
        onApply={handleApplyAdvancedFilters}
        onClear={handleClearAdvancedFilters}
      />

      {/* Modal de Exportación */}
      <PipelineExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        availableStatuses={serviceGroups
          .filter((group): group is ServiceGroup & { status: ServiceStatus } => group.status !== DISPUTED_GROUP_STATUS)
          .map(group => ({
            status: group.status,
            title: group.title,
            count: group.services.length,
            totalValue: group.totalValue
          }))}
        totalServices={services.length}
      />

      {/* Modal para marcar un servicio en disputa */}
      <MarkServiceDisputeModal
        open={!!disputeModalService}
        onOpenChange={(open) => !open && setDisputeModalService(null)}
        serviceId={disputeModalService?.id || ''}
        serviceFolio={disputeModalService?.folio}
        onMarked={() => setDisputeModalService(null)}
      />

      {/* Modal para resolver una disputa desde el grupo virtual */}
      <ResolveServiceDisputeModal
        open={!!resolveModalService}
        onOpenChange={(open) => !open && setResolveModalService(null)}
        dispute={resolveModalService ? openDisputesByServiceId.get(resolveModalService.id) || null : null}
        serviceFolio={resolveModalService?.folio}
        onResolved={() => setResolveModalService(null)}
      />
    </div>
  );
};

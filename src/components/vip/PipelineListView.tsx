import React, { useState, useMemo } from 'react';
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
  User,
  Car,
  Truck,
  Hash,
  CheckSquare,
  SquareCheck,
  ChevronUp,
  ChevronsUpDown,
  Filter,
  X,
  Download
} from 'lucide-react';
import { AdvancedServiceFilters } from '@/components/services/AdvancedServiceFilters';
import { useAdvancedFilters } from '@/hooks/useAdvancedFilters';
import { Service, ServiceStatus } from '@/types';
import { differenceInDays } from 'date-fns';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { BatchUpdateModal, BatchUpdateData } from './BatchUpdateModal';
import { PipelineExportModal } from './PipelineExportModal';
import { PipelineBatchActionBar } from './PipelineBatchActionBar';
import { usePipelineServiceExport } from '@/hooks/vip/usePipelineServiceExport';
import { toast } from 'sonner';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { toTitleCase } from '@/lib/utils';

interface SubGroupConfig {
  fieldExtractor: (s: Service) => string;
  emptyLabel: string;
  prefix: string;
  badgeColor: string;
  badgeBg: string;
}

const getSubGroupConfig = (status: ServiceStatus): SubGroupConfig => {
  switch (status) {
    case 'quoted':
    case 'purchase_order_pending':
      return {
        fieldExtractor: (s) => s.quoteNumber || '',
        emptyLabel: 'Sin Cotización',
        prefix: '',
        badgeColor: 'text-violet-600',
        badgeBg: 'bg-violet-500/10'
      };
    case 'invoiced':
      return {
        fieldExtractor: (s) => s.invoiceNumeroFiscal || '',
        emptyLabel: 'Sin Factura',
        prefix: '',
        badgeColor: 'text-emerald-600',
        badgeBg: 'bg-emerald-500/10'
      };
    default:
      return {
        fieldExtractor: (s) => s.purchaseOrderNumber || s.purchaseOrder || '',
        emptyLabel: 'Sin O.C.',
        prefix: '',
        badgeColor: 'text-blue-600',
        badgeBg: 'bg-blue-500/10'
      };
  }
};

interface POSubGroup {
  poNumber: string;
  services: Service[];
  totalValue: number;
}

const groupByField = (services: Service[], config: SubGroupConfig, sortField?: SortField, sortDirection?: SortDirection): POSubGroup[] => {
  const map: Record<string, POSubGroup> = {};
  services.forEach(s => {
    const val = config.fieldExtractor(s) || config.emptyLabel;
    if (!map[val]) map[val] = { poNumber: val, services: [], totalValue: 0 };
    map[val].services.push(s);
    map[val].totalValue += getDisplayServiceValue(s);
  });
  return Object.values(map).sort((a, b) => {
    // "Sin X" groups always go last
    if (a.poNumber === config.emptyLabel) return 1;
    if (b.poNumber === config.emptyLabel) return -1;

    const dir = sortDirection === 'asc' ? 1 : -1;

    switch (sortField) {
      case 'serviceDate': {
        const aDate = Math.max(...a.services.map(s => new Date(s.serviceDate).getTime()));
        const bDate = Math.max(...b.services.map(s => new Date(s.serviceDate).getTime()));
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
        const now = new Date().getTime();
        const aAvg = a.services.reduce((sum, s) => sum + (now - new Date(s.serviceDate).getTime()), 0) / a.services.length;
        const bAvg = b.services.reduce((sum, s) => sum + (now - new Date(s.serviceDate).getTime()), 0) / b.services.length;
        return (aAvg - bAvg) * dir;
      }
      default:
        // For quoteNumber, purchaseOrder, invoiceNumeroFiscal: alphabetical by group label
        return a.poNumber.localeCompare(b.poNumber) * dir;
    }
  });
};

interface ServiceGroup {
  status: ServiceStatus;
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
    id: 'invoiced' as ServiceStatus,
    title: 'Facturados',
    description: 'Servicios facturados y cerrados',
    color: 'bg-secondary text-secondary-foreground',
    textColor: 'text-foreground'
  }
];

const getPipelineDisplayStatus = (service: Service): ServiceStatus => {
  const hasQuote = Boolean(service.quoteNumber?.trim());
  const hasPurchaseOrder = Boolean((service.purchaseOrderNumber || service.purchaseOrder || '').trim());

  // Flujo post-servicio: si ya tiene cotización no debe quedar visible en completados
  if (service.status === 'completed' && hasQuote) {
    return hasPurchaseOrder ? 'with_purchase_order' : 'quoted';
  }

  // Si ya tiene O.C., mostrar en la etapa administrativa final previa a facturación
  if ((service.status === 'quoted' || service.status === 'purchase_order_pending') && hasPurchaseOrder) {
    return 'with_purchase_order';
  }

  return service.status;
};

export const PipelineListView: React.FC<PipelineListViewProps> = ({
  services,
  loading,
  clientId,
  clientName,
  onServiceUpdate,
  onServiceSelect,
  onServiceEdit,
  onBatchUpdate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<ServiceStatus>>(new Set());
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set(['__all__']));
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [sortField, setSortField] = useState<SortField>('serviceDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
          aValue = a.value || 0;
          bValue = b.value || 0;
          break;
        case 'daysInStatus':
          aValue = differenceInDays(new Date(), parseFromDatabase(a.serviceDate));
          bValue = differenceInDays(new Date(), parseFromDatabase(b.serviceDate));
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
    
    const groupedServices = filteredServices.reduce((groups, service) => {
      const status = getPipelineDisplayStatus(service);
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(service);
      return groups;
    }, {} as Record<ServiceStatus, Service[]>);

    return PIPELINE_STATUSES
      .map(statusConfig => {
        const statusServices = groupedServices[statusConfig.id] || [];
        const totalValue = statusServices.reduce((sum, s) => sum + getDisplayServiceValue(s), 0);
        const averageDays = statusServices.length > 0 
          ? statusServices.reduce((sum, s) => {
              const days = differenceInDays(new Date(), parseFromDatabase(s.serviceDate));
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
  }, [services, searchTerm, sortField, sortDirection, advancedFilters, applyAdvancedFilters]);

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

  const selectedServicesArray = services.filter(s => selectedServices.has(s.id));

  // Calcular suma total de servicios seleccionados
  const selectedTotalValue = useMemo(() => 
    selectedServicesArray.reduce((sum, s) => sum + getDisplayServiceValue(s), 0),
    [selectedServicesArray]
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
      return <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-primary" />
      : <ChevronDown className="w-4 h-4 text-primary" />;
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
            <BarChart3 className="w-5 h-5" />
            Pipeline de Servicios por Estado
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
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
                <Filter className="w-4 h-4 mr-2" />
                Más Filtros
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full"></span>
                )}
              </Button>
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleClearAdvancedFilters}
                >
                  <X className="w-4 h-4" />
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
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
              {selectedServices.size > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowBatchModal(true)}
                >
                  <Hash className="w-4 h-4 mr-2" />
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
              <FileText className="w-4 h-4 text-primary" />
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
              <TrendingUp className="w-4 h-4 text-primary" />
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
              <DollarSign className="w-4 h-4 text-primary" />
              <div>
                <div className="text-2xl font-bold text-foreground">
                  ${services.reduce((sum, s) => sum + getDisplayServiceValue(s), 0).toLocaleString()}
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
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No se encontraron servicios en el pipeline</p>
              <p className="text-sm mt-2">
                {searchTerm ? 'Intenta con diferentes términos de búsqueda' : 'Agrega servicios para ver el pipeline'}
              </p>
            </CardContent>
          </Card>
        ) : (
          serviceGroups.map((group) => (
            <Collapsible
              key={group.status}
              open={expandedGroups.has(group.status)}
              onOpenChange={() => toggleGroup(group.status)}
            >
              <Card className="bg-card border">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedGroups.has(group.status) ? (
                          <ChevronDown className="w-4 h-4 text-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-foreground" />
                        )}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={group.services.every(s => selectedServices.has(s.id))}
                            onCheckedChange={(checked) => handleSelectAll(group.services, checked as boolean)}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge className={`${group.color} ${group.textColor} border-0`}>
                                {group.title}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Promedio: {group.averageDays} días
                              </span>
                              {group.sortingDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {group.sortingDateLabel}: {formatForDisplay(group.sortingDate)}
                                </span>
                              )}
                            </div>
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
                    {(() => {
                      const subGroupConfig = getSubGroupConfig(group.status);
                      const poSubGroups = groupByField(group.services, subGroupConfig, sortField, sortDirection);
                      const hasMultiplePOs = poSubGroups.length > 1;

                      const renderServiceRow = (service: Service) => {
                        const daysInStatus = differenceInDays(new Date(), parseFromDatabase(service.serviceDate));
                        return (
                          <TableRow key={service.id} className="border-muted">
                            <TableCell>
                              <Checkbox
                                checked={selectedServices.has(service.id)}
                                onCheckedChange={(checked) => handleServiceSelection(service.id, checked as boolean)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-foreground">{service.folio}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-foreground">{service.serviceType.name}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground">
                                {formatForDisplay(parseFromDatabase(service.serviceDate))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Car className="w-3 h-3" />
                                <span className="text-sm">
                                  {service.licensePlate || 'Sin vehículo'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-foreground">
                                ${getDisplayServiceValue(service).toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {daysInStatus} días
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {service.quoteNumber ? (
                                <code className="text-xs bg-muted px-1 rounded text-violet-600 font-bold">
                                  {service.quoteNumber}
                                </code>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {(service.purchaseOrderNumber || service.purchaseOrder) ? (
                                <code className="text-xs bg-muted px-1 rounded text-blue-600 font-bold">
                                  {service.purchaseOrderNumber || service.purchaseOrder}
                                </code>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {service.invoiceNumeroFiscal ? (
                                <code className="text-xs bg-muted px-1 rounded text-emerald-600 font-bold">
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
                                  className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300"
                                  title="Ver detalles del servicio"
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onServiceEdit?.(service)}
                                  className="h-8 w-8 p-0 text-green-400 hover:text-green-300"
                                  title="Editar servicio"
                                >
                                  <Edit className="w-3 h-3" />
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
                              <CheckSquare className="w-4 h-4" />
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
                              return (
                                <React.Fragment key={subGroup.poNumber}>
                                  <TableRow 
                                    className="bg-muted/30 hover:bg-muted/50 cursor-pointer border-muted"
                                    onClick={() => togglePO(poKey)}
                                  >
                                    <TableCell colSpan={11}>
                                      <div className="flex items-center justify-between py-0.5">
                                        <div className="flex items-center gap-2">
                                          {isExpanded ? (
                                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                          ) : (
                                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                          )}
                                          {subGroup.poNumber === subGroupConfig.emptyLabel ? (
                                            <span className="text-sm font-medium text-muted-foreground">{subGroupConfig.emptyLabel}</span>
                                          ) : (
                                            <code className={`text-sm font-bold ${subGroupConfig.badgeColor} ${subGroupConfig.badgeBg} px-2 py-0.5 rounded`}>
                                              {subGroupConfig.prefix}{subGroup.poNumber}
                                            </code>
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
          ))
          )}
      </div>

      {/* Batch Update Modal */}
      <BatchUpdateModal
        open={showBatchModal}
        onOpenChange={setShowBatchModal}
        selectedServices={selectedServicesArray}
        onBatchUpdate={handleBatchUpdate}
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
        availableStatuses={serviceGroups.map(group => ({
          status: group.status,
          title: group.title,
          count: group.services.length,
          totalValue: group.totalValue
        }))}
        totalServices={services.length}
      />
    </div>
  );
};
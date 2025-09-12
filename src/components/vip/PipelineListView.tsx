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
  X
} from 'lucide-react';
import { AdvancedServiceFilters } from '@/components/services/AdvancedServiceFilters';
import { useAdvancedFilters } from '@/hooks/useAdvancedFilters';
import { Service, ServiceStatus } from '@/types';
import { differenceInDays } from 'date-fns';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { BatchUpdateModal, BatchUpdateData } from './BatchUpdateModal';
import { toast } from 'sonner';

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

type SortField = 'folio' | 'serviceType' | 'serviceDate' | 'value' | 'daysInStatus' | 'quoteNumber' | 'purchaseOrder';
type SortDirection = 'asc' | 'desc';

// Definir los estados del pipeline con estilos neutros del sistema de diseño
const PIPELINE_STATUSES = [
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
  onServiceUpdate,
  onServiceSelect,
  onServiceEdit,
  onBatchUpdate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<ServiceStatus>>(new Set());
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
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
      const status = service.status;
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(service);
      return groups;
    }, {} as Record<ServiceStatus, Service[]>);

    return PIPELINE_STATUSES
      .map(statusConfig => {
        const statusServices = groupedServices[statusConfig.id] || [];
        const totalValue = statusServices.reduce((sum, s) => sum + (s.value || 0), 0);
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
              // Para completados: mostrar la fecha más reciente
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

  const selectedServicesArray = services.filter(s => selectedServices.has(s.id));

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
    <div className="space-y-4 vip-pipeline-scope">
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
                placeholder="Buscar por folio, tipo, cotización, orden de compra..."
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
                  ${serviceGroups.reduce((sum, g) => sum + g.totalValue, 0).toLocaleString()}
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
                    <Table>
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
                           <TableHead className="text-muted-foreground">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.services.map((service) => {
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
                                   ${(service.value || 0).toLocaleString()}
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
                                   <code className="text-xs bg-muted px-1 rounded text-teal-300">
                                     {service.purchaseOrderNumber || service.purchaseOrder}
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
                        })}
                      </TableBody>
                    </Table>
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
    </div>
  );
};
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
  Truck,
  Hash,
  CheckSquare,
  SquareCheck
} from 'lucide-react';
import { Service, ServiceStatus } from '@/types';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
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

// Definir los estados del pipeline con sus colores
const PIPELINE_STATUSES = [
  {
    id: 'quoted' as ServiceStatus,
    title: 'Cotizados',
    description: 'Servicios con cotización enviada',
    color: 'bg-blue-500/20 border-blue-500/30',
    textColor: 'text-blue-300'
  },
  {
    id: 'purchase_order_pending' as ServiceStatus,
    title: 'Esperando O.C.',
    description: 'Aguardando orden de compra del cliente',
    color: 'bg-amber-500/20 border-amber-500/30',
    textColor: 'text-amber-300'
  },
  {
    id: 'pending' as ServiceStatus,
    title: 'Programados',
    description: 'Servicios confirmados y programados',
    color: 'bg-purple-500/20 border-purple-500/30',
    textColor: 'text-purple-300'
  },
  {
    id: 'in_progress' as ServiceStatus,
    title: 'En Progreso',
    description: 'Servicios ejecutándose actualmente',
    color: 'bg-orange-500/20 border-orange-500/30',
    textColor: 'text-orange-300'
  },
  {
    id: 'completed' as ServiceStatus,
    title: 'Completados',
    description: 'Servicios finalizados exitosamente',
    color: 'bg-green-500/20 border-green-500/30',
    textColor: 'text-green-300'
  },
  {
    id: 'invoiced' as ServiceStatus,
    title: 'Facturados',
    description: 'Servicios facturados y cerrados',
    color: 'bg-gray-500/20 border-gray-500/30',
    textColor: 'text-gray-300'
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

  // Agrupar servicios por estado
  const serviceGroups = useMemo(() => {
    const groupedServices = services.reduce((groups, service) => {
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
              const days = differenceInDays(new Date(), new Date(s.serviceDate));
              return sum + days;
            }, 0) / statusServices.length
          : 0;

        return {
          status: statusConfig.id,
          title: statusConfig.title,
          services: statusServices,
          totalValue,
          averageDays: Math.round(averageDays),
          color: statusConfig.color,
          textColor: statusConfig.textColor
        } as ServiceGroup;
      })
      .filter(group => {
        // Filtrar por búsqueda
        if (!searchTerm.trim()) return group.services.length > 0;
        
        const searchLower = searchTerm.toLowerCase();
        return group.services.some(service => 
          service.folio?.toLowerCase().includes(searchLower) ||
          service.serviceType.name?.toLowerCase().includes(searchLower) ||
          service.quoteNumber?.toLowerCase().includes(searchLower)
        ) && group.services.length > 0;
      });
  }, [services, searchTerm]);

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

  const selectedServicesArray = services.filter(s => selectedServices.has(s.id));

  const getStatusBadge = (status: ServiceStatus) => {
    const statusConfig = PIPELINE_STATUSES.find(s => s.id === status);
    if (!statusConfig) return null;
    
    return (
      <Badge className={`${statusConfig.color} ${statusConfig.textColor} border-0`}>
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
      {/* Header and Search */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <BarChart3 className="w-5 h-5" />
            Pipeline de Servicios por Estado
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por folio, tipo de servicio, cotización..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="flex gap-2">
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
                  className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
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
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <div>
                <div className="text-2xl font-bold text-white">{services.length}</div>
                <div className="text-sm text-muted-foreground">Total servicios</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-white">
                  {serviceGroups.length}
                </div>
                <div className="text-sm text-muted-foreground">Estados activos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-white">
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
          <Card className="glass-card">
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
              <Card className="glass-card">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedGroups.has(group.status) ? (
                          <ChevronDown className="w-4 h-4 text-white" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-white" />
                        )}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={group.services.every(s => selectedServices.has(s.id))}
                            onCheckedChange={(checked) => handleSelectAll(group.services, checked as boolean)}
                            className="border-gray-500"
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
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-white">
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
                          <TableHead className="text-gray-300 w-12">
                            <CheckSquare className="w-4 h-4" />
                          </TableHead>
                          <TableHead className="text-gray-300">Folio</TableHead>
                          <TableHead className="text-gray-300">Tipo de Servicio</TableHead>
                          <TableHead className="text-gray-300">Fecha</TableHead>
                          <TableHead className="text-gray-300">Operador</TableHead>
                          <TableHead className="text-gray-300">Grúa</TableHead>
                          <TableHead className="text-gray-300">Valor</TableHead>
                          <TableHead className="text-gray-300">Días en Estado</TableHead>
                          <TableHead className="text-gray-300">Cotización</TableHead>
                          <TableHead className="text-gray-300">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.services.map((service) => {
                          const daysInStatus = differenceInDays(new Date(), new Date(service.serviceDate));
                          return (
                            <TableRow key={service.id} className="border-gray-700">
                              <TableCell>
                                <Checkbox
                                  checked={selectedServices.has(service.id)}
                                  onCheckedChange={(checked) => handleServiceSelection(service.id, checked as boolean)}
                                  className="border-gray-500"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-white">{service.folio}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-white">{service.serviceType.name}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-gray-300">
                                  {format(new Date(service.serviceDate), 'dd/MM/yyyy', { locale: es })}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-gray-300">
                                  <User className="w-3 h-3" />
                                  <span className="text-sm">
                                    {service.operator?.name || 'Sin asignar'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-gray-300">
                                  <Truck className="w-3 h-3" />
                                  <span className="text-sm">
                                    {service.crane?.licensePlate || 'Sin asignar'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium text-white">
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
                                  <code className="text-xs bg-muted px-1 rounded text-blue-300">
                                    {service.quoteNumber}
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
    </div>
  );
};
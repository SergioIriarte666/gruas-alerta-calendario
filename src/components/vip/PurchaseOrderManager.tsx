import React, { useState } from 'react';
import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Search, 
  Calendar, 
  DollarSign, 
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  Building2,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PurchaseOrderManagerProps {
  services: Service[];
  onServiceSelect: (service: Service) => void;
}

export const PurchaseOrderManager: React.FC<PurchaseOrderManagerProps> = ({
  services,
  onServiceSelect
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'quoted' | 'purchase_order_pending' | 'pending'>('all');

  // Filtrar servicios relevantes para órdenes de compra
  const relevantServices = services.filter(service => 
    ['quoted', 'purchase_order_pending', 'pending'].includes(service.status)
  );

  // Aplicar filtros
  const filteredServices = relevantServices.filter(service => {
    const matchesSearch = 
      service.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.serviceType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (service.purchaseOrderNumber && service.purchaseOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || service.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'quoted':
        return {
          label: 'Cotizado',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          icon: Clock
        };
      case 'purchase_order_pending':
        return {
          label: 'Esperando O.C.',
          color: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
          icon: AlertTriangle
        };
      case 'pending':
        return {
          label: 'Con O.C.',
          color: 'bg-green-500/20 text-green-300 border-green-500/30',
          icon: CheckCircle
        };
      default:
        return {
          label: status,
          color: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
          icon: FileText
        };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  };

  // Estadísticas
  const stats = {
    quoted: relevantServices.filter(s => s.status === 'quoted').length,
    pending_po: relevantServices.filter(s => s.status === 'purchase_order_pending').length,
    with_po: relevantServices.filter(s => s.status === 'pending' && s.purchaseOrderNumber).length,
    total_value: relevantServices.reduce((sum, s) => sum + s.value, 0)
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.quoted}</p>
                <p className="text-xs text-amber-400">Cotizados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.pending_po}</p>
                <p className="text-xs text-orange-400">Esperando O.C.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.with_po}</p>
                <p className="text-xs text-green-400">Con O.C.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <DollarSign className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{formatCurrency(stats.total_value)}</p>
                <p className="text-xs text-blue-400">Valor Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Gestión de Órdenes de Compra
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar por folio, tipo de servicio o número O.C..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-600 text-white"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                Todos
              </Button>
              <Button
                variant={statusFilter === 'quoted' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('quoted')}
                className="text-amber-400 border-amber-500/30"
              >
                Cotizados
              </Button>
              <Button
                variant={statusFilter === 'purchase_order_pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('purchase_order_pending')}
                className="text-orange-400 border-orange-500/30"
              >
                Esperando O.C.
              </Button>
              <Button
                variant={statusFilter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('pending')}
                className="text-green-400 border-green-500/30"
              >
                Con O.C.
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services List */}
      <div className="space-y-3">
        {filteredServices.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No hay servicios</h3>
              <p className="text-gray-400">
                {searchTerm ? 'No se encontraron servicios con los filtros aplicados' : 'No hay servicios pendientes de orden de compra'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredServices.map((service) => {
            const statusInfo = getStatusInfo(service.status);
            const StatusIcon = statusInfo.icon;
            
            return (
              <Card 
                key={service.id} 
                className="glass-card hover:bg-gray-800/50 transition-colors cursor-pointer"
                onClick={() => onServiceSelect(service)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-blue-300 border-blue-500/30">
                          {service.folio}
                        </Badge>
                        
                        <Badge variant="outline" className={statusInfo.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusInfo.label}
                        </Badge>

                        {service.purchaseOrderNumber && (
                          <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                            O.C: {service.purchaseOrderNumber}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-gray-300">
                            <Calendar className="w-3 h-3" />
                            <span>{format(new Date(service.serviceDate), 'dd/MM/yyyy', { locale: es })}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-300">
                            <Building2 className="w-3 h-3" />
                            <span>{service.serviceType.name}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-gray-300">
                            <MapPin className="w-3 h-3" />
                            <div className="truncate">
                              {service.origin}
                              {service.destination !== service.origin && (
                                <> → {service.destination}</>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-green-400">
                            <DollarSign className="w-3 h-3" />
                            <span className="font-medium">{formatCurrency(service.value)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {service.status === 'purchase_order_pending' ? 'Registrar O.C.' : 'Ver Detalles'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
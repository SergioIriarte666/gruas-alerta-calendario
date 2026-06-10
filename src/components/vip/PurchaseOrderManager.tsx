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
  MessageCircle
} from 'lucide-react';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('PurchaseOrderManager');

interface PurchaseOrderManagerProps {
  services: Service[];
  onServiceSelect: (service: Service) => void;
}

export const PurchaseOrderManager: React.FC<PurchaseOrderManagerProps> = ({
  services,
  onServiceSelect
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'quoted' | 'purchase_order_pending' | 'with_purchase_order' | 'pending'>('all');

  // Filtrar servicios relevantes para órdenes de compra
  const relevantServices = services.filter(service => 
    ['quoted', 'purchase_order_pending', 'with_purchase_order', 'pending', 'in_progress', 'completed'].includes(service.status)
  );

  // Aplicar filtros
  const filteredServices = relevantServices.filter(service => {
    const matchesSearch = 
      service.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.serviceType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (service.purchaseOrderNumber && service.purchaseOrderNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (service.purchaseOrder && service.purchaseOrder.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesStatus = false;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'with_purchase_order') {
      matchesStatus = !!(service.purchaseOrderNumber || service.purchaseOrder);
    } else {
      matchesStatus = service.status === statusFilter;
    }
    
    return matchesSearch && matchesStatus;
  });

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'quoted':
        return {
          label: 'Cotizado',
          color: 'bg-secondary text-secondary-foreground',
          icon: Clock
        };
      case 'purchase_order_pending':
        return {
          label: 'Esperando O.C.',
          color: 'bg-secondary text-secondary-foreground',
          icon: AlertTriangle
        };
      case 'with_purchase_order':
        return {
          label: 'Con Orden de Compra',
          color: 'bg-secondary text-secondary-foreground',
          icon: CheckCircle
        };
      case 'pending':
        return {
          label: 'Pendiente',
          color: 'bg-secondary text-secondary-foreground',
          icon: Clock
        };
      default:
        return {
          label: status,
          color: 'bg-secondary text-secondary-foreground',
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
    with_purchase_order: relevantServices.filter(s => 
      s.purchaseOrderNumber || s.purchaseOrder
    ).length,
    total_value: relevantServices.reduce((sum, s) => sum + s.value, 0)
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Clock className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.quoted}</p>
                <p className="text-xs text-muted-foreground">Cotizados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <AlertTriangle className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pending_po}</p>
                <p className="text-xs text-muted-foreground">Esperando O.C.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <CheckCircle className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.with_purchase_order}</p>
                <p className="text-xs text-muted-foreground">Con O.C.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <DollarSign className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{formatCurrency(stats.total_value)}</p>
                <p className="text-xs text-muted-foreground">Valor Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <FileText className="size-5" />
            Gestión de Órdenes de Compra
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por folio, tipo de servicio o número O.C..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-card border text-foreground"
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
              >
                Cotizados
              </Button>
              <Button
                variant={statusFilter === 'purchase_order_pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('purchase_order_pending')}
              >
                Esperando O.C.
              </Button>
              <Button
                variant={statusFilter === 'with_purchase_order' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('with_purchase_order')}
              >
                Con Orden de Compra
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
              <FileText className="size-12 text-gray-400 mx-auto mb-4" />
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
                    <div className="flex-1 gap-y-2">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-blue-300 border-blue-500/30">
                          {service.folio}
                        </Badge>
                        
                        <Badge variant="outline" className={statusInfo.color}>
                          <StatusIcon className="size-3 mr-1" />
                          {statusInfo.label}
                        </Badge>

                        {(service.purchaseOrderNumber || service.purchaseOrder) && (
                          <Badge variant="secondary" className="bg-green-500/20 text-black border-green-500/30">
                            <CheckCircle className="size-3 mr-1" />
                            Con O.C: {service.purchaseOrderNumber || service.purchaseOrder}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="size-3" />
                            <span>{formatForDisplay(parseFromDatabase(service.serviceDate))}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="size-3" />
                            <span>{service.serviceType.name}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="size-3" />
                            <div className="truncate">
                              {service.origin}
                              {service.destination !== service.origin && (
                                <> → {service.destination}</>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-foreground">
                            <DollarSign className="size-3" />
                            <span className="font-medium">{formatCurrency(getDisplayServiceValue(service))}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {(service.purchaseOrderNumber || service.purchaseOrder) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const { data, error } = await supabase.functions.invoke('send-whatsapp-admin', {
                              body: {
                                event: 'orden_compra',
                                data: {
                                  proveedor: service.client?.name || '',
                                  monto: getDisplayServiceValue(service).toLocaleString('es-CL') || '0',
                                  descripcion: `OC ${service.purchaseOrderNumber || service.purchaseOrder} - Folio ${service.folio}`,
                                },
                              },
                            });
                            if (error) {
                              logger.warn('WhatsApp admin no enviado:', error);
                              toast.error('No se pudo enviar la notificación');
                              return;
                            }

                            if ((data as { skipped?: boolean; reason?: string } | null)?.skipped) {
                              const reason = data?.reason;
                              logger.info('WhatsApp admin omitido:', reason);
                              if (reason === 'whatsapp_disabled') {
                                toast.warning('Envío de WhatsApp deshabilitado en Configuración');
                              } else {
                                toast.info('WhatsApp no enviado', {
                                  description: reason || 'Envío omitido por configuración',
                                });
                              }
                              return;
                            }

                            toast.success('Administradores notificados por WhatsApp');
                          }}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Notificar OC
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {service.status === 'purchase_order_pending' ? 'Registrar O.C.' : 'Ver Detalles'}
                      </Button>
                    </div>
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

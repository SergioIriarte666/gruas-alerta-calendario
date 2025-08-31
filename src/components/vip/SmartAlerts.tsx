import React, { useState, useEffect } from 'react';
import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Zap, 
  Bell,
  MessageSquare,
  Mail,
  Settings,
  CheckCircle2,
  X
} from 'lucide-react';
import { formatDistanceToNow, differenceInHours, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  serviceId?: string;
  serviceFolio?: string;
  createdAt: string;
  actionRequired: boolean;
  actions?: Array<{
    label: string;
    action: string;
    variant?: 'default' | 'destructive';
  }>;
  metadata?: Record<string, any>;
}

interface SmartAlertsProps {
  services: Service[];
  clientId: string;
  onAlert?: (alert: Alert) => void;
}

export const SmartAlerts: React.FC<SmartAlertsProps> = ({
  services,
  clientId,
  onAlert
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Generate smart alerts based on service analysis
  useEffect(() => {
    const generateAlerts = () => {
      const newAlerts: Alert[] = [];
      const now = new Date();

      services.forEach(service => {
        const serviceDate = new Date(service.serviceDate);
        const hoursFromService = differenceInHours(now, serviceDate);
        const daysFromService = differenceInDays(now, serviceDate);

        // Alert: Purchase Order pending for too long
        if (service.status === 'purchase_order_pending' && daysFromService > 2) {
          newAlerts.push({
            id: `po-pending-${service.id}`,
            type: 'warning',
            priority: daysFromService > 5 ? 'critical' : 'high',
            title: 'Orden de Compra Pendiente',
            message: `El servicio ${service.folio} lleva ${daysFromService} días esperando orden de compra.`,
            serviceId: service.id,
            serviceFolio: service.folio,
            createdAt: now.toISOString(),
            actionRequired: true,
            actions: [
              { label: 'Contactar Cliente', action: 'contact_client' },
              { label: 'Escalamiento', action: 'escalate' }
            ]
          });
        }

        // Alert: Service overdue
        if (service.status === 'pending' && hoursFromService > 2) {
          newAlerts.push({
            id: `service-overdue-${service.id}`,
            type: 'error',
            priority: 'high',
            title: 'Servicio Atrasado',
            message: `El servicio ${service.folio} debería haber iniciado hace ${Math.floor(hoursFromService)}h.`,
            serviceId: service.id,
            serviceFolio: service.folio,
            createdAt: now.toISOString(),
            actionRequired: true,
            actions: [
              { label: 'Reprogramar', action: 'reschedule' },
              { label: 'Iniciar Ahora', action: 'start_service' }
            ]
          });
        }

        // Alert: Service completed but not invoiced
        if (service.status === 'completed' && daysFromService > 1) {
          newAlerts.push({
            id: `invoice-pending-${service.id}`,
            type: 'info',
            priority: 'medium',
            title: 'Pendiente de Facturación',
            message: `El servicio ${service.folio} está completado pero no facturado desde hace ${daysFromService} día(s).`,
            serviceId: service.id,
            serviceFolio: service.folio,
            createdAt: now.toISOString(),
            actionRequired: true,
            actions: [
              { label: 'Facturar', action: 'create_invoice' }
            ]
          });
        }

        // Alert: High value service needs attention
        if (service.value > 500000 && service.status === 'quoted' && daysFromService > 1) {
          newAlerts.push({
            id: `high-value-${service.id}`,
            type: 'info',
            priority: 'high',
            title: 'Servicio de Alto Valor',
            message: `Servicio ${service.folio} por $${service.value.toLocaleString()} necesita seguimiento.`,
            serviceId: service.id,
            serviceFolio: service.folio,
            createdAt: now.toISOString(),
            actionRequired: false,
            metadata: { value: service.value }
          });
        }
      });

      // Pattern Analysis Alerts
      const quotedServices = services.filter(s => s.status === 'quoted');
      const pendingPOServices = services.filter(s => s.status === 'purchase_order_pending');
      
      if (quotedServices.length > 5) {
        newAlerts.push({
          id: 'too-many-quoted',
          type: 'warning',
          priority: 'medium',
          title: 'Muchas Cotizaciones Pendientes',
          message: `Hay ${quotedServices.length} cotizaciones sin respuesta. Considera hacer seguimiento.`,
          createdAt: now.toISOString(),
          actionRequired: true,
          actions: [
            { label: 'Enviar Recordatorio', action: 'send_reminder' }
          ]
        });
      }

      if (pendingPOServices.length > 3) {
        newAlerts.push({
          id: 'too-many-po-pending',
          type: 'error',
          priority: 'high',
          title: 'Múltiples O.C. Pendientes',
          message: `${pendingPOServices.length} servicios esperan órdenes de compra. Posible cuello de botella.`,
          createdAt: now.toISOString(),
          actionRequired: true,
          actions: [
            { label: 'Contactar Cliente', action: 'contact_client' },
            { label: 'Revisar Proceso', action: 'review_process' }
          ]
        });
      }

      setAlerts(newAlerts);
    };

    generateAlerts();
    const interval = setInterval(generateAlerts, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [services]);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      case 'warning': return <Clock className="w-4 h-4" />;
      case 'info': return <Bell className="w-4 h-4" />;
      case 'success': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getAlertColor = (type: string, priority: string) => {
    if (priority === 'critical') {
      return 'bg-red-500/20 text-red-300 border-red-500/30';
    }
    
    switch (type) {
      case 'error': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'warning': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'info': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'success': return 'bg-green-500/20 text-green-300 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      'critical': 'bg-red-500/20 text-red-300 border-red-500/50',
      'high': 'bg-orange-500/20 text-orange-300 border-orange-500/50',
      'medium': 'bg-blue-500/20 text-blue-300 border-blue-500/50',
      'low': 'bg-gray-500/20 text-gray-300 border-gray-500/50'
    };
    
    return (
      <Badge variant="outline" className={colors[priority]}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const handleAction = (alert: Alert, action: string) => {
    switch (action) {
      case 'contact_client':
        toast.success('Contactando cliente...');
        break;
      case 'escalate':
        toast.info('Escalando alerta...');
        break;
      case 'reschedule':
        toast.info('Abriendo reprogramación...');
        break;
      case 'start_service':
        toast.success('Iniciando servicio...');
        break;
      case 'create_invoice':
        toast.info('Abriendo facturación...');
        break;
      case 'send_reminder':
        toast.success('Enviando recordatorio...');
        break;
      case 'review_process':
        toast.info('Revisando proceso...');
        break;
    }
    
    dismissAlert(alert.id);
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const criticalAlerts = alerts.filter(a => a.priority === 'critical').length;
  const highAlerts = alerts.filter(a => a.priority === 'high').length;
  const actionRequiredAlerts = alerts.filter(a => a.actionRequired).length;

  if (alerts.length === 0) {
    return (
      <Card className="glass-card border-green-500/20">
        <CardContent className="p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Todo Bajo Control</h3>
          <p className="text-gray-400">No hay alertas activas en este momento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card border-red-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{criticalAlerts}</p>
            <p className="text-xs text-red-400">Críticas</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-orange-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{highAlerts}</p>
            <p className="text-xs text-orange-400">Alta Prioridad</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-blue-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{actionRequiredAlerts}</p>
            <p className="text-xs text-blue-400">Requieren Acción</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.map((alert) => (
          <Card 
            key={alert.id} 
            className={`glass-card ${getAlertColor(alert.type, alert.priority)} transition-all duration-200`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex-shrink-0 mt-1">
                    {getAlertIcon(alert.type)}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">{alert.title}</h4>
                      {getPriorityBadge(alert.priority)}
                      {alert.serviceFolio && (
                        <Badge variant="outline" className="text-xs">
                          {alert.serviceFolio}
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-300">{alert.message}</p>
                    
                    <div className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(alert.createdAt), { 
                        addSuffix: true, 
                        locale: es 
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {alert.actions && alert.actions.map((action, index) => (
                    <Button
                      key={index}
                      size="sm"
                      variant={action.variant || "outline"}
                      onClick={() => handleAction(alert, action.action)}
                      className="text-xs"
                    >
                      {action.label}
                    </Button>
                  ))}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissAlert(alert.id)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
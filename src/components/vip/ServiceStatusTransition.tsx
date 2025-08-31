import React from 'react';
import { Service, ServiceStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  FileText, 
  ShoppingCart, 
  Clock, 
  PlayCircle, 
  CheckCircle,
  Receipt,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ServiceStatusTransitionProps {
  service: Service;
  onUpdate: () => void;
  onPurchaseOrderClick?: () => void;
}

export const ServiceStatusTransition: React.FC<ServiceStatusTransitionProps> = ({
  service,
  onUpdate,
  onPurchaseOrderClick
}) => {
  const getStatusConfig = (status: ServiceStatus) => {
    const configs = {
      'quoted': {
        label: 'Cotizado',
        color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        icon: FileText
      },
      'purchase_order_pending': {
        label: 'Esperando O.C.',
        color: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
        icon: ShoppingCart
      },
      'pending': {
        label: 'Programado',
        color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        icon: Clock
      },
      'in_progress': {
        label: 'En Progreso',
        color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        icon: PlayCircle
      },
      'completed': {
        label: 'Completado',
        color: 'bg-green-500/20 text-green-300 border-green-500/30',
        icon: CheckCircle
      },
      'invoiced': {
        label: 'Facturado',
        color: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
        icon: Receipt
      },
      'cancelled': {
        label: 'Cancelado',
        color: 'bg-red-500/20 text-red-300 border-red-500/30',
        icon: X
      }
    };
    return configs[status] || configs['pending'];
  };

  const getNextStatus = (currentStatus: ServiceStatus): ServiceStatus | null => {
    const transitions = {
      'quoted': 'purchase_order_pending',
      'purchase_order_pending': 'pending',
      'pending': 'in_progress',
      'in_progress': 'completed',
      'completed': 'invoiced'
    };
    return transitions[currentStatus] as ServiceStatus || null;
  };

  const canTransition = (currentStatus: ServiceStatus): boolean => {
    // Para pasar de purchase_order_pending a pending, necesita O.C.
    if (currentStatus === 'purchase_order_pending') {
      return !!service.purchaseOrderNumber;
    }
    return getNextStatus(currentStatus) !== null;
  };

  const getTransitionLabel = (currentStatus: ServiceStatus): string => {
    const labels = {
      'quoted': 'Solicitar O.C.',
      'purchase_order_pending': 'Confirmar O.C.',
      'pending': 'Iniciar Servicio',
      'in_progress': 'Completar',
      'completed': 'Facturar'
    };
    return labels[currentStatus] || 'Siguiente';
  };

  const handleStatusTransition = async () => {
    const nextStatus = getNextStatus(service.status);
    if (!nextStatus) return;

    // Si está en quoted, cambiar a purchase_order_pending
    if (service.status === 'quoted') {
      try {
        const { error } = await supabase
          .from('services')
          .update({ 
            status: 'purchase_order_pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', service.id);

        if (error) throw error;
        
        toast.success('Servicio enviado para orden de compra');
        onUpdate();
      } catch (error) {
        console.error('Error updating service status:', error);
        toast.error('Error al actualizar el estado');
      }
      return;
    }

    // Para purchase_order_pending, necesita O.C. registrada
    if (service.status === 'purchase_order_pending') {
      if (!service.purchaseOrderNumber) {
        onPurchaseOrderClick?.();
        return;
      }
    }

    // Transición normal
    try {
      const { error } = await supabase
        .from('services')
        .update({ 
          status: nextStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', service.id);

      if (error) throw error;
      
      toast.success(`Servicio actualizado a: ${getStatusConfig(nextStatus).label}`);
      onUpdate();
    } catch (error) {
      console.error('Error updating service status:', error);
      toast.error('Error al actualizar el estado');
    }
  };

  const currentConfig = getStatusConfig(service.status);
  const nextStatus = getNextStatus(service.status);
  const nextConfig = nextStatus ? getStatusConfig(nextStatus) : null;
  const CurrentIcon = currentConfig.icon;
  const NextIcon = nextConfig?.icon;

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-800/30 rounded-lg">
      {/* Current Status */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={currentConfig.color}>
          <CurrentIcon className="w-3 h-3 mr-1" />
          {currentConfig.label}
        </Badge>
        {service.purchaseOrderNumber && (
          <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 text-xs">
            O.C: {service.purchaseOrderNumber}
          </Badge>
        )}
      </div>

      {/* Transition Arrow & Button */}
      {nextConfig && (
        <>
          <ArrowRight className="w-4 h-4 text-gray-400" />
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`${nextConfig.color} opacity-50`}>
              <NextIcon className="w-3 h-3 mr-1" />
              {nextConfig.label}
            </Badge>

            <Button
              size="sm"
              onClick={handleStatusTransition}
              disabled={!canTransition(service.status)}
              className={
                service.status === 'purchase_order_pending' && !service.purchaseOrderNumber
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }
            >
              {service.status === 'purchase_order_pending' && !service.purchaseOrderNumber
                ? 'Registrar O.C.'
                : getTransitionLabel(service.status)}
            </Button>
          </div>
        </>
      )}

      {/* Special message for purchase order pending */}
      {service.status === 'purchase_order_pending' && !service.purchaseOrderNumber && (
        <div className="flex-1 text-right">
          <p className="text-xs text-orange-400">
            ⚠️ Necesita orden de compra para continuar
          </p>
        </div>
      )}
    </div>
  );
};
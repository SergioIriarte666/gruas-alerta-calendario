import { businessClock } from '@/utils/businessClock';
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
import { createLogger } from "@/lib/logger";


const logger = createLogger("ServiceStatusTransition");
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
      'with_purchase_order': {
        label: 'Con O.C.',
        color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
        icon: ShoppingCart
      },
      'invoiced': {
        label: 'Facturado',
        color: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
        icon: Receipt
      },
      'failed': {
        label: 'Fallido',
        color: 'bg-orange-600/20 text-orange-300 border-orange-600/30',
        icon: X
      }
    };
    return configs[status] || configs['pending'];
  };

  const getNextStatus = (currentStatus: ServiceStatus): ServiceStatus | null => {
    // Flujo: pending -> in_progress -> completed -> quoted -> purchase_order_pending -> with_purchase_order -> invoiced
    const transitions: Record<string, ServiceStatus> = {
      'pending': 'in_progress',
      'in_progress': 'completed',
      'completed': 'quoted',
      'quoted': 'purchase_order_pending',
      'purchase_order_pending': 'with_purchase_order',
      'with_purchase_order': 'invoiced',
      'failed': 'invoiced'
    };
    return transitions[currentStatus] || null;
  };

  const canTransition = (currentStatus: ServiceStatus): boolean => {
    // Para pasar de purchase_order_pending a pending, necesita O.C.
    if (currentStatus === 'purchase_order_pending') {
      return !!service.purchaseOrderNumber;
    }
    return getNextStatus(currentStatus) !== null;
  };

  const getTransitionLabel = (currentStatus: ServiceStatus): string => {
    const labels: Record<string, string> = {
      'pending': 'Iniciar Servicio',
      'in_progress': 'Completar Servicio',
      'completed': 'Agregar Cotización',
      'quoted': 'Solicitar O.C.',
      'purchase_order_pending': 'Confirmar O.C.',
      'with_purchase_order': 'Facturar',
      'failed': 'Facturar'
    };
    return labels[currentStatus] || 'Siguiente';
  };

  const handleStatusTransition = async () => {
    const nextStatus = getNextStatus(service.status);
    if (!nextStatus) return;

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
          updated_at: businessClock.nowISO()
        })
        .eq('id', service.id);

      if (error) throw error;
      
      toast.success(`Servicio actualizado a: ${getStatusConfig(nextStatus).label}`);

      if (service.status === 'in_progress' && nextStatus === 'completed') {
        supabase.functions
          .invoke('send-whatsapp-admin', {
            body: {
              event: 'servicio_completado',
              data: {
                folio: service.folio,
                operatorName: service.operator?.name || 'Sin operador',
                clientName: service.client?.name || '',
                fechaCompletado: businessClock.format(businessClock.now(), 'EEEE, d \'de\' MMMM yyyy'),
              },
            },
          })
          .then(({ error }) => {
            if (error) logger.warn('WhatsApp admin no enviado:', error);
          });
      }

      onUpdate();
    } catch (error) {
      logger.error('Error updating service status:', error);
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
          <CurrentIcon className="size-3 mr-1" />
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
          <ArrowRight className="size-4 text-gray-400" />
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`${nextConfig.color} opacity-50`}>
              <NextIcon className="size-3 mr-1" />
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

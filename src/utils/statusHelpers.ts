import React from 'react';
import { Badge } from '@/components/ui/badge';

export type ServiceStatus = 'pending' | 'in_progress' | 'inspection_completed' | 'completed' | 'cancelled' | 'invoiced' | 'quoted' | 'purchase_order_pending' | 'with_purchase_order';

interface StatusConfig {
  label: string;
  className: string;
}

const STATUS_CONFIG: Record<ServiceStatus, StatusConfig> = {
  pending: { label: 'Pendiente', className: 'bg-yellow-500/80 text-white' },
  in_progress: { label: 'En Progreso', className: 'bg-blue-500/80 text-white' },
  inspection_completed: { label: 'Inspección Completada', className: 'bg-orange-500/80 text-white' },
  completed: { label: 'Completado', className: 'bg-green-500/80 text-white' },
  cancelled: { label: 'Cancelado', className: 'bg-red-500/80 text-white' },
  invoiced: { label: 'Facturado', className: 'bg-purple-500/80 text-white' },
  quoted: { label: 'Cotizado', className: 'bg-cyan-500/80 text-white' },
  purchase_order_pending: { label: 'Esperando O.C.', className: 'bg-amber-500/80 text-white' },
  with_purchase_order: { label: 'Con Orden de Compra', className: 'bg-teal-500/80 text-white' }
};

export const getServiceStatusBadge = (status: string) => {
  const config = STATUS_CONFIG[status as ServiceStatus] || { 
    label: 'Desconocido', 
    className: 'bg-gray-500/80 text-white' 
  };
  
  return React.createElement(Badge, { className: `${config.className} border-none` }, config.label);
};

export const formatCurrency = (amount: number | null | undefined) => {
  // Validar que el valor sea un número válido
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '$0';
  }
  
  // Convertir a número si es necesario
  const numericAmount = Number(amount);
  
  if (isNaN(numericAmount)) {
    return '$0';
  }
  
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(numericAmount);
};

export const shouldShowVehicleInfo = (service: any) => {
  // Si el servicio tiene vehicle_info_optional o el tipo de servicio lo indica
  const isOptional = service.vehicleInfoOptional || service.service_type?.vehicle_info_optional;
  
  if (!isOptional) return true;
  
  // Si es opcional, verificar si tiene datos reales (no N/A)
  const hasRealData = service.vehicleBrand && 
                     service.vehicleModel && 
                     service.licensePlate &&
                     service.vehicleBrand !== 'N/A' &&
                     service.vehicleModel !== 'N/A' &&
                     service.licensePlate !== 'N/A';
  
  return hasRealData;
};

export const formatVehicleInfo = (service: any) => {
  if (!shouldShowVehicleInfo(service)) {
    return 'No aplica';
  }
  
  return `${service.vehicleBrand} ${service.vehicleModel} (${service.licensePlate})`;
};
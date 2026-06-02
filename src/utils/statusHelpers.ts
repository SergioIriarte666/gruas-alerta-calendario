import React from 'react';
import { Badge } from '@/components/ui/badge';

export type ServiceStatus = 'pending' | 'in_progress' | 'inspection_completed' | 'completed' | 'cancelled' | 'invoiced' | 'quoted' | 'purchase_order_pending' | 'with_purchase_order' | 'failed';

interface StatusConfig {
  label: string;
  className: string;
}

export const SERVICE_STATUS_CONFIG: Record<ServiceStatus, StatusConfig> = {
  pending: { label: 'Pendiente', className: 'bg-yellow-500/80 text-white' },
  in_progress: { label: 'En Progreso', className: 'bg-blue-500/80 text-white' },
  inspection_completed: { label: 'Inspección Completada', className: 'bg-orange-500/80 text-white' },
  completed: { label: 'Completado', className: 'bg-green-500/80 text-white' },
  cancelled: { label: 'Cancelado', className: 'bg-red-500/80 text-white' },
  invoiced: { label: 'Facturado', className: 'bg-purple-500/80 text-white' },
  quoted: { label: 'Cotizado', className: 'bg-cyan-500/80 text-white' },
  purchase_order_pending: { label: 'OC Pendiente', className: 'bg-amber-500/80 text-white' },
  with_purchase_order: { label: 'Con O.C.', className: 'bg-teal-500/80 text-white' },
  failed: { label: 'Fallido', className: 'bg-orange-600/80 text-white' }
};

export const getServiceStatusBadge = (status: string) => {
  const config = SERVICE_STATUS_CONFIG[status as ServiceStatus] || { 
    label: 'Desconocido', 
    className: 'bg-gray-500/80 text-white' 
  };
  
  return React.createElement(Badge, { className: `${config.className} border-none` }, config.label);
};

export const getServiceStatusLabel = (status: string) => {
  return SERVICE_STATUS_CONFIG[status as ServiceStatus]?.label || 'Desconocido';
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
  const vehicleBrand = service.vehicleBrand || service.vehicle_brand;
  const vehicleModel = service.vehicleModel || service.vehicle_model;
  const licensePlate = service.licensePlate || service.license_plate;
  
  if (!isOptional) return true;
  
  // Si es opcional, verificar si tiene datos reales (no N/A)
  const hasRealData = vehicleBrand &&
                     vehicleModel &&
                     licensePlate &&
                     vehicleBrand !== 'N/A' &&
                     vehicleModel !== 'N/A' &&
                     licensePlate !== 'N/A';
  
  return hasRealData;
};

const getNormalizedVehicleValue = (value: unknown) => {
  if (typeof value !== 'string') return '';

  const normalizedValue = value.trim();
  if (!normalizedValue) return '';

  const upperCasedValue = normalizedValue.toUpperCase();
  if (upperCasedValue === 'N/A' || upperCasedValue === 'NA') {
    return '';
  }

  return normalizedValue;
};

export const getServiceTypeDisplayName = (service: any) => {
  const serviceTypeName =
    service.service_type_name ||
    service.serviceTypeName ||
    service.serviceType?.name ||
    service.service_type?.name ||
    service.service_types?.name;

  return getNormalizedVehicleValue(serviceTypeName) || 'Servicio';
};

export const formatVehicleInfo = (service: any) => {
  const vehicleBrand = getNormalizedVehicleValue(service.vehicleBrand || service.vehicle_brand);
  const vehicleModel = getNormalizedVehicleValue(service.vehicleModel || service.vehicle_model);
  const licensePlate = getNormalizedVehicleValue(service.licensePlate || service.license_plate);
  const serviceTypeName = getServiceTypeDisplayName(service);

  if (vehicleBrand && vehicleModel && licensePlate) {
    return `${vehicleBrand} ${vehicleModel} (${licensePlate})`;
  }

  if (licensePlate) {
    return licensePlate;
  }

  if (vehicleBrand && vehicleModel) {
    return `${vehicleBrand} ${vehicleModel}`;
  }

  return serviceTypeName;
};

import React from 'react';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';

export type ServiceStatus = 'pending' | 'in_progress' | 'inspection_completed' | 'completed' | 'cancelled' | 'invoiced' | 'quoted' | 'purchase_order_pending' | 'with_purchase_order' | 'failed';

interface StatusConfig {
  label: string;
  tone: StatusTone;
}

export const SERVICE_STATUS_CONFIG: Record<ServiceStatus, StatusConfig> = {
  pending: { label: 'Pendiente', tone: 'pending' },
  in_progress: { label: 'En Progreso', tone: 'in_progress' },
  inspection_completed: { label: 'Inspección Completada', tone: 'info' },
  completed: { label: 'Completado', tone: 'completed' },
  cancelled: { label: 'Cancelado', tone: 'cancelled' },
  invoiced: { label: 'Facturado', tone: 'paid' },
  quoted: { label: 'Cotizado', tone: 'info' },
  purchase_order_pending: { label: 'OC Pendiente', tone: 'pending' },
  with_purchase_order: { label: 'Con O.C.', tone: 'info' },
  failed: { label: 'Fallido', tone: 'overdue' }
};

export const getServiceStatusBadge = (status: string) => {
  const config = SERVICE_STATUS_CONFIG[status as ServiceStatus] || {
    label: 'Desconocido',
    tone: 'neutral' as const
  };
  
  return React.createElement(StatusBadge, { tone: config.tone }, config.label);
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

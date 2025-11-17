import { Service } from '@/types';
import { getCurrentChileDateString } from './timezoneUtils';

/**
 * Prepara los datos de un servicio para duplicación
 * Copia campos relevantes y excluye/limpia campos que deben ser únicos o regenerados
 */
export const prepareServiceForDuplication = (service: Service) => {
  const currentDate = getCurrentChileDateString();
  
  return {
    // Datos del cliente y tipo de servicio
    clientId: service.client?.id || '',
    serviceTypeId: service.serviceType?.id || '',
    
    // Fechas - establecer fecha actual, limpiar horarios
    requestDate: currentDate,
    serviceDate: currentDate,
    startTime: undefined,
    endTime: undefined,
    
    // Datos del vehículo (copiar tal cual)
    vehicleBrand: service.vehicleBrand || '',
    vehicleModel: service.vehicleModel || '',
    licensePlate: service.licensePlate || '',
    
    // Ubicaciones (copiar tal cual)
    origin: service.origin || '',
    destination: service.destination || '',
    
    // Recursos asignados
    craneId: service.crane?.id || '',
    
    // Operadores - mantener estructura pero limpiar comisiones
    operators: service.operator ? [{
      id: 'temp-1',
      operatorId: service.operator.id,
      commission: 0, // Se establecerá según porcentaje del tipo de servicio
      role: 'Principal',
      hours: undefined
    }] : [],
    
    // Observaciones (copiar pero agregar indicador de duplicación)
    observations: service.observations 
      ? `[Duplicado] ${service.observations}`
      : '[Duplicado]',
    
    // OC y cotización (copiar si existen)
    purchaseOrder: service.purchaseOrder || '',
    purchaseOrderNumber: (service as any).purchaseOrderNumber || '',
    quoteNumber: service.quoteNumber || '',
    
    // Estado siempre pending
    status: 'pending' as const,
    
    // Custodia - copiar configuración si existe
    inCustody: (service as any).inCustody || false,
    custodyDetails: (service as any).inCustody ? {
      entryDate: currentDate,
      estimatedDays: (service as any).custodyDetails?.estimatedDays || 1,
      dailyRate: (service as any).custodyDetails?.dailyRate || 0,
      entryTime: undefined,
      exitDate: undefined,
      exitTime: undefined,
      totalDays: undefined,
      totalAmount: 0
    } : undefined,
    
    // Arriendo de equipos - copiar si existe
    equipmentRental: (service as any).equipmentRental || false,
    rentalDetails: (service as any).equipmentRental ? {
      equipmentType: (service as any).rentalDetails?.equipmentType || '',
      rentalStartDate: currentDate,
      rentalEndDate: undefined,
      dailyRate: (service as any).rentalDetails?.dailyRate || 0,
      totalDays: undefined,
      totalAmount: 0,
      deposit: (service as any).rentalDetails?.deposit || 0
    } : undefined,
    
    // NO duplicar:
    // - folio (se generará automáticamente)
    // - id (nuevo registro)
    // - value/service_value (se recalculará)
    // - costDetails (no duplicar costos asociados)
    // - hasExcess, clientCoveredAmount, excessAmount
    // - payment_date
    // - crane_mileage
    // - created_at, updated_at
    
    // Metadata de duplicación
    _isDuplicating: true,
    _originalFolio: service.folio
  };
};

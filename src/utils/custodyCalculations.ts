/**
 * Utilidades centralizadas para cálculos de custodia y arriendo de equipos
 * 
 * IMPORTANTE: Esta utility define claramente la diferencia entre:
 * - originalRate: La tarifa original ingresada por el usuario (puede ser diaria, semanal o mensual)
 * - dailyRate: La tarifa diaria calculada para usar en los cálculos
 * 
 * Esto elimina la confusión y asegura consistencia en todo el sistema.
 */

export interface CustodyData {
  mode: 'manual' | 'calendar' | 'none';
  originalRate: number; // Tarifa original ingresada por el usuario
  rateType: 'daily' | 'weekly' | 'monthly'; // Tipo de la tarifa original
  days?: number;
  startDate?: string;
  endDate?: string;
  discountPercentage?: number;
  vehicleType?: string;
  notes?: string;
}

export interface CustodyCalculationResult {
  dailyRate: number; // Tarifa diaria calculada
  totalDays: number;
  subtotal: number;
  discount: number;
  total: number;
}

/**
 * Convierte la tarifa original del usuario a tarifa diaria
 */
export const convertToDaily = (originalRate: number, rateType: string): number => {
  switch (rateType) {
    case 'weekly':
      return originalRate / 7;
    case 'monthly':
      return originalRate / 30;
    case 'daily':
    default:
      return originalRate;
  }
};

/**
 * Calcula los días entre dos fechas (inclusivo)
 */
export const calculateDaysBetween = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

/**
 * Calcula el total de custodia/arriendo basado en los datos proporcionados
 */
export const calculateCustodyTotal = (data: CustodyData): CustodyCalculationResult => {
  const dailyRate = convertToDaily(data.originalRate, data.rateType);
  
  let totalDays = 0;
  
  if (data.mode === 'manual') {
    totalDays = data.days || 0;
  } else if (data.mode === 'calendar' && data.startDate && data.endDate) {
    totalDays = calculateDaysBetween(data.startDate, data.endDate);
  }
  
  const subtotal = totalDays * dailyRate;
  const discount = (subtotal * (data.discountPercentage || 0)) / 100;
  const total = subtotal - discount;
  
  return {
    dailyRate,
    totalDays,
    subtotal,
    discount,
    total
  };
};

/**
 * Valida si los datos de custodia están completos para hacer cálculos
 */
export const isCustodyDataComplete = (data: Partial<CustodyData>): boolean => {
  if (!data.originalRate || data.originalRate <= 0) return false;
  if (!data.rateType) return false;
  
  if (data.mode === 'manual') {
    return !!(data.days && data.days > 0);
  }
  
  if (data.mode === 'calendar') {
    return !!(data.startDate && data.endDate);
  }
  
  return false;
};

/**
 * Obtiene la información de custodia para mostrar en interfaces (compatibilidad con formato existente)
 */
export const getCustodyDisplayInfo = (service: any) => {
  if (!service || service.custodyMode === 'none') return null;
  
  // Usar custody_rate_type o custodyRateType (soporte ambos formatos)
  const rateType = service.custody_rate_type || service.custodyRateType || 'daily';
  const originalRate = service.custody_daily_rate || service.custodyDailyRate || 0;
  
  return {
    mode: service.custody_mode || service.custodyMode,
    days: service.custody_days || service.custodyDays,
    originalRate, // La tarifa original del usuario
    dailyRate: convertToDaily(originalRate, rateType), // La tarifa diaria calculada
    rateType,
    startDate: service.custody_start_date || service.custodyStartDate,
    endDate: service.custody_end_date || service.custodyEndDate,
    vehicleType: service.custody_vehicle_type || service.custodyVehicleType,
    discountPercentage: (service.custody_discount_percentage !== undefined ? service.custody_discount_percentage : service.custodyDiscountPercentage) || 0,
    totalAmount: service.custody_total_amount || service.custodyTotalAmount,
    notes: service.custody_notes || service.custodyNotes
  };
};
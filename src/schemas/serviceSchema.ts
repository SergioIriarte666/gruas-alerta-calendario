
import { z } from 'zod';
import { ServiceTypeConfig } from '@/types/serviceTypes';

// Schema base para servicios
const baseServiceFormSchema = z.object({
  folio: z.string()
    .min(1, 'El folio es requerido')
    .trim()
    .refine((folio) => folio.length >= 3, {
      message: 'El folio debe tener al menos 3 caracteres'
    })
    .refine((folio) => /^[A-Za-z0-9\-_]+$/.test(folio), {
      message: 'El folio solo puede contener letras, números, guiones y guiones bajos'
    }),
  isManualFolio: z.boolean().default(false),
  requestDate: z.string(),
  serviceDate: z.string(),
  clientId: z.string().min(1, 'El cliente es requerido'),
  purchaseOrder: z.string().optional(),
  vehicleBrand: z.string().optional(),
  vehicleModel: z.string().optional(),
  licensePlate: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  serviceTypeId: z.string().min(1, 'El tipo de servicio es requerido'),
  value: z.number().min(0, 'El valor debe ser mayor a 0'),
  craneId: z.string().optional(),
  // Legacy support - keeping for backward compatibility but preferring operators array
  operatorId: z.string().optional(),
  operatorCommission: z.number().min(0, 'La comisión debe ser mayor o igual a 0').default(0),
  // Enhanced operators support
  operators: z.array(z.object({
    id: z.string(),
    operatorId: z.string(),
    commission: z.number().min(0),
    role: z.string().optional(),
    hours: z.number().optional()
  })).default([]),
  // Cost details
  costDetails: z.array(z.object({
    id: z.string(),
    description: z.string(),
    amount: z.number(),
    quantity: z.number().optional(),
    unitPrice: z.number().optional(),
    notes: z.string().optional(),
    category_id: z.string(),
    subcategory: z.string().optional(),
    isExisting: z.boolean().optional()
  })).default([]),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled', 'invoiced', 'quoted', 'purchase_order_pending', 'with_purchase_order']),
  observations: z.string().optional(),
  // Optional excess functionality
  hasExcess: z.boolean().default(false),
  clientCoveredAmount: z.number().optional(),
  excessAmount: z.number().optional(),
  thirdPartyClientId: z.string().nullable().optional(),
  // Custody fields
  custodyMode: z.enum(['manual', 'calendar', 'none']).default('none'),
  custodyDays: z.number().min(1).optional(),
  custodyDailyRate: z.number().min(0).optional(),
  custodyStartDate: z.string().optional(),
  custodyEndDate: z.string().optional(),
  custodyVehicleType: z.string().optional(),
  custodyDiscountPercentage: z.number().min(0).max(100).default(0),
  custodyTotalAmount: z.number().min(0).optional(),
  custodyNotes: z.string().optional()
});

// Función para crear schema dinámico basado en configuración del tipo de servicio
export const createServiceFormSchema = (serviceTypeConfig?: ServiceTypeConfig) => {
  if (!serviceTypeConfig) {
    return baseServiceFormSchema;
  }

  return baseServiceFormSchema
    .refine((data) => {
      // Validación condicional para operadores
      if (serviceTypeConfig.operatorRequired && (!data.operators || data.operators.length === 0)) {
        return false;
      }
      return true;
    }, {
      message: 'Al menos un operador es requerido para este tipo de servicio',
      path: ['operators']
    })
    .refine((data) => {
      // Validación condicional para grúa
      if (serviceTypeConfig.craneRequired && (!data.craneId || data.craneId === '')) {
        return false;
      }
      return true;
    }, {
      message: 'La grúa es requerida para este tipo de servicio',
      path: ['craneId']
    })
    .refine((data) => {
      // Validación condicional para origen
      if (serviceTypeConfig.originRequired && (!data.origin || data.origin.trim() === '')) {
        return false;
      }
      return true;
    }, {
      message: 'El origen es requerido para este tipo de servicio',
      path: ['origin']
    })
    .refine((data) => {
      // Validación condicional para destino
      if (serviceTypeConfig.destinationRequired && (!data.destination || data.destination.trim() === '')) {
        return false;
      }
      return true;
    }, {
      message: 'El destino es requerido para este tipo de servicio',
      path: ['destination']
    })
    .refine((data) => {
      // Validación condicional para marca de vehículo
      if (serviceTypeConfig.vehicleBrandRequired && (!data.vehicleBrand || data.vehicleBrand.trim() === '')) {
        return false;
      }
      return true;
    }, {
      message: 'La marca del vehículo es requerida para este tipo de servicio',
      path: ['vehicleBrand']
    })
    .refine((data) => {
      // Validación condicional para modelo de vehículo
      if (serviceTypeConfig.vehicleModelRequired && (!data.vehicleModel || data.vehicleModel.trim() === '')) {
        return false;
      }
      return true;
    }, {
      message: 'El modelo del vehículo es requerido para este tipo de servicio',
      path: ['vehicleModel']
    })
    .refine((data) => {
      // Validación condicional para placa del vehículo
      if (serviceTypeConfig.licensePlateRequired && (!data.licensePlate || data.licensePlate.trim() === '')) {
        return false;
      }
      return true;
    }, {
      message: 'La patente del vehículo es requerida para este tipo de servicio',
      path: ['licensePlate']
    })
    .refine((data) => {
      // Validación condicional para orden de compra
      if (serviceTypeConfig.purchaseOrderRequired && (!data.purchaseOrder || data.purchaseOrder.trim() === '')) {
        return false;
      }
      return true;
    }, {
      message: 'La orden de compra es requerida para este tipo de servicio',
      path: ['purchaseOrder']
    })
    .refine((data) => {
      if (data.hasExcess && data.clientCoveredAmount !== undefined) {
        return data.clientCoveredAmount <= data.value;
      }
      return true;
    }, {
      message: 'El monto cubierto por el cliente no puede ser mayor al valor del servicio',
      path: ['clientCoveredAmount']
    })
    .refine(
      (data) => {
        if (data.hasExcess && data.clientCoveredAmount !== undefined && data.clientCoveredAmount !== null) {
          return data.clientCoveredAmount >= 0 && data.clientCoveredAmount < data.value;
        }
        return true;
      },
      {
        message: "El monto cubierto por el cliente debe ser menor al valor del servicio y mayor o igual a 0",
        path: ["clientCoveredAmount"],
      }
    )
    .refine(
      (data) => {
        // If has excess and excess amount > 0, require third-party client
        if (data.hasExcess && data.clientCoveredAmount !== undefined && data.value > 0) {
          const excessAmount = data.value - data.clientCoveredAmount;
          if (excessAmount > 0) {
            return data.thirdPartyClientId !== null && data.thirdPartyClientId !== undefined;
          }
        }
        return true;
      },
      {
        message: "Debe seleccionar un cliente para el servicio de excedente",
        path: ["thirdPartyClientId"],
      }
    )
    .refine((data) => {
      if (data.custodyMode === 'manual') {
        return data.custodyDays && data.custodyDailyRate;
      }
      return true;
    }, {
      message: 'Modo manual requiere días y tarifa diaria',
      path: ['custodyDays']
    })
    .refine((data) => {
      if (data.custodyMode === 'calendar') {
        return data.custodyStartDate && data.custodyEndDate;
      }
      return true;
    }, {
      message: 'Modo calendario requiere fechas de inicio y fin',
      path: ['custodyStartDate']
    })
    .refine((data) => {
      if (data.custodyStartDate && data.custodyEndDate) {
        return new Date(data.custodyEndDate) >= new Date(data.custodyStartDate);
      }
      return true;
    }, {
      message: 'Fecha de fin debe ser posterior o igual a fecha de inicio',
      path: ['custodyEndDate']
    })
    .refine((data) => {
      if (data.custodyMode && data.custodyMode !== 'none') {
        return data.custodyVehicleType && data.custodyVehicleType.trim() !== '';
      }
      return true;
    }, {
      message: 'Servicios de custodia/arriendo requieren tipo de vehículo/equipo',
      path: ['custodyVehicleType']
    })
    .refine((data) => {
      // Validación específica para "Arriendo de Equipos"
      if (serviceTypeConfig?.name === 'Arriendo de Equipos') {
        return data.custodyStartDate && data.custodyEndDate && data.custodyVehicleType && data.custodyDailyRate;
      }
      return true;
    }, {
      message: 'Arriendo de equipos requiere fechas de inicio/fin, tipo de equipo y tarifa diaria',
      path: ['custodyStartDate']
    });
};

// Schema estático por compatibilidad
export const serviceFormSchema = baseServiceFormSchema;

export type ServiceFormValues = z.infer<typeof serviceFormSchema>;
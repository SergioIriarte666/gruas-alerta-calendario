
import { z } from 'zod';

export const serviceFormSchema = z.object({
  folio: z.string().min(1, 'El folio es requerido'),
  isManualFolio: z.boolean().default(false),
  requestDate: z.string(),
  serviceDate: z.string(),
  clientId: z.string().min(1, 'El cliente es requerido'),
  purchaseOrder: z.string().optional(),
  vehicleBrand: z.string().optional(),
  vehicleModel: z.string().optional(),
  licensePlate: z.string().optional(),
  origin: z.string().min(1, 'El origen es requerido'),
  destination: z.string().min(1, 'El destino es requerido'),
  serviceTypeId: z.string().min(1, 'El tipo de servicio es requerido'),
  value: z.number().min(0, 'El valor debe ser mayor a 0'),
  craneId: z.string().min(1, 'La grúa es requerida'),
  operatorId: z.string().min(1, 'El operador es requerido'),
  operatorCommission: z.number().min(0, 'La comisión debe ser mayor o igual a 0'),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled', 'invoiced']),
  observations: z.string().optional()
});

export type ServiceFormValues = z.infer<typeof serviceFormSchema>;

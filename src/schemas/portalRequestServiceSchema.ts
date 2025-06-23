
import { z } from 'zod';

export const portalRequestServiceSchema = z.object({
  origin: z.string().min(3, { message: 'El origen es requerido.' }),
  destination: z.string().min(3, { message: 'El destino es requerido.' }),
  
  service_type_id: z.string().min(1, { message: 'El tipo de servicio es requerido.' }),
  
  license_plate: z.string().optional(),
  vehicle_brand: z.string().optional(),
  vehicle_model: z.string().optional(),
  
  observations: z.string().optional(),
});

export type PortalRequestServiceSchema = z.infer<typeof portalRequestServiceSchema>; 

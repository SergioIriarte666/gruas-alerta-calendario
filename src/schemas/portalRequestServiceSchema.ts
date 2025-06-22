import { z } from 'zod';

export const portalRequestServiceSchema = z.object({
  origin: z.string().min(3, { message: 'El origen es requerido.' }),
  destination: z.string().min(3, { message: 'El destino es requerido.' }),
  
  license_plate: z.string().min(6, { message: 'La patente es requerida.' }).max(10),
  vehicle_brand: z.string().min(2, { message: 'La marca es requerida.' }),
  vehicle_model: z.string().min(1, { message: 'El modelo es requerido.' }),
  
  observations: z.string().optional(),
});

export type PortalRequestServiceSchema = z.infer<typeof portalRequestServiceSchema>; 